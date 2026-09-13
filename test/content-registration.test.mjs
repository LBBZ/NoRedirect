import assert from "node:assert/strict";
import test from "node:test";

import { siteMatchPatterns } from "../src/background/content-registration.js";

test("builds HTTPS match patterns for configured domains and subdomains", () => {
  assert.deepEqual(siteMatchPatterns(["Example.COM", "example.com", "reader.test"]), [
    "https://example.com/*",
    "https://*.example.com/*",
    "https://reader.test/*",
    "https://*.reader.test/*",
  ]);
});

test("ignores empty site entries", () => {
  assert.deepEqual(siteMatchPatterns(["", "  "]), []);
});
