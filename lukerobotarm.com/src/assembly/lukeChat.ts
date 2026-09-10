const USER_KEY = 'luke-live-user';
const GREETING_NUDGE =
  'Greet me now with the localized equivalent of: Hi, I am Luke, I can guide you through the assembly of the robot arm. Do not scroll or change the picture. Stay at the top. Do not name parts or steps yet.';
const OVERVIEW_NUDGE =
  'Speak ONLY this, then stop: "The Luke Robot Arm has these parts: a base, a column, an arm, and a 3-finger gripper." Do not mention the lead screw, coupler, rods, screws, or any later step.';
const STEP_NUDGE: Record<string, string> = {
  '1': 'Speak ONLY this, then stop: "Insert the lead screw down into the base, all the way." Do not mention the coupler, carbon fiber rods, or any other step.',
  '2': 'Speak ONLY this, then stop: "Fit the lead-screw coupler halves so they interlock, rotate to make sure they fit together. Let me know when you are ready for step 3." Do not mention rods or any other step.',
};
const START_RE = /^\s*(start|let'?s go|begin|los)\b/i;

function isHiddenNudge(s: string): boolean {
  return (
    s.startsWith('Greet me now') ||
    s.startsWith('Speak ONLY this') ||
    s.startsWith('Continue immediately with step') ||
    GREETING_NUDGE.startsWith(s)
  );
}

function errText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function wsCloseMsg(ev: CloseEvent): string {
  const why = (ev.reason || '').trim();
  if (why) return `Luke disconnected (${ev.code}): ${why}`;
  if (ev.code === 1006) {
    return 'Luke disconnected (1006): WebSocket died — Gemini rejected the token, or the browser blocked the socket.';
  }
  if (ev.code === 1008) return 'Luke disconnected (1008): Gemini rejected the session.';
  if (ev.code === 1011) return 'Luke disconnected (1011): Gemini server error.';
  if (ev.code === 1000) return 'Session ended.';
  return `Luke disconnected (WebSocket ${ev.code}).`;
}

export function lukeUserId(): string {
  try {
    const old = localStorage.getItem(USER_KEY);
    if (old && /^[\w-]{8,64}$/.test(old)) return old;
    const id = crypto.randomUUID();
    localStorage.setItem(USER_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function currentStepLabel(root: ParentNode): string {
  const images = [...root.querySelectorAll<HTMLElement>('.assembly-image[data-step]')];
  if (!images.length) return '';
  const mid = window.innerHeight * 0.45;
  let best = images[0];
  let bestDist = Infinity;
  for (const el of images) {
    const r = el.getBoundingClientRect();
    const dist = Math.abs(r.top + r.height / 2 - mid);
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return best.dataset.step || '';
}

export function pauseAssemblyVideo(root: ParentNode) {
  const iframe = root.querySelector<HTMLIFrameElement>('iframe[src*="youtube"]');
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
    '*',
  );
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(bytes: Uint8Array): string {
  let s = '';
  const step = 8192;
  for (let i = 0; i < bytes.length; i += step) {
    s += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(s);
}

function downsample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) out[i] = input[Math.floor(i * ratio)] ?? 0;
  return out;
}

function floatToPcm16(input: Float32Array): Uint8Array {
  const out = new Uint8Array(input.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] ?? 0));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const i0 = Math.floor(x);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const f = x - i0;
    out[i] = (input[i0] ?? 0) * (1 - f) + (input[i1] ?? 0) * f;
  }
  return out;
}

/** Continuous PCM out — avoids clicks from stitching BufferSources. */
class PcmOut {
  private q: Float32Array[] = [];
  private off = 0;
  private proc: ScriptProcessorNode | null;
  private gain: GainNode;
  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.proc = ctx.createScriptProcessor(1024, 0, 1);
    this.gain = ctx.createGain();
    this.proc.onaudioprocess = (ev) => this.pull(ev.outputBuffer.getChannelData(0));
    this.proc.connect(this.gain);
    this.gain.connect(ctx.destination);
  }

  pushPcm16(bytes: Uint8Array, srcRate: number) {
    if (bytes.byteLength < 8) return;
    const even = bytes.byteLength % 2 === 0 ? bytes : bytes.subarray(0, bytes.byteLength - 1);
    const copy = new Uint8Array(even.byteLength);
    copy.set(even);
    const i16 = new Int16Array(copy.buffer);
    const f = new Float32Array(i16.length);
    for (let i = 0; i < i16.length; i++) f[i] = (i16[i] ?? 0) / 32768;
    this.q.push(resampleLinear(f, srcRate, this.ctx.sampleRate));
  }

  private pull(out: Float32Array) {
    let i = 0;
    while (i < out.length) {
      const cur = this.q[0];
      if (!cur) {
        out.fill(0, i);
        return;
      }
      const n = Math.min(out.length - i, cur.length - this.off);
      out.set(cur.subarray(this.off, this.off + n), i);
      this.off += n;
      i += n;
      if (this.off >= cur.length) {
        this.q.shift();
        this.off = 0;
      }
    }
  }

  get buffered(): number {
    let n = -this.off;
    for (const a of this.q) n += a.length;
    return Math.max(0, n);
  }

  clear() {
    this.q = [];
    this.off = 0;
  }

  dispose() {
    this.clear();
    this.proc?.disconnect();
    this.gain.disconnect();
    this.proc = null;
  }
}

