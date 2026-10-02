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
The original calculator/concierge tests submit no forms. Opt-in tests simulate
submissions through a separate harness with mocked responses; no real provider,
email, subscription, booking, or AI request is sent.

Coverage includes calculator mode round-trips, shared and mode-specific counts,
blank versus zero, empty-state restoration, repeated selected modes, validation,
active-only snapshots, and one-time concierge hooks. Concierge tests cover mobile
calculator deferral, pending-teaser release and priority, booking suppression,
the 767/768px boundary, viewport changes, and manual launcher availability.

These DOM tests do not establish visual layout, CSS geometry, or real browser
performance. Verify the mobile launcher and calendar layout in the browser too.


Opt-in tests read the real asset forms across the site and `app.js`. They verify
unchecked optional newsletter permission, separate capture events, calculator
snapshots, honest pending/subscribed responses, retry behavior, honeypots and
unchanged contact routing.

The backend consent/storage regressions use Python's standard library, temporary
private journals and mocked HTTP. From the site root, run them separately without
writing bytecode:

```sh
python3 -B -m unittest discover -s tests -p 'test_subscribe.py' -v
```

All tests are offline with respect to production services. A successful capture
is a recorded request; it does not establish that an email was delivered.
