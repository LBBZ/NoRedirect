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

const navigationIntents = new Map();
const childTargets = new Map();
const lastSafeUrls = new Map();
let settingsCache = DEFAULT_SETTINGS;

void getSettings().then((settings) => {
  settingsCache = settings;
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

async function closeTab(tabId) {
  childTargets.delete(tabId);
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
    await closeTab(tabId);
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
  void initializeSettings();
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
    }
    return false;
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
      await chrome.tabs.update(details.tabId, { url: safeUrl }).catch(() => {});
    }
  });
});

void rememberOpenProtectedTabs();
