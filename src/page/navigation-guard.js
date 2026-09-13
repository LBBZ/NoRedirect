(() => {
  const core = globalThis.NoRedirectNavigationCore;
  if (!core || window.top !== window) {
    return;
  }

  const nativeOpen = window.open.bind(window);
  const INTENT_TTL_MS = 2_000;
  let trustedDestination = "";
  let trustedUntil = 0;

  function report(kind, destination = "") {
    dispatchEvent(new CustomEvent("__noredirect_report__", {
      detail: {
        destination,
        kind,
        timestamp: Date.now(),
      },
    }));
  }

  function isDeceptiveFullPageLink(anchor) {
    const rect = anchor.getBoundingClientRect();
    const areaRatio = (rect.width * rect.height) / Math.max(1, innerWidth * innerHeight);
    const style = getComputedStyle(anchor);
    const zIndex = Number.parseInt(style.zIndex, 10) || 0;
    return areaRatio >= 0.6 &&
      (style.position === "fixed" || style.position === "sticky") &&
      zIndex >= 100_000;
  }

  function rememberIntent(anchor) {
    const destination = core.normalizeDestination(anchor.href, location.href);
    trustedDestination = destination;
    trustedUntil = Date.now() + INTENT_TTL_MS;
  }

  function guardedOpen(url, target, features) {
    const destination = core.normalizeDestination(url, location.href);
    const allowed = core.shouldAllowWindowOpen({
      baseUrl: location.href,
      currentOrigin: location.origin,
      destination,
      trustedDestination,
      trustedUntil,
    });

    if (!allowed) {
      report("popup-blocked", destination);
      return null;
    }

    if (destination === trustedDestination) {
      trustedDestination = "";
      trustedUntil = 0;
    }
    return nativeOpen(url, target, features);
  }

  Object.defineProperty(window, "open", {
    configurable: false,
    enumerable: true,
    value: guardedOpen,
    writable: false,
  });

  addEventListener("pointerdown", (event) => {
    if (!event.isTrusted || event.button !== 0) {
      return;
    }
    const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (anchor && !isDeceptiveFullPageLink(anchor)) {
      rememberIntent(anchor);
    }
  }, true);

  addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }

    const anchor = event.target.closest("a[href]");
    if (!anchor) {
      return;
    }

    const destination = core.normalizeDestination(anchor.href, location.href);
    if (isDeceptiveFullPageLink(anchor) || (!event.isTrusted && !core.isSameOrigin(destination, location.origin))) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report("navigation-blocked", destination);
      return;
    }

    if (event.isTrusted) {
      rememberIntent(anchor);
    }
  }, true);

  addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)) {
      return;
    }
    const destination = core.normalizeDestination(event.target.action, location.href);
    if (!core.isSameOrigin(destination, location.origin)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      report("navigation-blocked", destination);
    }
  }, true);

})();