type LiveUi = {
  note: (text: string) => void;
  log: (role: 'luke' | 'you', text: string, streaming?: boolean) => void;
  endTurn: () => void;
  getStep: () => string;
  onMic: (on: boolean) => void;
};

export function scrollLukeSection(raw: string) {
  const s = String(raw || '').trim().toLowerCase();
  let id = 'poweron';
  if (s === 'overview' || s === '0' || s === '00') id = 'luke-overview';
  else {
    const n = s.match(/(\d{1,2})/);
    const num = n ? Number(n[1]) : 0;
    if (num >= 1 && num <= 12) id = `luke-step-${num}`;
  }
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return id;
}

export class LukeLive {
  private ui: LiveUi;
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private pcmOut: PcmOut | null = null;
  private mic: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private timer = 0;
  private closed = false;
  private started = false;
  private autoQueue: string[] = [];
  private advancing = false;
  private autoShownAt = 0;
  private overviewNudged = false;
  private userId = lukeUserId();
  private boot: Promise<boolean> | null = null;
  private lastError = '';

  constructor(ui: LiveUi) {
    this.ui = ui;
  }

  private get ready() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private fail(msg: string) {
    this.lastError = msg;
    console.warn('[luke]', msg);
    this.ui.note(msg);
  }

  async ensureStarted() {
    if (this.ready) return true;
    if (this.boot) return this.boot;
    this.boot = this.start().finally(() => {
      this.boot = null;
    });
    return this.boot;
  }

