import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const events = new Map();
const media = { matches: false, addEventListener() {}, removeEventListener() {} };
const window = { isSecureContext: true, matchMedia: () => media,
  addEventListener: (name, fn) => events.set(name, [...(events.get(name) || []), fn]),
  removeEventListener() {} };
const exports = {};
runInNewContext(ts.transpile(readFileSync(new URL('../src/install.ts', import.meta.url), 'utf8'),
  { module: ts.ModuleKind.CommonJS }), { window, navigator: { userAgent: 'iPhone' }, exports });
const button = { addEventListener: (_, fn) => { button.click = fn; } };
const help = {};
exports.bindInstallButton({ querySelector: (selector) => selector === '#installApp' ? button : help });
assert.equal(button.hidden, false);
await button.click();
assert.match(help.textContent, /Safari.*Add to Home Screen/);
let prompted = false;
events.get('beforeinstallprompt')[0]({ preventDefault() {}, prompt: async () => { prompted = true; },
  userChoice: Promise.resolve({ outcome: 'dismissed' }) });
await button.click();
assert.equal(prompted, true);
assert.equal(button.disabled, false);
assert.match(help.textContent, /cancelled/);
events.get('beforeinstallprompt')[0]({ preventDefault() {}, prompt: async () => { throw Error('unavailable'); } });
await button.click();
assert.match(help.textContent, /unavailable/);
assert.equal(button.disabled, false);
for (const listener of events.get('appinstalled')) listener();
assert.equal(button.hidden, true);
window.isSecureContext = false;
media.matches = false;
exports.bindInstallButton({ querySelector: (selector) => selector === '#installApp' ? button : help });
assert.equal(button.hidden, true);
console.log('Install checks passed');
