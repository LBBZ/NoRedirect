((root) => {
  const MINIMUM_AREA_RATIO = 0.6;
  const SUSPICIOUS_Z_INDEX = 100_000;
  const DANGEROUS_SANDBOX_TOKENS = [
    "allow-popups",
    "allow-popups-to-escape-sandbox",
    "allow-top-navigation",
    "allow-top-navigation-by-user-activation",
  ];

  function isOpaqueFrameSource(source) {
    const normalized = String(source ?? "").trim().toLowerCase();
    return !normalized || normalized.startsWith("blob:") || normalized.startsWith("javascript:");
  }

  function hasDangerousSandbox(sandbox) {
    const tokens = new Set(String(sandbox ?? "").toLowerCase().split(/\s+/).filter(Boolean));
    return DANGEROUS_SANDBOX_TOKENS.some((token) => tokens.has(token));
  }

  function shouldRemoveOverlay(metrics) {
    const areaRatio = Number(metrics.areaRatio) || 0;
    const zIndex = Number.parseInt(metrics.zIndex, 10) || 0;
    const fixed = metrics.position === "fixed" || metrics.position === "sticky";
    const interceptsClicks = metrics.pointerEvents !== "none";
    const titledAsOffer = /^(offer|notification|message)$/i.test(metrics.frameTitle ?? "");
    const suspiciousFrame = Boolean(
      metrics.crossOrigin ||
      metrics.opaqueSource ||
      metrics.dangerousSandbox ||
      titledAsOffer
    );

    return areaRatio >= MINIMUM_AREA_RATIO &&
      fixed &&
      interceptsClicks &&
      suspiciousFrame &&
      (zIndex >= SUSPICIOUS_Z_INDEX || titledAsOffer);
  }

  root.NoRedirectOverlayCore = Object.freeze({
    DANGEROUS_SANDBOX_TOKENS,
    MINIMUM_AREA_RATIO,
    SUSPICIOUS_Z_INDEX,
    hasDangerousSandbox,
    isOpaqueFrameSource,
    shouldRemoveOverlay,
  });
})(globalThis);
