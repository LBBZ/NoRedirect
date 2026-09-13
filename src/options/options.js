const enabledInput = document.querySelector("#enabled");
const countElement = document.querySelector("#blocked-count");
const eventsElement = document.querySelector("#events");
const emptyElement = document.querySelector("#empty");
const clearButton = document.querySelector("#clear");

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

async function load() {
  const state = await chrome.storage.local.get({
    blockedCount: 0,
    enabled: true,
    eventLog: [],
  });
  enabledInput.checked = Boolean(state.enabled);
  countElement.textContent = String(state.blockedCount);
  renderEvents(state.eventLog);
}

enabledInput.addEventListener("change", () => {
  void chrome.storage.local.set({ enabled: enabledInput.checked });
});

clearButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "activity:clear" });
  await load();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && (changes.blockedCount || changes.eventLog)) {
    void load();
  }
});

void load();
