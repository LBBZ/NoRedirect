# NoRedirect

A Manifest V3 Chrome extension that blocks deceptive overlays and unauthorized redirects.

Protection is applied in four layers:

1. Declarative request rules block requests to known advertising domains.
2. A document-start observer removes click-intercepting full-screen frames.
3. A main-world guard binds popup creation to the destination of a real user interaction.
4. The service worker closes unauthorized child tabs and recovers unsafe top-level navigation.

Activity storage is limited to event types and hostnames. Full URLs, query strings, and page content are not retained.

## Development

Load this directory through `chrome://extensions` with Developer mode enabled and choose **Load unpacked**.

Use the toolbar popup for the master switch and open the settings page to inspect activity or add HTTPS sites for protection. The protected-site list starts empty; users choose and authorize each site themselves. Page and navigation protection apply to those sites, while the advertising-domain blocklist applies globally when protection is enabled. Existing pages must be refreshed after loading the extension or changing protection state.

## Verification

Run static validation and unit tests:

```powershell
npm run check
```

To verify an already loaded extension in a debuggable Chrome or Chrome for Testing instance:

```powershell
$env:TEST_CHROME_PORT = "9334"
npm run smoke:chrome
```

The smoke check requires the extension service worker to be active. Opening the toolbar popup wakes it when necessary.
