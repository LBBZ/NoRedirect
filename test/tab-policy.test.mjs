import assert from "node:assert/strict";
import test from "node:test";

import {
  comparableUrl,
  decideChildNavigation,
  intentMatches,
  isBrowserPage,
  makeIntent,
} from "../src/background/tab-policy.js";

const strictSites = ["reader.example.test"];

test("allows browser new tabs, settings and extension pages", () => {
  for (const destination of ["chrome://newtab/", "chrome://extensions/", "chrome://settings/", "chrome-search://local-ntp/local-ntp.html", "chrome-extension://abcdefghijklmnop/options.html"]) {
    assert.equal(isBrowserPage(destination), true);
    assert.equal(decideChildNavigation({ destination, strictSites }), "allow-browser");
  }
});

test("browser-like hostnames and unsafe protocols do not bypass protection", () => {
  for (const destination of ["https://newtab/", "https://chrome.example/", "javascript:alert(1)", "data:text/html,test", "not a url", "chrome:"]) {
    assert.equal(isBrowserPage(destination), false);
    assert.equal(decideChildNavigation({ destination, strictSites }), "close");
  }
});

test("blank popup remains watched and its later external destination is blocked", () => {
  assert.equal(decideChildNavigation({ destination: "", strictSites }), "watch");
  assert.equal(decideChildNavigation({ destination: "about:blank", strictSites }), "watch");
  assert.equal(decideChildNavigation({ destination: "https://ads.example.test/", strictSites }), "close");
});

test("watches blank child targets for delayed navigation", () => {
  assert.equal(decideChildNavigation({ destination: "about:blank", strictSites }), "watch");
});

test("allows protected child navigation", () => {
  assert.equal(decideChildNavigation({
    destination: "https://reader.example.test/item/2",
    strictSites,
  }), "allow-protected");
});

test("closes an unauthorized external child", () => {
  assert.equal(decideChildNavigation({
    destination: "https://ads.example.test/landing",
    strictSites,
  }), "close");
});

test("consumes a matching unexpired navigation intent", () => {
  const intent = makeIntent("https://docs.example.test/help?q=private", 2_000, 1_000);
  assert.equal(comparableUrl(intent.destination), "https://docs.example.test/help");
  assert.equal(intentMatches(intent, "https://docs.example.test/help#topic", 2_000), true);
  assert.equal(decideChildNavigation({
    destination: "https://docs.example.test/help#topic",
    intent,
    now: 2_000,
    strictSites,
  }), "allow-intent");
});

test("rejects an expired navigation intent", () => {
  const intent = makeIntent("https://docs.example.test/help", 100, 1_000);
  assert.equal(intentMatches(intent, "https://docs.example.test/help", 1_101), false);
});
