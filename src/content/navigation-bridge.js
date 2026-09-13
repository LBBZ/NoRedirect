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

  function sendEvent(kind, destination = "") {
    void chrome.runtime.sendMessage({
      type: "protection:event",
      event: {
        destination: safeDestination(destination),
        hostname: location.hostname,
        kind,
        timestamp: Date.now(),
      },
    }).catch(() => {});
  }

  function isDeceptiveFullPageLink(anchor) {
    const rect = anchor.getBoundingClientRect();
    const areaRatio = (rect.width * rect.height) / Math.max(1, innerWidth * innerHeight);
    const style = getComputedStyle(anchor);
    return areaRatio >= 0.6 &&
      (style.position === "fixed" || style.position === "sticky") &&
      (Number.parseInt(style.zIndex, 10) || 0) >= 100_000;
  }

  addEventListener("__noredirect_report__", (event) => {
    const kind = String(event.detail?.kind ?? "");
    if (![
      "navigation-blocked",
      "popup-blocked",
    ].includes(kind)) {
      return;
    }
    sendEvent(kind, event.detail?.destination);
  });

  addEventListener("pointerdown", (event) => {
    if (!event.isTrusted || event.button !== 0 || !(event.target instanceof Element)) {
      return;
    }
    const anchor = event.target.closest("a[href]");
    if (anchor && !isDeceptiveFullPageLink(anchor)) {
      sendEvent("navigation-intent", anchor.href);
    }
  }, true);
})();
