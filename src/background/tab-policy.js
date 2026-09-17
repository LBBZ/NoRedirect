import { isProtectedUrl } from "../shared/config.js";

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
