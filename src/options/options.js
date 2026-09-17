import { normalizeHostname } from "../shared/config.js";

const enabledInput = document.querySelector("#enabled");
const countElement = document.querySelector("#blocked-count");
const eventsElement = document.querySelector("#events");
const emptyElement = document.querySelector("#empty");
const clearButton = document.querySelector("#clear");
const siteForm = document.querySelector("#site-form");
const siteInput = document.querySelector("#site-input");
const siteError = document.querySelector("#site-error");
const sitesElement = document.querySelector("#sites");

const EVENT_LABELS = {
  "child-tab-blocked": "关闭未授权标签",
  "navigation-blocked": "阻止外部导航",
  "overlay-blocked": "移除全屏覆盖层",
  "popup-blocked": "阻止弹窗调用",
  "top-level-navigation-blocked": "恢复安全页面",
};

function renderEvents(events) {
  eventsElement.replaceChildren();
  for (const event of [...events].reverse().slice(0, 30)) {
    const item = document.createElement("li");
    const label = document.createElement("strong");
    const domain = document.createElement("span");
    const time = document.createElement("time");
    label.textContent = EVENT_LABELS[event.kind] ?? "阻止可疑行为";
    domain.className = "domain";
    domain.textContent = event.destinationHostname || event.hostname || "未知域名";
    time.dateTime = new Date(event.timestamp).toISOString();
    time.textContent = new Date(event.timestamp).toLocaleString();
    item.append(label, domain, time);
    eventsElement.append(item);
  }
  emptyElement.hidden = events.length > 0;
}

function permissionPattern(hostname) {
  return `https://*.${hostname}/*`;
}

function parsedHostname(value) {
  try {
    const withScheme = /^[a-z]+:\/\//i.test(value) ? value : `https://${value}`;
    return normalizeHostname(new URL(withScheme).hostname);
  } catch {
    return "";
  }
}

function renderSites(sites) {
  sitesElement.replaceChildren();
  for (const site of sites) {
    const item = document.createElement("li");
    const hostname = document.createElement("code");
    const remove = document.createElement("button");
    hostname.textContent = site;
    remove.type = "button";
    remove.textContent = "移除";
    remove.addEventListener("click", async () => {
      const state = await chrome.storage.local.get({ strictSites: [] });
      await chrome.storage.local.set({
        strictSites: state.strictSites.filter((hostname) => hostname !== site),
      });
      await chrome.permissions.remove({ origins: [permissionPattern(site)] });
      await load();
    });
    item.append(hostname, remove);
    sitesElement.append(item);
  }
}

async function load() {
  const state = await chrome.storage.local.get({
    blockedCount: 0,
    enabled: true,
    eventLog: [],
    strictSites: [],
  });
  enabledInput.checked = Boolean(state.enabled);
  countElement.textContent = String(state.blockedCount);
  renderEvents(state.eventLog);
  renderSites(state.strictSites);
}

enabledInput.addEventListener("change", () => {
  void chrome.storage.local.set({ enabled: enabledInput.checked });
});

clearButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "activity:clear" });
  await load();
});

siteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  siteError.hidden = true;
  const hostname = parsedHostname(siteInput.value);
  if (!hostname) {
    siteError.textContent = "请输入有效域名。";
    siteError.hidden = false;
    return;
  }

  const granted = await chrome.permissions.request({
    origins: [permissionPattern(hostname)],
  });
  if (!granted) {
    siteError.textContent = "未获得该站点的访问权限。";
    siteError.hidden = false;
    return;
  }

  const state = await chrome.storage.local.get({ strictSites: [] });
  await chrome.storage.local.set({
    strictSites: [...new Set([...state.strictSites, hostname])],
  });
  siteInput.value = "";
  await load();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.blockedCount || changes.eventLog || changes.strictSites)) {
    void load();
  }
});

void load();