  async start() {
    if (this.ready) return true;
    this.closed = false;
    this.armAudio();
    try {
      const lang = navigator.language || 'en';
      const payload = {
        userId: this.userId,
        lang,
        step: this.ui.getStep(),
      };
      const qs = new URLSearchParams({ userId: this.userId, lang });
      let res: Response | null = null;
      let raw = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await fetch(`/api/luke-session?${qs}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Luke-User': this.userId,
            'X-Luke-Lang': lang,
          },
          body: JSON.stringify(payload),
        });
        raw = await res.text();
        if (res.ok || (res.status >= 400 && res.status < 500)) break;
        await new Promise((r) => setTimeout(r, 500));
      }
      if (!res) throw new Error('Luke could not start');
      let data: {
        error?: string;
        hint?: string;
        wsUrl?: string;
        setup?: Record<string, unknown>;
        sessionMs?: number;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        const text = raw
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        data = { error: text.slice(0, 400) || `Luke could not start (HTTP ${res.status})` };
      }
      console.info('[luke]', res.status, data);
      if (!res.ok || !data.wsUrl || !data.setup) {
        const msg = [data.error, data.hint].filter(Boolean).join(' — ') || `Luke could not start (HTTP ${res.status})`;
        throw new Error(msg);
      }
      await this.openSocket(data.wsUrl, data.setup);
      this.lastError = '';
      if (this.ctx?.state === 'suspended') {
        this.ui.note('Connected. Tap the page once to hear Luke.');
      } else {
        this.ui.note('');
      }
      this.timer = window.setTimeout(() => this.stop('Session ended.'), data.sessionMs || 5 * 60 * 1000);
      return true;
    } catch (err) {
      this.fail(errText(err, 'Luke could not start'));
      try {
        this.ws?.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
      return false;
    }
  }

  /** Do not block session start on autoplay. Text still works until the user taps. */
  private armAudio() {
    this.ctx ??= new AudioContext();
    if (this.ctx.state !== 'suspended') return;
    const go = () => {
      document.removeEventListener('pointerdown', go);
      void this.ctx?.resume().then(() => {
        if (this.ready && !this.lastError) this.ui.note('');
      });
    };
    document.addEventListener('pointerdown', go, { once: true });
  }

  private openSocket(wsUrl: string, setup: Record<string, unknown>) {
    pauseAssemblyVideo(document);
    return new Promise<void>((resolve, reject) => {
      let opened = false;
      const ws = new WebSocket(wsUrl);
      this.ws = ws;
      const t = window.setTimeout(() => {
        if (opened) return;
        reject(new Error('Luke timed out connecting to Gemini (WebSocket, 15s).'));
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }, 15_000);
      ws.addEventListener('open', () => {
        opened = true;
        window.clearTimeout(t);
        console.info('[luke] websocket open');
        ws.send(JSON.stringify({ setup }));
        resolve();
      });
      ws.addEventListener('message', (ev) => {
        void this.onMessage(ev.data);
      });
      ws.addEventListener('close', (ev) => {
        window.clearTimeout(t);
        console.warn('[luke] websocket close', ev.code, ev.reason);
        const why = wsCloseMsg(ev);
        if (!opened) {
          reject(new Error(why));
          return;
        }
        if (!this.closed) this.stop(why);
      });
      ws.addEventListener('error', () => {
        console.warn('[luke] websocket error', wsUrl.replace(/access_token=[^&]+/, 'access_token=…'));
        if (!opened) return;
        this.fail('Luke lost the WebSocket (browser blocked it, or Gemini closed it).');
      });
    });
  }

  private async onMessage(raw: unknown) {
    let msg: Record<string, unknown>;
    try {
      const text = typeof raw === 'string' ? raw : raw instanceof Blob ? await raw.text() : '';
      msg = JSON.parse(text) as Record<string, unknown>;
    } catch {
      this.fail('Luke sent a message that could not be read.');
      return;
    }
    if (msg.error) {
      console.warn('[luke] server error', msg.error);
      this.ui.note(`Luke error: ${JSON.stringify(msg.error).slice(0, 240)}`);
      return;
    }
    if (msg.setupComplete) {
      this.sendJson({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: GREETING_NUDGE }] }],
          turnComplete: true,
        },
      });
      return;
    }
    if (msg.toolCall) {
      this.handleTools(msg.toolCall as { functionCalls?: Array<{ name?: string; args?: Record<string, string> | string; id?: string }> });
      return;
    }
    const sc = msg.serverContent as
      | {
          interrupted?: boolean;
          inputTranscription?: { text?: string };
          outputTranscription?: { text?: string };
          modelTurn?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; text?: string }> };
          generationComplete?: boolean;
          turnComplete?: boolean;
        }
      | undefined;
    if (!sc) return;
    if (sc.interrupted) this.stopPlayback();
    const heard = sc.inputTranscription?.text?.trim() || '';
    if (heard && START_RE.test(heard)) {
      this.beginStartFlow();
      this.nudgeOverview();
    }
    if (heard && !isHiddenNudge(heard)) {
      this.ui.log('you', heard, true);
    }
    if (sc.outputTranscription?.text) this.ui.log('luke', String(sc.outputTranscription.text), true);
    const parts = sc.modelTurn?.parts || [];
    const hasAudio = parts.some((p) => p.inlineData?.data);
    for (const part of parts) {
      if (part.inlineData?.data) this.playPcm(part.inlineData.data, part.inlineData.mimeType);
      else if (
        part.text &&
        part.text !== 'text' &&
        !hasAudio &&
        !sc.outputTranscription
      ) {
        this.ui.log('luke', part.text, true);
      }
    }
    if (sc.turnComplete) {
      this.ui.endTurn();
      this.advanceAuto();
    } else if (sc.generationComplete) {
      this.ui.endTurn();
    }
  }

  private sendJson(obj: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
      return true;
    }
    this.fail(this.lastError || 'Luke is not connected — message was not sent.');
    return false;
  }

  async sendText(text: string) {
    const t = text.trim();
    if (!t) {
      this.fail('Type a question, or start.');
      return;
    }
    const starting = START_RE.test(t);
    if (starting) this.beginStartFlow();
    this.ui.log('you', t);
    const ok = await this.ensureStarted();
    if (!this.ready) {
      this.fail(this.lastError || (ok ? 'Luke is not connected.' : 'Luke could not start.'));
      return;
    }
    pauseAssemblyVideo(document);
    if (starting) {
      this.nudgeOverview();
      return;
    }
    this.sendJson({
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [{ text: `${t}\n(Currently looking at: ${this.ui.getStep()})` }],
          },
        ],
        turnComplete: true,
      },
    });
  }

  private handleTools(toolCall: {
    functionCalls?: Array<{ name?: string; args?: Record<string, string> | string; id?: string }>;
  }) {
    const replies = [];
    for (const fc of toolCall.functionCalls || []) {
      let args = fc.args;
      if (typeof args === 'string') {
        try {
          args = JSON.parse(args) as Record<string, string>;
        } catch {
          args = {};
        }
      }
      const section = args?.section || '';
      let id = '';
      if (fc.name === 'show_section') {
        if (!this.started) {
          id = 'stay-at-top';
        } else if (this.autoQueue.length) {
          id = 'auto-sequence';
        } else {
          id = scrollLukeSection(section);
        }
      }
      replies.push({
        name: fc.name || 'show_section',
        id: fc.id,
        response: { result: id || 'ok' },
      });
    }
    this.sendJson({ toolResponse: { functionResponses: replies } });
  }

  private beginStartFlow() {
    if (this.started && this.autoQueue.length) return;
    this.started = true;
    this.autoQueue = ['1', '2'];
    this.autoShownAt = Date.now();
    this.advancing = false;
    scrollLukeSection('overview');
  }

  private nudgeOverview() {
    if (this.overviewNudged || !this.ready) return;
    this.overviewNudged = true;
    this.sendJson({
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: OVERVIEW_NUDGE }] }],
        turnComplete: true,
      },
    });
  }

  private advanceAuto() {
    if (!this.autoQueue.length || this.advancing) return;
    this.advancing = true;
    const wait = () => {
      if (this.closed) {
        this.advancing = false;
        return;
      }
      const rate = this.ctx?.sampleRate || 48000;
      if (this.pcmOut && this.pcmOut.buffered > rate * 0.2) {
        window.setTimeout(wait, 120);
        return;
      }
      if (this.autoShownAt && Date.now() - this.autoShownAt < 1600) {
        window.setTimeout(wait, 100);
        return;
      }
      const next = this.autoQueue.shift();
      this.advancing = false;
      if (!next) return;
      scrollLukeSection(next);
      this.autoShownAt = Date.now();
      const nudge = STEP_NUDGE[next];
      if (nudge && this.ready) {
        this.sendJson({
          clientContent: {
            turns: [{ role: 'user', parts: [{ text: nudge }] }],
            turnComplete: true,
          },
        });
      }
    };
    wait();
  }

  async enableMic() {
    const ok = await this.ensureStarted();
    if (!this.ready) {
      this.fail(this.lastError || (ok ? 'Luke is not connected.' : 'Luke could not start — mic not enabled.'));
      return;
    }
    if (this.mic) return;
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      this.fail(`Microphone blocked — type instead. (${errText(err, 'permission denied')})`);
      return;
    }
    this.ctx ??= new AudioContext();
    const src = this.ctx.createMediaStreamSource(this.mic);
    const proc = this.ctx.createScriptProcessor(4096, 1, 1);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.processor = proc;
    const fromRate = this.ctx.sampleRate;
    proc.onaudioprocess = (ev) => {
      const input = ev.inputBuffer.getChannelData(0);
      const down = downsample(input, fromRate, 16000);
      const pcm = floatToPcm16(down);
      this.sendJson({
        realtimeInput: { audio: { data: bytesToB64(pcm), mimeType: 'audio/pcm;rate=16000' } },
      });
    };
    src.connect(proc);
    proc.connect(mute);
    mute.connect(this.ctx.destination);
    this.ui.onMic(true);
    this.ui.note('');
  }

  private playPcm(b64: string, mime?: string) {
    if (!this.ctx) return;
    pauseAssemblyVideo(document);
    this.pcmOut ??= new PcmOut(this.ctx);
    const rateMatch = /rate=(\d+)/i.exec(mime || '');
    const rate = rateMatch ? Number(rateMatch[1]) : 24000;
    this.pcmOut.pushPcm16(b64ToBytes(b64), rate || 24000);
  }

  private stopPlayback() {
    this.pcmOut?.clear();
  }

  stop(status?: string) {
    if (this.closed) return;
    this.closed = true;
    window.clearTimeout(this.timer);
    this.stopPlayback();
    this.pcmOut?.dispose();
    this.pcmOut = null;
    this.processor?.disconnect();
    this.processor = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    void this.ctx?.close();
    this.ctx = null;
    this.ui.onMic(false);
    if (status) this.fail(status);
    void fetch('/api/luke-session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: this.userId }),
    }).catch(() => undefined);
  }
}
