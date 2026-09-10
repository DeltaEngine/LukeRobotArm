/**
 * Assembly helper: mint a Gemini Live ephemeral token.
 * Vite mounts POST /api/luke-session. Production: `node server/luke-chat.mjs --listen`.
 *
 * Limits (release). Debug/dev is looser — see limitsFor().
 * Ceiling: in-process maps (reset on restart); upgrade: shared store.
 *
 * Self-check: node server/luke-chat.mjs --self-check
 */
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = 'gemini-3.1-flash-live-preview';
const DAY_MS = 24 * 60 * 60 * 1000;
const RELEASE = {
  sessionMs: 5 * 60 * 1000,
  userPerDay: 1,
  ipPerDay: 3,
  maxOutputTokens: 1024,
};
const DEBUG = {
  sessionMs: 30 * 60 * 1000,
  userPerDay: 20,
  ipPerDay: 50,
  maxOutputTokens: 2048,
};

function loadPrompt() {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../src/assembly/luke-assembly-prompt.ts'),
    'utf8',
  );
  const start = src.indexOf('`') + 1;
  const end = src.lastIndexOf('`');
  if (start < 1 || end <= start) throw new Error('assembly prompt missing');
  return src.slice(start, end);
}

export const LUKE_ASSEMBLY_PROMPT = loadPrompt();

export function limitsFor(debug) {
  return debug ? DEBUG : RELEASE;
}

export function promptFor(lang) {
  const locale = String(lang || 'en').slice(0, 16);
  return LUKE_ASSEMBLY_PROMPT.replaceAll('{{lang}}', locale);
}

/** @typedef {{ at: number }} Hit */

function prune(list, now) {
  return list.filter((h) => now - h.at < DAY_MS);
}

/**
 * @param {{ userId: string, ip: string, now?: number, debug: boolean }} q
 * @param {{ users: Map<string, Hit[]>, ips: Map<string, Hit[]>, active: Map<string, number> }} store
 */
export function takeSessionSlot(q, store) {
  const now = q.now ?? Date.now();
  const lim = limitsFor(q.debug);
  const userId = String(q.userId || '').slice(0, 64);
  const ip = String(q.ip || 'unknown').slice(0, 64);
  if (!userId) return { ok: false, status: 400, error: 'Missing user id', lim };

  const activeUntil = store.active.get(userId) || 0;
  if (activeUntil > now) {
    store.active.set(userId, now + lim.sessionMs);
    return { ok: true, lim, reconnect: true };
  }

  const userHits = prune(store.users.get(userId) || [], now);
  if (userHits.length >= lim.userPerDay) {
    return { ok: false, status: 429, error: 'Luke can only start one session per day', lim };
  }
  const ipHits = prune(store.ips.get(ip) || [], now);
  if (ipHits.length >= lim.ipPerDay) {
    return { ok: false, status: 429, error: 'Too many Luke sessions from this network today', lim };
  }

  userHits.push({ at: now });
  ipHits.push({ at: now });
  store.users.set(userId, userHits);
  store.ips.set(ip, ipHits);
  store.active.set(userId, now + lim.sessionMs);
  return { ok: true, lim, reconnect: false };
}

export function endSessionSlot(userId, store) {
  store.active.delete(String(userId || '').slice(0, 64));
}

const store = {
  users: new Map(),
  ips: new Map(),
  active: new Map(),
};

