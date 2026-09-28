// Run: node scripts/discovery-check.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const source = readFileSync(new URL('../src/discovery.ts', import.meta.url), 'utf8');
const { discoverRobot, isLukeHostname } = await import('data:text/javascript;base64,' + Buffer.from(compile(source)).toString('base64'));
const robot = { type: 'luke-robot', version: 1, id: 'Luke-A1B2C3', host: 'Luke-A1B2C3.local', ip: '192.168.1.42', ready: true };
const calls = [];
let payload = robot;
let ok = true;
globalThis.fetch = async (url, options) => {
  calls.push(url);
  assert.equal(options.redirect, 'error');
  assert.equal(options.credentials, 'omit');
  assert.equal(options.cache, 'no-store');
  return { ok, json: async () => payload };
};
assert.equal(isLukeHostname('Luke-A1B2C3.local'), true);
assert.equal(isLukeHostname('Luke-A1B2C3.local.evil.test'), false);
assert.deepEqual(await discoverRobot(new AbortController().signal), robot);
assert.deepEqual(calls, ['http://luke.local/.well-known/luke']);
for (const invalid of [null, {}, { ...robot, type: 'router' }, { ...robot, ready: 'true' },
  { ...robot, host: 'evil.test' }, { ...robot, ip: '192.168.1.999' }, { ...robot, ip: '8.8.8.8' },
  { ...robot, id: '<script>' }, { ...robot, version: 2 }]) {
  payload = invalid;
  assert.equal(await discoverRobot(new AbortController().signal), null);
}
payload = { ...robot, ready: false };
assert.equal((await discoverRobot(new AbortController().signal)).ready, false);
payload = robot;
ok = false; assert.equal(await discoverRobot(new AbortController().signal), null); ok = true;
calls.length = 0;
await discoverRobot(new AbortController().signal, '127.0.0.1:8080');
assert.deepEqual(calls, ['http://luke.local/.well-known/luke'], 'Never fetch untrusted saved addresses');
calls.length = 0;
await discoverRobot(new AbortController().signal, 'Luke-A1B2C3.local');
assert.equal(calls.length, 1, 'Prefer known unique host before shared bootstrap alias');
const cancelled = new AbortController(); cancelled.abort(); calls.length = 0;
assert.equal(await discoverRobot(cancelled.signal), null); assert.equal(calls.length, 0);
const inFlight = new AbortController();
globalThis.fetch = async () => { inFlight.abort(); return { ok: true, json: async () => robot }; };
assert.equal(await discoverRobot(inFlight.signal), null, 'Ignore completion after leaving the page');
globalThis.fetch = async () => { throw new TypeError('Permission denied / mixed content / offline'); };
assert.equal(await discoverRobot(new AbortController().signal), null);

const assembly = readFileSync(new URL('../src/pages/Assembly.ts', import.meta.url), 'utf8');
const start = assembly.indexOf('  const discoveryStatus');
const end = assembly.indexOf('  let lastRole:', start);
assert(start > 0 && end > start);
const lifecycle = compile(assembly.slice(start, end));
function page(result, step = 14) {
  const events = new Map();
  const timers = new Map();
  const status = { textContent: '' };
  const saved = [];
  let probes = 0;
  const context = {
    AbortController, currentStepIndex: step,
    container: { querySelector: () => status },
    document: { hidden: false, addEventListener: (name, fn) => events.set(name, fn) },
    window: {
      addEventListener: (name, fn) => events.set(name, fn),
      clearTimeout: id => timers.delete(id),
      setTimeout: fn => { timers.set(1, fn); return 1; },
    },
    location: { hash: '#luke-step-14' },
    getHost: () => '', setHost: host => saved.push(host),
    discoverRobot: async () => { probes++; return typeof result === 'function' ? result() : result; },
  };
  runInNewContext(lifecycle + '\nwindow.check = checkForRobot; window.stop = stopDiscovery;', context);
  return { context, events, timers, status, saved, probes: () => probes };
}
let p = page(null);
await p.context.window.check();
assert.equal(p.context.location.hash, '#luke-step-14'); assert.equal(p.timers.size, 1);
p = page({ ...robot, ready: false }); await p.context.window.check();
assert.equal(p.context.location.hash, '#luke-step-14'); assert.match(p.status.textContent, /startup/);
p = page(robot); await p.context.window.check();
assert.equal(p.context.location.hash, '#control'); assert.deepEqual(p.saved, [robot.host]);
p = page(robot, 13); await p.context.window.check(); assert.equal(p.probes(), 0);
p = page(robot); p.context.document.hidden = true;
await p.context.window.check(); assert.equal(p.probes(), 0);
p.context.document.hidden = false; p.events.get('visibilitychange')();
await new Promise(resolve => setImmediate(resolve)); assert.equal(p.context.location.hash, '#control');
let resolveProbe;
p = page(() => new Promise(resolve => { resolveProbe = resolve; }));
const pending = p.context.window.check();
await p.context.window.check(); assert.equal(p.probes(), 1, 'Never overlap discovery probes');
p.context.window.stop(); resolveProbe(robot); await pending;
assert.equal(p.context.location.hash, '#luke-step-14'); assert.equal(p.saved.length, 0);
console.log('Discovery validation, readiness, cancellation and assembly lifecycle checks passed.');

const control = readFileSync(new URL('../src/pages/Control.ts', import.meta.url), 'utf8');
const selection = compile(control.slice(control.indexOf('  const discovered ='), control.indexOf('  const jointTable =')));
for (const candidate of ['Luke-A1B2C3.local', 'evil.test', 'Luke-A1B2C3.local.evil.test', 'Luke-A1B2C3.local:80']) {
  const selected = [];
  let wsCalls = 0;
  const context = {
    URL, location: { href: 'https://lukerobotarm.com/?luke=' + encodeURIComponent(candidate) + '#control' },
    history: { replaceState() {} },
    getDiscoveredRobot: () => null, isLukeHostname,
    getHost: () => '192.168.4.1', setHost: host => selected.push(host),
    disconnect() {}, renderRobots() {}, showFound() {}, showVirtual() {},
    isVirtual: () => false, isConnected: () => false,
    connect: () => { wsCalls++; }, statusEl: { textContent: '' },
    window: { setTimeout: () => 1 },
    selectedId: '', searchTimer: 0, VIRTUAL_ROBOT: {}, SEARCH_MS: 2500,
  };
  runInNewContext(selection, context);
  assert.equal(selected.length, isLukeHostname(candidate) ? 1 : 0);
  if (isLukeHostname(candidate)) assert.equal(wsCalls, 0, 'HTTP robot must not use dummy WebSocket protocol');
}
console.log('Controller hostname handoff checks passed.');

// Optional firmware source argument also checks the direct-browser fallback script.
if (process.argv[2]) {
  const firmware = readFileSync(process.argv[2], 'utf8');
  const fallback = firmware.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert(fallback, 'Firmware discovery fallback script must exist');
  for (const ready of [false, true]) {
    const destination = [];
    const timers = new Map();
    let timerId = 0;
    runInNewContext(fallback, {
      AbortController,
      fetch: async () => ({ ok: true, json: async () => ({ ...robot, ready }) }),
      location: { replace: url => destination.push(url) },
      document: { getElementById: () => ({ textContent: '' }) },
      setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
      clearTimeout: id => timers.delete(id),
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(destination, ready ? ['https://lukerobotarm.com/?luke=Luke-A1B2C3.local#control'] : []);
    assert.equal(timers.size, ready ? 0 : 1);
  }
  console.log('Firmware browser fallback readiness and redirect checks passed.');
}
