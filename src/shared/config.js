export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  strictSites: [],
  globalBalancedMode: false,
  allowOnceTtlMs: 2_000,
  childTabWatchMs: 5_000,
});

export function normalizeHostname(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\.+|\.+$/g, "");
}

export function hostnameMatches(hostname, configuredHostname) {
  const host = normalizeHostname(hostname);
  const configured = normalizeHostname(configuredHostname);
  return Boolean(configured) && (host === configured || host.endsWith(`.${configured}`));
}

export function isProtectedUrl(url, strictSites = DEFAULT_SETTINGS.strictSites) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && strictSites.some((site) =>
      hostnameMatches(parsed.hostname, site)
    );
  } catch {
    return false;
  }
}

export async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    strictSites: Array.isArray(stored.strictSites)
      ? stored.strictSites.map(normalizeHostname).filter(Boolean)
      : [...DEFAULT_SETTINGS.strictSites],
  };
}

export async function initializeSettings() {
  const existing = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const missing = Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).filter(([key]) => existing[key] === undefined)
  );
  if (Object.keys(missing).length) {
    await chrome.storage.local.set(missing);
  }
}