export function liveSetup(lang, maxOutputTokens) {
  return {
    model: `models/${MODEL}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      maxOutputTokens,
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Charon' } },
      },
    },
    systemInstruction: { parts: [{ text: promptFor(lang) }] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    tools: [
      {
        functionDeclarations: [
          {
            name: 'show_section',
            description:
              'Scroll the assembly page to a section. overview = parts photo (Assembly00). 1–12 = assembly steps (Assembly01–12). poweron = Power on & connect (24V, Wi-Fi, Control page, gamepad).',
            parameters: {
              type: 'OBJECT',
              properties: {
                section: {
                  type: 'STRING',
                  description: 'overview, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, or poweron',
                },
              },
              required: ['section'],
            },
          },
        ],
      },
    ],
  };
}

function isoZ(msFromNow) {
  return new Date(Date.now() + msFromNow).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function mintAuthTokenOnce(apiKey, body) {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const raw = await res.text().catch(() => '');
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }
  return { ok: res.ok, status: res.status, raw, data };
}

/** Network/TLS blips must not throw — the HTTP catch mapped those to 400 "Bad request". */
async function mintAuthToken(apiKey, body) {
  let last = { ok: false, status: 0, raw: 'token request failed', data: {} };
  for (let i = 0; i < 2; i++) {
    try {
      last = await mintAuthTokenOnce(apiKey, body);
      if (last.ok || (last.status >= 400 && last.status < 500)) return last;
    } catch (err) {
      last = { ok: false, status: 0, raw: String(err?.message || err), data: {} };
    }
  }
  return last;
}

function failMsg(debug, status, detail) {
  const clip = String(detail || '').replace(/\s+/g, ' ').slice(0, 400);
  if (debug && clip) return `Luke could not start (${status}): ${clip}`;
  if (!status) return 'Luke could not start (no response from Gemini)';
  return `Luke could not start (Gemini HTTP ${status})`;
}

/**
 * @param {{ userId?: unknown, lang?: unknown }} body
 * @param {{ apiKey: string, ip?: string, debug?: boolean }} env
 */
export async function handleLukeSession(body, env) {
  if (!env.apiKey) {
    console.error('[luke-session] GEMINI_API_KEY missing');
    return {
      status: 500,
      json: {
        error:
          'Ask Luke is not configured — set GEMINI_API_KEY on the Node process (Windows env for that account, or .env next to package.json) and restart node --listen',
      },
    };
  }
  const userId = String(body?.userId || '').trim().slice(0, 64);
  const lang = String(body?.lang || 'en').slice(0, 16);
  const slot = takeSessionSlot({ userId, ip: env.ip || 'unknown', debug: !!env.debug }, store);
  if (!slot.ok) {
    console.warn('[luke-session] limit', slot.error, { userId, ip: env.ip });
    return { status: slot.status, json: { error: slot.error } };
  }

  const expire = isoZ(slot.lim.sessionMs);
  const newSess = isoZ(60_000);
  const setup = liveSetup(lang, slot.lim.maxOutputTokens);
  const base = {
    uses: 1,
    expireTime: expire,
    newSessionExpireTime: newSess,
  };

  // REST field is bidiGenerateContentSetup (BidiGenerateContentSetup).
  // SDK's liveConnectConstraints is a different shape and 400s the token call.
  let minted = await mintAuthToken(env.apiKey, {
    ...base,
    bidiGenerateContentSetup: setup,
  });
  let constrained = true;
  if (!minted.ok) {
    console.warn('[luke-session] locked setup token failed', minted.status, minted.raw.slice(0, 500));
    minted = await mintAuthToken(env.apiKey, base);
    constrained = false;
  }

  if (!minted.ok) {
    endSessionSlot(userId, store);
    console.error('[luke-session] token mint failed', minted.status, minted.raw.slice(0, 800));
    return { status: 502, json: { error: failMsg(env.debug, minted.status, minted.raw) } };
  }

  const token = minted.data?.name;
  if (!token) {
    endSessionSlot(userId, store);
    console.error('[luke-session] token response had no name', minted.raw.slice(0, 800));
    return { status: 502, json: { error: failMsg(env.debug, 502, minted.raw) } };
  }

  // Ephemeral tokens only work on Constrained + access_token, never ?key= on BidiGenerateContent.
  const wsUrl =
    'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained' +
    `?access_token=${encodeURIComponent(token)}`;

  console.log('[luke-session] ok', {
    constrained,
    lang,
    sessionMs: slot.lim.sessionMs,
    userId: userId.slice(0, 8),
  });
  return {
    status: 200,
    json: {
      token,
      wsUrl,
      sessionMs: slot.lim.sessionMs,
      setup,
    },
  };
}

export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`invalid JSON (${raw.slice(0, 80)})`);
  }
}

function queryFields(req) {
  try {
    const q = new URL(req.originalUrl || req.url || '/', 'http://127.0.0.1').searchParams;
    return { userId: q.get('userId') || '', lang: q.get('lang') || '' };
  } catch {
    return { userId: '', lang: '' };
  }
}

/** Body first; query/header backup when IIS/ARR delivers a mangled POST body. */
export async function readBodyOrQuery(req) {
  let body = {};
  try {
    body = await readJsonBody(req);
  } catch (err) {
    console.warn('[luke-session] body', err);
  }
  const q = queryFields(req);
  const headers = req.headers || {};
  const userId = String(body?.userId || q.userId || headers['x-luke-user'] || '').trim();
  const lang = String(body?.lang || q.lang || headers['x-luke-lang'] || '').trim();
  return { ...body, userId, lang };
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function isLukeApi(url) {
  const path = (url || '/').split('?')[0];
  return path.includes('/api/luke-session') || path.includes('/api/luke-chat');
}

export function lukeHealth(env) {
  return {
    ok: true,
    hasKey: Boolean(env.apiKey),
    debug: Boolean(env.debug),
    method: 'POST /api/luke-session  with JSON { userId, lang }',
    hint: env.apiKey
      ? 'Open the Assembly page, or POST JSON. A GET in the browser is only this health check.'
      : 'GEMINI_API_KEY is empty. Set it on the Node process or in .env next to package.json, then restart node --listen.',
  };
}

export async function handleLukeRequest(req, env) {
  const url = (req.originalUrl || req.url || '/').split('?')[0];
  if (req.method === 'OPTIONS') return { status: 204, json: null };
  if (req.method === 'GET' && isLukeApi(url)) {
    return { status: 200, json: lukeHealth(env) };
  }
  if (req.method === 'POST' && url.endsWith('/luke-session/end')) {
    const body = await readBodyOrQuery(req);
    endSessionSlot(body?.userId, store);
    return { status: 204, json: null };
  }
  if (req.method === 'POST' && (url.endsWith('/luke-session') || url.endsWith('/luke-chat'))) {
    const body = await readBodyOrQuery(req);
    return handleLukeSession(body, { ...env, ip: clientIp(req) });
  }
  return { status: 404, json: { error: 'Not found', url } };
}

function assert(cond, msg) {
  if (!cond) {
    console.error('self-check failed:', msg);
    process.exit(1);
  }
}

if (process.argv.includes('--self-check')) {
  const missing = await handleLukeSession({ userId: 'u1' }, { apiKey: '' });
  assert(missing.status === 500, 'missing key should be 500');

  const s = { users: new Map(), ips: new Map(), active: new Map() };
  const a = takeSessionSlot({ userId: 'u', ip: '1.1.1.1', now: 1, debug: false }, s);
  assert(a.ok, 'first session ok');
  const b = takeSessionSlot({ userId: 'u', ip: '1.1.1.1', now: 2, debug: false }, s);
  assert(b.ok && b.reconnect, 'refresh reconnects the same user');
  endSessionSlot('u', s);
  const c = takeSessionSlot({ userId: 'u', ip: '1.1.1.1', now: 3, debug: false }, s);
  assert(!c.ok, 'still blocked by 1/24h after the slot ends');

  const s2 = { users: new Map(), ips: new Map(), active: new Map() };
  assert(takeSessionSlot({ userId: 'a', ip: '9', now: 1, debug: false }, s2).ok, 'ip 1');
  assert(takeSessionSlot({ userId: 'b', ip: '9', now: 2, debug: false }, s2).ok, 'ip 2');
  assert(takeSessionSlot({ userId: 'c', ip: '9', now: 3, debug: false }, s2).ok, 'ip 3');
  assert(!takeSessionSlot({ userId: 'd', ip: '9', now: 4, debug: false }, s2).ok, 'ip 4 blocked');

  const s3 = { users: new Map(), ips: new Map(), active: new Map() };
  assert(takeSessionSlot({ userId: 'u', ip: '1', now: 1, debug: true }, s3).ok, 'debug 1');
  endSessionSlot('u', s3);
  assert(takeSessionSlot({ userId: 'u', ip: '1', now: 2, debug: true }, s3).ok, 'debug allows another user session');

  assert(limitsFor(false).sessionMs === 5 * 60 * 1000, 'release session 5 min');
  assert(limitsFor(false).maxOutputTokens === 1024, 'output cap allows a full spoken sentence');
  assert(promptFor('de-DE').includes('de-DE'), 'lang in prompt');

  const badReq = {
    url: '/api/luke-session?userId=from-query&lang=de',
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield Buffer.from('not-json');
    },
  };
  const recovered = await readBodyOrQuery(badReq);
  assert(recovered.userId === 'from-query', 'query backup after bad json');
  assert(recovered.lang === 'de', 'lang from query after bad json');

  console.log('luke-chat self-check ok');
  process.exit(0);
}

/** Fill empty process.env from .env. Does not override vars already set. Ceiling: no multiline values. */
function loadDotEnv() {
  const files = [
    join(dirname(fileURLToPath(import.meta.url)), '../.env'),
    join(process.cwd(), '.env'),
  ];
  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const body = t.startsWith('export ') ? t.slice(7).trim() : t;
      const i = body.indexOf('=');
      if (i < 1) continue;
      const k = body.slice(0, i).trim();
      let v = body.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

if (process.argv.includes('--listen')) {
  loadDotEnv();
  const port = Number(process.env.LUKE_CHAT_PORT || 8787);
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  const debug = process.env.LUKE_DEBUG === '1' || (process.env.NODE_ENV !== 'production' && process.env.LUKE_RELEASE !== '1');
  http
    .createServer(async (req, res) => {
      console.log(new Date().toISOString(), req.method, req.url, 'cl', req.headers['content-length'] || 0);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Luke-User, X-Luke-Lang');
      res.setHeader('X-Luke', 'chat');
      try {
        const out = await handleLukeRequest(req, { apiKey, debug });
        res.writeHead(out.status, { 'Content-Type': 'application/json' });
        res.end(out.json ? JSON.stringify(out.json) : '');
      } catch (err) {
        console.error('[luke-session] request failed', err);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Bad request', hint: String(err?.message || err).slice(0, 200) }));
      }
    })
    .listen(port, '127.0.0.1', () => {
      console.log(
        `luke-session listening on 127.0.0.1:${port} (${debug ? 'debug' : 'release'} limits, hasKey=${Boolean(apiKey)})`,
      );
    });
}
