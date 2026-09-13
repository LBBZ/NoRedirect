import assert from "node:assert/strict";
import test from "node:test";

await import("../src/page/navigation-core.js");
const core = globalThis.NoRedirectNavigationCore;

const defaults = {
  baseUrl: "https://reader.example.test/item/1",
  currentOrigin: "https://reader.example.test",
  enabled: true,
  now: 1_000,
  trustedDestination: "",
  trustedUntil: 0,
};

test("allows same-origin navigation", () => {
  assert.equal(core.shouldAllowWindowOpen({
    ...defaults,
    destination: "/item/2",
  }), true);
});

test("blocks an unrelated external popup", () => {
  assert.equal(core.shouldAllowWindowOpen({
    ...defaults,
    destination: "https://ads.example.test/landing",
  }), false);
});

test("allows one matching user-authorized destination", () => {
  assert.equal(core.shouldAllowWindowOpen({
    ...defaults,
    destination: "https://docs.example.test/help",
    trustedDestination: "https://docs.example.test/help",
    trustedUntil: 1_500,
  }), true);
});

test("rejects expired and mismatched authorization", () => {
  assert.equal(core.shouldAllowWindowOpen({
    ...defaults,
    destination: "https://ads.example.test/landing",
    trustedDestination: "https://docs.example.test/help",
    trustedUntil: 1_500,
  }), false);
  assert.equal(core.shouldAllowWindowOpen({
    ...defaults,
    destination: "https://docs.example.test/help",
    trustedDestination: "https://docs.example.test/help",
    trustedUntil: 999,
  }), false);
});

test("blocks blank popups and permits disabled protection", () => {
  assert.equal(core.shouldAllowWindowOpen({ ...defaults, destination: "" }), false);
  assert.equal(core.shouldAllowWindowOpen({ ...defaults, destination: "", enabled: false }), true);
});
