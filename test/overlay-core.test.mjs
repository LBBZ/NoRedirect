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

const notificationAd = { areaRatio: 0.08, position: "fixed", pointerEvents: "auto", zIndex: "2147483647",
  opaqueSource: true, adLabel: true, externalImage: true, notificationActions: true };
test("removes small explicitly marked notification ads", () => {
  assert.equal(Boolean(core.shouldRemoveOverlay(notificationAd)), true);
});
test("keeps small panels without the combined advertising evidence", () => {
  for (const key of ["opaqueSource", "adLabel", "externalImage", "notificationActions"]) {
    assert.equal(Boolean(core.shouldRemoveOverlay({ ...notificationAd, [key]: false })), false);
  }
  assert.equal(Boolean(core.shouldRemoveOverlay({ ...notificationAd, position: "static" })), false);
  assert.equal(Boolean(core.shouldRemoveOverlay({ ...notificationAd, pointerEvents: "none" })), false);
  assert.equal(Boolean(core.shouldRemoveOverlay({ ...notificationAd, areaRatio: 0 })), false);
});
