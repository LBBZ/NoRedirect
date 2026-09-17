import {
  DEFAULT_SETTINGS,
  getSettings,
  initializeSettings,
  isProtectedUrl,
} from "../shared/config.js";
import {
  decideChildNavigation,
  intentMatches,
  makeIntent,
} from "./tab-policy.js";
import { appendEvent, sanitizeProtectionEvent } from "./event-log.js";
import { registerProtectionScripts } from "./content-registration.js";

const navigationIntents = new Map();
const childTargets = new Map();
const lastSafeUrls = new Map();
const tabBlockCounts = new Map();
let settingsCache = DEFAULT_SETTINGS;
let eventWriteQueue = Promise.resolve();

async function applyNetworkProtection(enabled) {
  await chrome.declarativeNetRequest.updateEnabledRulesets({
    disableRulesetIds: enabled ? [] : ["network_protection"],
    enableRulesetIds: enabled ? ["network_protection"] : [],
  });
}

function recordProtectionEvent(event, tabId) {
  const sanitized = sanitizeProtectionEvent(event, tabId);
  eventWriteQueue = eventWriteQueue.then(async () => {
    const stored = await chrome.storage.local.get({ blockedCount: 0, eventLog: [] });
    await chrome.storage.local.set({
      blockedCount: stored.blockedCount + 1,
      eventLog: appendEvent(stored.eventLog, sanitized),
    });
  });

  if (tabId >= 0) {
    const count = (tabBlockCounts.get(tabId) ?? 0) + 1;
    tabBlockCounts.set(tabId, count);
    void chrome.action.setBadgeBackgroundColor({ color: "#B42318", tabId });
    void chrome.action.setBadgeText({ text: count > 99 ? "99+" : String(count), tabId });
  }
}

void getSettings().then((settings) => {
  settingsCache = settings;
  void applyNetworkProtection(settings.enabled);
  void registerProtectionScripts(settings.enabled ? settings.strictSites : []);
});

async function rememberOpenProtectedTabs() {
  const settings = await getSettings();
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id !== undefined && isProtectedUrl(tab.url, settings.strictSites)) {
      lastSafeUrls.set(tab.id, tab.url);
    }
  }
}

async function closeTab(tabId, sourceTabId, destination) {
  childTargets.delete(tabId);
  recordProtectionEvent({
    destination,
    hostname: "",
    kind: "child-tab-blocked",
  }, sourceTabId);
  await chrome.tabs.remove(tabId).catch(() => {});
}

async function evaluateChildTarget(tabId) {
  const sourceTabId = childTargets.get(tabId);
  if (sourceTabId === undefined) {
    return;
  }

  const [settings, sourceTab, targetTab] = await Promise.all([
    getSettings(),
    chrome.tabs.get(sourceTabId).catch(() => null),
    chrome.tabs.get(tabId).catch(() => null),
  ]);
  if (!settings.enabled || !sourceTab || !targetTab ||
      !isProtectedUrl(sourceTab.url, settings.strictSites)) {
    childTargets.delete(tabId);
    return;
  }

  const destination = targetTab.pendingUrl || targetTab.url || "";
  const decision = decideChildNavigation({
    destination,
    intent: navigationIntents.get(sourceTabId),
    strictSites: settings.strictSites,
  });

  if (decision === "close") {
    await closeTab(tabId, sourceTabId, destination);
  } else if (decision === "allow-intent") {
    navigationIntents.delete(sourceTabId);
    childTargets.delete(tabId);
  }
}

function watchChildTarget(sourceTabId, targetTabId) {
  childTargets.set(targetTabId, sourceTabId);
  setTimeout(() => void evaluateChildTarget(targetTabId), 125);
  setTimeout(() => childTargets.delete(targetTabId), 5_000);
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeSettings().then(() => getSettings()).then((settings) => {
    settingsCache = settings;
    return Promise.all([
      applyNetworkProtection(settings.enabled),
      registerProtectionScripts(settings.enabled ? settings.strictSites : []),
    ]);
  });
});

chrome.runtime.onStartup.addListener(() => {
  void initializeSettings();
  void rememberOpenProtectedTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "settings:get") {
    void getSettings().then(sendResponse);
    return true;
  }

  if (message?.type === "protection:event" && sender.tab?.id !== undefined) {
    if (message.event?.kind === "navigation-intent") {
      navigationIntents.set(
        sender.tab.id,
        makeIntent(message.event.destination, settingsCache.allowOnceTtlMs)
      );
    } else {
      recordProtectionEvent(message.event, sender.tab.id);
    }
    return false;
  }

  if (message?.type === "activity:clear") {
    tabBlockCounts.clear();
    void chrome.tabs.query({}).then((tabs) => Promise.all(tabs.map((tab) =>
      tab.id === undefined ? Promise.resolve() : chrome.action.setBadgeText({ text: "", tabId: tab.id })
    ))).then(() => chrome.storage.local.set({ blockedCount: 0, eventLog: [] })).then(sendResponse);
    return true;
  }

  return false;
});

chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
  watchChildTarget(details.sourceTabId, details.tabId);
});

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id !== undefined && tab.openerTabId !== undefined) {
    watchChildTarget(tab.openerTabId, tab.id);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url && childTargets.has(tabId)) {
    void evaluateChildTarget(tabId);
  }
  if (changeInfo.url) {
    void getSettings().then((settings) => {
      if (isProtectedUrl(changeInfo.url, settings.strictSites)) {
        lastSafeUrls.set(tabId, changeInfo.url);
      }
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  childTargets.delete(tabId);
  lastSafeUrls.delete(tabId);
  navigationIntents.delete(tabId);
  tabBlockCounts.delete(tabId);
});

chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId !== 0 || !lastSafeUrls.has(details.tabId)) {
    return;
  }

  void getSettings().then(async (settings) => {
    if (!settings.enabled || isProtectedUrl(details.url, settings.strictSites)) {
      return;
    }

    const intent = navigationIntents.get(details.tabId);
    if (intentMatches(intent, details.url)) {
      navigationIntents.delete(details.tabId);
      lastSafeUrls.delete(details.tabId);
      return;
    }

    const safeUrl = lastSafeUrls.get(details.tabId);
    if (safeUrl) {
      recordProtectionEvent({
        destination: details.url,
        hostname: new URL(safeUrl).hostname,
        kind: "top-level-navigation-blocked",
      }, details.tabId);
      await chrome.tabs.update(details.tabId, { url: safeUrl }).catch(() => {});
    }
  });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (changes.enabled) {
    settingsCache = { ...settingsCache, enabled: Boolean(changes.enabled.newValue) };
    void applyNetworkProtection(settingsCache.enabled);
    void registerProtectionScripts(settingsCache.enabled ? settingsCache.strictSites : []);
  }
  if (changes.allowOnceTtlMs) {
    settingsCache = { ...settingsCache, allowOnceTtlMs: changes.allowOnceTtlMs.newValue };
  }
  if (changes.strictSites) {
    settingsCache = { ...settingsCache, strictSites: changes.strictSites.newValue };
    void registerProtectionScripts(settingsCache.enabled ? settingsCache.strictSites : []);
  }
});

void rememberOpenProtectedTabs();
