/**
 * GET /api/catalog — prices + connect-page joint limits.
 * Database Luke on LUKE_MONGO_URL (same host style as towersgame: AiDatabases).
 * Collections: prices (_id shop), control (_id joints).
 * No URL, or Mongo down: seed in price-math.mjs. First successful connect inserts
 * the seed only when the doc is missing; later edits in Mongo win over the file.
 * Ceiling: 30s in-process cache. Upgrade: drop it when there is an admin write route.
 */
import { MongoClient } from 'mongodb';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SEED, normalizeJoints, normalizePrices, selfCheck } from './price-math.mjs';

const TTL_MS = 30_000;
let client;
let cached = null;
let cachedAt = 0;

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

async function mongoCatalog() {
  const url = process.env.LUKE_MONGO_URL;
  if (!url) return null;
  if (!client) client = new MongoClient(url, { serverSelectionTimeoutMS: 800 });
  await client.connect();
  const db = client.db();
  const pricesCol = db.collection('prices');
  const controlCol = db.collection('control');
  await pricesCol.updateOne(
    { _id: 'shop' },
    { $setOnInsert: { models: SEED.prices.models, addons: SEED.prices.addons } },
    { upsert: true },
  );
  await controlCol.updateOne(
    { _id: 'joints' },
    { $setOnInsert: { joints: SEED.control.joints } },
    { upsert: true },
  );
  const [priceDoc, controlDoc] = await Promise.all([
    pricesCol.findOne({ _id: 'shop' }),
    controlCol.findOne({ _id: 'joints' }),
  ]);
  const prices = normalizePrices(priceDoc) || SEED.prices;
  const joints = normalizeJoints(controlDoc?.joints) || SEED.control.joints;
  return { prices, control: { joints } };
}

export async function readCatalog() {
  if (cached && Date.now() - cachedAt < TTL_MS) return { catalog: cached, source: 'mongo' };
  try {
    const catalog = await mongoCatalog();
    if (!catalog) return { catalog: SEED, source: 'seed' };
    cached = catalog;
    cachedAt = Date.now();
    return { catalog, source: 'mongo' };
  } catch (err) {
    console.error('[catalog]', err instanceof Error ? err.message : err);
    if (cached) return { catalog: cached, source: 'mongo' };
    return { catalog: SEED, source: 'seed' };
  }
}

export function isCatalogApi(url) {
  const path = (url || '/').split('?')[0];
  return path === '/api/catalog' || path.endsWith('/api/catalog');
}

export async function handleCatalogRequest(req) {
  if (req?.method === 'OPTIONS') return { status: 204, json: null };
  if (req?.method && req.method !== 'GET') return { status: 405, json: { error: 'GET only' } };
  const body = await readCatalog();
  return { status: 200, json: body };
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direct && process.argv.includes('--self-check')) {
  selfCheck();
  console.log('prices self-check ok');
  process.exit(0);
}

if (direct && process.argv.includes('--seed')) {
  loadDotEnv();
  const { catalog, source } = await readCatalog();
  const m = catalog.prices.models;
  console.log(`catalog source=${source} mini=${m.mini} standard=${m.standard} pro=${m.pro} joints=${catalog.control.joints.length}`);
  if (client) await client.close();
  process.exit(source === 'mongo' || !process.env.LUKE_MONGO_URL ? 0 : 1);
}
