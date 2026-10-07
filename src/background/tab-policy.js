import { isProtectedUrl } from "../shared/config.js";

// Browser-owned pages are not advertising destinations, even with an opener tab.
export function isBrowserPage(value) {
  try {
    const url = new URL(value);
    return Boolean(url.hostname) && ["chrome:", "chrome-search:", "chrome-extension:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function comparableUrl(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

export function intentMatches(intent, destination, now = Date.now()) {
  return Boolean(
    intent &&
    intent.expiresAt >= now &&
    comparableUrl(intent.destination) === comparableUrl(destination)
  );
}

export function decideChildNavigation({
  destination,
  intent,
  now = Date.now(),
  strictSites,
}) {
  if (!destination || destination === "about:blank") {
    return "watch";
  }
  if (isBrowserPage(destination)) {
    return "allow-browser";
  }
  if (isProtectedUrl(destination, strictSites)) {
    return "allow-protected";
  }
  if (intentMatches(intent, destination, now)) {
    return "allow-intent";
  }
  return "close";
}

export function makeIntent(destination, ttlMs, now = Date.now()) {
  return {
    destination: comparableUrl(destination),
    expiresAt: now + ttlMs,
  };
}
