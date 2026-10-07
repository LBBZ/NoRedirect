import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import * as policy from "../src/background/tab-policy.js";
import { DEFAULT_SETTINGS, isProtectedUrl } from "../src/shared/config.js";
const tick = () => new Promise(resolve => setImmediate(resolve));

async function worker() {
  const settings = { ...DEFAULT_SETTINGS, strictSites: ["reader.example.test"] };
  const tabs = new Map([[1, { id: 1, url: "https://reader.example.test/" }]]);
  const removed = [], updated = [], timers = [];
  const event = () => ({ addListener(fn) { this.fire = fn; } });
  const chrome = {
    tabs: { query: async () => [...tabs.values()], get: async id => tabs.get(id),
      remove: async id => removed.push(id), update: async (id, options) => updated.push({ id, ...options }),
      onCreated: event(), onUpdated: event(), onRemoved: event() },
    runtime: { onInstalled: event(), onStartup: event(), onMessage: event() },
    webNavigation: { onCreatedNavigationTarget: event(), onBeforeNavigate: event() },
    storage: { local: { get: async defaults => defaults, set: async () => {} }, onChanged: event() },
    action: { setBadgeBackgroundColor: async () => {}, setBadgeText: async () => {} },
    declarativeNetRequest: { updateEnabledRulesets: async () => {} }
  };
  const source = fs.readFileSync(new URL('../src/background/service-worker.js', import.meta.url), 'utf8')
    .replace(/import\s+[\s\S]*?from\s+"[^"]+";\s*/g, '');
  vm.runInNewContext(source, { ...policy, chrome, DEFAULT_SETTINGS, isProtectedUrl,
    getSettings: async () => settings, initializeSettings: async () => {}, registerProtectionScripts: async () => {},
    sanitizeProtectionEvent: e => e, appendEvent: (events, event) => [...events, event],
    setTimeout: (fn, ms) => timers.push({ fn, ms }), URL });
  await tick();
  const evaluate = async () => { timers.filter(t => t.ms === 125).splice(0).forEach(t => t.fn()); await tick(); };
  return { tabs, chrome, removed, updated, evaluate };
}

test('new browser tab with an opener stays open and is released from popup tracking', async () => {
  const w = await worker();
  w.tabs.set(2, { id:2, url:'chrome://newtab/' });
  w.chrome.tabs.onCreated.fire({ id:2, openerTabId:1 });
  w.chrome.webNavigation.onCreatedNavigationTarget.fire({ sourceTabId:1, tabId:2 });
  await w.evaluate();
  w.tabs.set(2, { id:2, url:'https://search.example.test/' });
  w.chrome.tabs.onUpdated.fire(2, { url:'https://search.example.test/' }); await tick();
  assert.deepEqual(w.removed, []);
});

test('blank script popup still closes after navigating to an unapproved destination', async () => {
  const w = await worker();
  w.tabs.set(2, { id:2, url:'about:blank' });
  w.chrome.tabs.onCreated.fire({ id:2, openerTabId:1 }); await w.evaluate();
  assert.deepEqual(w.removed, []);
  w.tabs.set(2, { id:2, url:'https://ads.example.test/' });
  w.chrome.tabs.onUpdated.fire(2, { url:'https://ads.example.test/' }); await tick();
  assert.deepEqual(w.removed, [2]);
});

test('browser settings navigation is not bounced back to the protected website', async () => {
  const w = await worker();
  w.chrome.webNavigation.onBeforeNavigate.fire({ tabId:1, frameId:0, url:'chrome://settings/' }); await tick();
  w.chrome.webNavigation.onBeforeNavigate.fire({ tabId:1, frameId:0, url:'https://search.example.test/' }); await tick();
  assert.deepEqual(w.updated, []);
});
