(() => {
  if (window.top !== window) {
    return;
  }

  function safeDestination(value) {
    try {
      const parsed = new URL(value, location.href);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return "";
    }
  }

  addEventListener("__noredirect_report__", (event) => {
    const kind = String(event.detail?.kind ?? "");
    if (![
      "navigation-blocked",
      "navigation-intent",
      "popup-blocked",
    ].includes(kind)) {
      return;
    }

    void chrome.runtime.sendMessage({
      type: "protection:event",
      event: {
        destination: safeDestination(event.detail?.destination),
        hostname: location.hostname,
        kind,
        timestamp: Date.now(),
      },
    }).catch(() => {});
  });

  chrome.storage.local.get({ enabled: true }).then(({ enabled }) => {
    dispatchEvent(new CustomEvent("__noredirect_config__", {
      detail: { enabled: Boolean(enabled) },
    }));
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.enabled) {
      dispatchEvent(new CustomEvent("__noredirect_config__", {
        detail: { enabled: Boolean(changes.enabled.newValue) },
      }));
    }
  });
})();
