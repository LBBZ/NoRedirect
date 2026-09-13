import { normalizeHostname } from "../shared/config.js";

export const CONTENT_SCRIPT_IDS = Object.freeze([
  "noredirect-main-world",
  "noredirect-isolated-world",
]);

export function siteMatchPatterns(strictSites) {
  return [...new Set(strictSites.flatMap((site) => {
    const hostname = normalizeHostname(site);
    if (!hostname) {
      return [];
    }
    return [
      `https://${hostname}/*`,
      `https://*.${hostname}/*`,
    ];
  }))];
}

export async function registerProtectionScripts(strictSites) {
  await chrome.scripting.unregisterContentScripts({ ids: CONTENT_SCRIPT_IDS }).catch(() => {});
  const matches = siteMatchPatterns(strictSites);
  if (!matches.length) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_IDS[0],
      js: [
        "src/page/navigation-core.js",
        "src/page/navigation-guard.js",
      ],
      matches,
      persistAcrossSessions: true,
      runAt: "document_start",
      world: "MAIN",
    },
    {
      id: CONTENT_SCRIPT_IDS[1],
      js: [
        "src/content/overlay-core.js",
        "src/content/overlay-guard.js",
        "src/content/navigation-bridge.js",
      ],
      matches,
      persistAcrossSessions: true,
      runAt: "document_start",
      world: "ISOLATED",
    },
  ]);
}
