const statusElement = document.querySelector("#status");
const countElement = document.querySelector("#blocked-count");
const enabledInput = document.querySelector("#enabled");
const optionsButton = document.querySelector("#options");

function renderEnabled(enabled) {
  enabledInput.checked = enabled;
  statusElement.textContent = enabled ? "保护已启用" : "保护已暂停";
}

async function load() {
  const state = await chrome.storage.local.get({ blockedCount: 0, enabled: true });
  countElement.textContent = String(state.blockedCount);
  renderEnabled(Boolean(state.enabled));
}

enabledInput.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: enabledInput.checked });
  renderEnabled(enabledInput.checked);
});

optionsButton.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
});

void load();
