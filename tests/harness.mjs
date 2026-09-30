import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('..', import.meta.url));
const source = name => readFileSync(resolve(siteRoot, name), 'utf8');

export function page(t, { width = 390, calculator = false, concierge = false } = {}) {
  const dom = new JSDOM(source('index.html'), {
    url: 'https://www.jeromykovatana.com/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  const { document } = window;
  // Outside-only execution and the absence of `resources` leave all page scripts,
  // styles, images and frames inert. Remove the ticker before evaluating its script.
  document.querySelector('.rd-ticker')?.remove();
  const network = [];
  const denyNetwork = (...args) => {
    network.push(args);
    throw new Error('Network access is forbidden in regression tests');
  };
  window.fetch = denyNetwork;
  window.XMLHttpRequest = class { constructor() { denyNetwork('XMLHttpRequest'); } };
  window.WebSocket = class { constructor() { denyNetwork('WebSocket'); } };
  window.navigator.sendBeacon = denyNetwork;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });

  let nextTimer = 1;
  const timers = new Map();
  window.setTimeout = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id;
  };
  window.clearTimeout = id => timers.delete(id);
  window.setInterval = () => nextTimer++;
  window.clearInterval = () => {};
  window.requestAnimationFrame = () => nextTimer++;
  window.cancelAnimationFrame = () => {};

  const observers = [];
  window.IntersectionObserver = class {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.targets = new Set();
      observers.push(this);
    }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
    disconnect() { this.targets.clear(); }
  };
  const mediaQueries = new Map();
  function matches(query) {
    const max = query.match(/max-width\s*:\s*(\d+)px/);
    const min = query.match(/min-width\s*:\s*(\d+)px/);
    return max ? window.innerWidth <= Number(max[1])
      : min ? window.innerWidth >= Number(min[1]) : false;
  }
  window.matchMedia = query => {
    if (!mediaQueries.has(query)) {
      const listeners = new Set();
      mediaQueries.set(query, {
        media: query,
        get matches() { return matches(query); },
        addEventListener(type, callback) { if (type === 'change') listeners.add(callback); },
        removeEventListener(type, callback) { if (type === 'change') listeners.delete(callback); },
        addListener(callback) { listeners.add(callback); },
        removeListener(callback) { listeners.delete(callback); },
        listeners,
      });
    }
    return mediaQueries.get(query);
  };

  const hookCalls = [];
  if (calculator) {
    window.JeromyConcierge = {
      calculatorDone(results) { hookCalls.push(JSON.parse(JSON.stringify(results))); },
    };
    window.eval(source('redesign.js'));
  }
  if (concierge) window.eval(source('concierge.js'));

  t.after(() => {
    assert.deepEqual(network, [], 'the scripts must not make a network request');
    dom.window.close();
  });

  return {
    window, document, hookCalls,
    field(key) { return document.querySelector(`#rd-calc [data-field="${key}"]`); },
    input(key, value) {
      const field = this.field(key);
      assert.ok(field, `missing calculator field ${key}`);
      field.value = String(value);
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    fill(values) { for (const [key, value] of Object.entries(values)) this.input(key, value); },
    mode(mode) { document.querySelector(`[data-funnel-toggle="${mode}"]`).click(); },
    snapshot() { return document.querySelector('#rd-calc-snapshot').value; },
    result(label) {
      const row = [...document.querySelectorAll('.rd-result')].find(el =>
        el.querySelector('.rd-result__label').textContent === label);
      return row?.querySelector('.rd-result__value').textContent;
    },
    rate(from, to) { return document.querySelector(`[data-rate="${from}→${to}"]`).textContent; },
    intersect(id, visible, ratio = visible ? 1 : 0) {
      const section = document.getElementById(id);
      assert.ok(section, `missing section ${id}`);
      for (const observer of observers) {
        const targets = [...observer.targets].filter(target => target === section || section.contains(target));
        if (targets.length) observer.callback(targets.map(target => ({
          target, isIntersecting: visible, intersectionRatio: ratio,
        })), observer);
      }
    },
    resize(nextWidth) {
      const before = new Map([...mediaQueries].map(([query, mql]) => [query, mql.matches]));
      window.innerWidth = nextWidth;
      for (const [query, mql] of mediaQueries) {
        if (mql.matches !== before.get(query)) {
          for (const callback of mql.listeners) callback({ matches: mql.matches, media: query });
        }
      }
      window.dispatchEvent(new window.Event('resize'));
    },
    timeout(delay) {
      const ready = [...timers].filter(([, timer]) => timer.delay === delay);
      assert.ok(ready.length, `no scheduled timeout at ${delay}ms`);
      for (const [id, timer] of ready) { timers.delete(id); timer.callback(); }
    },
    teaser() { return document.querySelector('.cc-teaser'); },
    complete(results = { funnel: '1call', biz: 'insurance', leads: 100, spend: 1000, closes: 5 }) {
      window.JeromyConcierge.calculatorDone(results);
    },
  };
}
