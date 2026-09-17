import assert from "node:assert/strict";
import test from "node:test";

await import("../src/content/overlay-core.js");
const core = globalThis.NoRedirectOverlayCore;

test("removes a click-intercepting full-screen offer", () => {
  assert.equal(core.shouldRemoveOverlay({
    areaRatio: 1,
    crossOrigin: false,
    dangerousSandbox: false,
    frameTitle: "offer",
    opaqueSource: true,
    pointerEvents: "auto",
    position: "fixed",
    zIndex: "2147483647",
  }), true);
});

test("keeps a normal embedded frame", () => {
  assert.equal(core.shouldRemoveOverlay({
    areaRatio: 0.2,
    crossOrigin: true,
    dangerousSandbox: false,
    frameTitle: "video",
    opaqueSource: false,
    pointerEvents: "auto",
    position: "static",
    zIndex: "auto",
  }), false);
});

test("keeps a same-origin application dialog", () => {
  assert.equal(core.shouldRemoveOverlay({
    areaRatio: 0.8,
    crossOrigin: false,
    dangerousSandbox: false,
    frameTitle: "checkout",
    opaqueSource: false,
    pointerEvents: "auto",
    position: "fixed",
    zIndex: "200000",
  }), false);
});

test("detects popup sandbox capabilities", () => {
  assert.equal(core.hasDangerousSandbox("allow-scripts allow-popups"), true);
  assert.equal(core.hasDangerousSandbox("allow-scripts allow-forms"), false);
});
