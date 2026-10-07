(() => {
  const core = globalThis.NoRedirectOverlayCore;
  if (!core || window.top !== window) {
    return;
  }

  const originalDocumentStyle = {
    bodyOverflow: "",
    bodyPointerEvents: "",
    rootOverflow: document.documentElement.style.overflow,
  };
  let enabled = true;
  let observer;
  let started = false;
  let resizeBound = false;
  const watchedFrames = new WeakSet();
  const frameObservers = new WeakMap();

  function notificationSignals(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return {};
      const adLabel = [...doc.querySelectorAll("div,span,small")].some(node =>
        !node.children.length && node.textContent.trim().toLowerCase() === "ad");
      const actions = [...doc.querySelectorAll("button,[role=button],#closeBtn")]
        .map(node => node.textContent.trim().toLowerCase());
      const externalImage = [...doc.images].some(image => {
        try { const url = new URL(image.src); return /^https?:$/.test(url.protocol) && url.origin !== location.origin; }
        catch { return false; }
      });
      return { adLabel, externalImage, notificationActions: actions.includes("ok") && actions.includes("cancel") };
    } catch { return {}; } // Cross-origin frames remain covered by existing rules.
  }

  function watchFrame(frame) {
    if (!watchedFrames.has(frame)) {
      watchedFrames.add(frame);
      frame.addEventListener("load", () => { watchFrame(frame); removeIfDeceptive(frame); });
    }
    try {
      const doc = frame.contentDocument;
      const previous = frameObservers.get(frame);
      if (previous?.doc === doc) return;
      previous?.observer.disconnect();
      if (!doc) { frameObservers.delete(frame); return; }
      const observer = new MutationObserver(() => removeIfDeceptive(frame));
      observer.observe(doc, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["src", "style", "class"] });
      frameObservers.set(frame, { doc, observer });
    } catch { /* Cross-origin document access is optional. */ }
  }

  function frameOrigin(frame) {
    const source = frame.getAttribute("src") ?? "";
    try {
      return new URL(source, location.href).origin;
    } catch {
      return "";
    }
  }

  function metricsFor(frame, container) {
    const rect = container.getBoundingClientRect();
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const style = getComputedStyle(container);
    const source = frame.getAttribute("src") ?? "";
    const origin = frameOrigin(frame);

    return {
      ...notificationSignals(frame),
      areaRatio: (rect.width * rect.height) / viewportArea,
      crossOrigin: Boolean(origin && origin !== location.origin && origin !== "null"),
      dangerousSandbox: core.hasDangerousSandbox(frame.getAttribute("sandbox")),
      frameTitle: frame.title,
      opaqueSource: core.isOpaqueFrameSource(source),
      pointerEvents: style.pointerEvents,
      position: style.position,
      zIndex: style.zIndex,
    };
  }

  function restorePageInteraction() {
    document.documentElement.style.overflow = originalDocumentStyle.rootOverflow;
    if (document.body) {
      document.body.style.overflow = originalDocumentStyle.bodyOverflow;
      document.body.style.pointerEvents = originalDocumentStyle.bodyPointerEvents;
    }
  }

  function removeIfDeceptive(frame) {
    if (!enabled || !(frame instanceof HTMLIFrameElement) || !frame.isConnected) {
      return false;
    }

    const candidates = [frame, frame.parentElement].filter(Boolean);
    const container = candidates.find((element) =>
      core.shouldRemoveOverlay(metricsFor(frame, element))
    );
    if (!container) {
      return false;
    }

    frameObservers.get(frame)?.observer.disconnect();
    frameObservers.delete(frame);
    container.remove();
    restorePageInteraction();
    void chrome.runtime.sendMessage({
      type: "protection:event",
      event: {
        kind: "overlay-blocked",
        hostname: location.hostname,
        timestamp: Date.now(),
      },
    }).catch(() => {});
    return true;
  }

  function scan(root = document) {
    if (!enabled) {
      return;
    }
    if (root instanceof HTMLIFrameElement) {
      watchFrame(root);
      removeIfDeceptive(root);
    }
    root.querySelectorAll?.("iframe").forEach(frame => { watchFrame(frame); removeIfDeceptive(frame); });
  }

  function start() {
    if (!started && document.body) {
      originalDocumentStyle.bodyOverflow = document.body.style.overflow;
      originalDocumentStyle.bodyPointerEvents = document.body.style.pointerEvents;
    }
    started = true;
    scan();
    observer ??= new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "attributes") scan(mutation.target);
          mutation.addedNodes.forEach((node) => {
            if (node instanceof Element) {
              scan(node);
            }
          });
        }
      });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class", "src", "title", "sandbox"] });
    if (!resizeBound) {
      resizeBound = true;
      addEventListener("resize", () => scan(), { passive: true });
    }
  }

  chrome.storage.local.get({ enabled: true }).then(({ enabled: configured }) => {
    enabled = Boolean(configured);
    if (!enabled) {
      observer?.disconnect();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) {
      return;
    }
    enabled = Boolean(changes.enabled.newValue);
    if (enabled) {
      start();
    } else {
      observer?.disconnect();
    }
  });

  if (document.documentElement) {
    start();
  } else {
    addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
