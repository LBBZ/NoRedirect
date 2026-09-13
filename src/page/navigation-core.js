((root) => {
  function normalizeDestination(value, baseUrl) {
    if (value === undefined || value === null || value === "") {
      return "about:blank";
    }
    try {
      return new URL(String(value), baseUrl).href;
    } catch {
      return "";
    }
  }

  function isSameOrigin(destination, currentOrigin) {
    try {
      return new URL(destination).origin === currentOrigin;
    } catch {
      return false;
    }
  }

  function shouldAllowWindowOpen({
    baseUrl,
    currentOrigin,
    destination,
    enabled = true,
    now = Date.now(),
    trustedDestination = "",
    trustedUntil = 0,
  }) {
    if (!enabled) {
      return true;
    }

    const normalized = normalizeDestination(destination, baseUrl);
    if (!normalized || normalized === "about:blank") {
      return false;
    }
    if (isSameOrigin(normalized, currentOrigin)) {
      return true;
    }
    return normalized === trustedDestination && now <= trustedUntil;
  }

  root.NoRedirectNavigationCore = Object.freeze({
    isSameOrigin,
    normalizeDestination,
    shouldAllowWindowOpen,
  });
})(globalThis);
