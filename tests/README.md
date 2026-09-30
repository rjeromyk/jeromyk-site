# Site regression tests

Run with Node 22 or newer from this directory:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

The package pins jsdom 26.1.0 and has its own dependency lock. No site-root package
manifest is needed. `node_modules/` is ignored within this directory.

The harness reads the real `index.html`, `redesign.js`, and `concierge.js` from
the parent directory. To exercise another checkout, set `SITE_ROOT`:

```sh
SITE_ROOT=/Users/jeromykovatana/Projects/jeromyk/jeromyk-site npm test
```

The tests execute scripts outside the page only; remote resources and inline
page scripts never run. The ticker DOM is removed before script evaluation.
IntersectionObserver, media queries, and timers are deterministic mocks. Fetch,
XMLHttpRequest, WebSocket, and sendBeacon are blocked and checked after each test.
No form is submitted, teaser activated, or AI/backend prompt sent.

Coverage includes calculator mode round-trips, shared and mode-specific counts,
blank versus zero, empty-state restoration, repeated selected modes, validation,
active-only snapshots, and one-time concierge hooks. Concierge tests cover mobile
calculator deferral, pending-teaser release and priority, booking suppression,
the 767/768px boundary, viewport changes, and manual launcher availability.

These DOM tests do not establish visual layout, CSS geometry, or real browser
performance. Verify the mobile launcher and calendar layout in the browser too.
