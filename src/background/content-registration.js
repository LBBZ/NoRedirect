import { normalizeHostname } from "../shared/config.js";

export const CONTENT_SCRIPT_IDS = Object.freeze([
  "noredirect-main-world",
  "noredirect-isolated-world",
]);
let registrationQueue = Promise.resolve();

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

async function replaceProtectionScripts(strictSites) {
  await chrome.scripting.unregisterContentScripts({ ids: CONTENT_SCRIPT_IDS }).catch(() => {});
  const permittedSites = [];
  for (const site of strictSites) {
    const hostname = normalizeHostname(site);
    if (hostname && await chrome.permissions.contains({
      origins: [`https://*.${hostname}/*`],
    })) {
      permittedSites.push(hostname);
    }
  }
  const matches = siteMatchPatterns(permittedSites);
  if (!matches.length) {
    return;
  }

  await chrome.scripting.registerContentScripts([
    {
      id: CONTENT_SCRIPT_IDS[0],
      allFrames: true,
      js: [
        "src/page/navigation-core.js",
        "src/page/navigation-guard.js",
      ],
      matches,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
      runAt: "document_start",
      world: "MAIN",
    },
    {
      id: CONTENT_SCRIPT_IDS[1],
      allFrames: true,
      js: [
        "src/content/overlay-core.js",
        "src/content/overlay-guard.js",
        "src/content/navigation-bridge.js",
      ],
      matches,
      matchOriginAsFallback: true,
      persistAcrossSessions: true,
      runAt: "document_start",
      world: "ISOLATED",
    },
  ]);
}

export function registerProtectionScripts(strictSites) {
  const snapshot = [...strictSites];
  registrationQueue = registrationQueue
    .catch(() => {})
    .then(() => replaceProtectionScripts(snapshot));
  return registrationQueue;
}
