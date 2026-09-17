import assert from "node:assert/strict";
import test from "node:test";

import {
  appendEvent,
  sanitizeProtectionEvent,
} from "../src/background/event-log.js";

test("stores only hostnames instead of sensitive destination details", () => {
  assert.deepEqual(sanitizeProtectionEvent({
    destination: "https://ads.example.test/path?tracking=secret",
    hostname: "reader.example.test",
    kind: "popup-blocked",
  }, 7, 123), {
    destinationHostname: "ads.example.test",
    hostname: "reader.example.test",
    kind: "popup-blocked",
    tabId: 7,
    timestamp: 123,
  });
});

test("caps the activity log", () => {
  const events = [{ id: 1 }, { id: 2 }, { id: 3 }];
  assert.deepEqual(appendEvent(events, { id: 4 }, 2), [{ id: 3 }, { id: 4 }]);
});
