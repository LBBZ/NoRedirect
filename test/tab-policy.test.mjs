import assert from "node:assert/strict";
import test from "node:test";

import {
  comparableUrl,
  decideChildNavigation,
  intentMatches,
  makeIntent,
} from "../src/background/tab-policy.js";

const strictSites = ["reader.example.test"];

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
