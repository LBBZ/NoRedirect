const ALLOWED_KINDS = new Set([
  "child-tab-blocked",
  "navigation-blocked",
  "overlay-blocked",
  "popup-blocked",
  "top-level-navigation-blocked",
]);

export function hostnameFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

export function sanitizeProtectionEvent(event, tabId, now = Date.now()) {
  const kind = ALLOWED_KINDS.has(event?.kind) ? event.kind : "navigation-blocked";
  return {
    destinationHostname: hostnameFromUrl(event?.destination),
    hostname: String(event?.hostname ?? "").slice(0, 253),
    kind,
    tabId: Number.isInteger(tabId) ? tabId : -1,
    timestamp: now,
  };
}

export function appendEvent(events, event, limit = 100) {
  return [...events, event].slice(-limit);
}
