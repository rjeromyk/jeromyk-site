import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const siteRoot = process.env.SITE_ROOT || fileURLToPath(new URL('..', import.meta.url));
export const source = name => readFileSync(resolve(siteRoot, name), 'utf8');
export const htmlFiles = () => [
  ...readdirSync(siteRoot).filter(name => name.endsWith('.html')),
  ...readdirSync(resolve(siteRoot, 'blog')).filter(name => name.endsWith('.html')).map(name => `blog/${name}`)
];

export function reply(body, { ok = true, status = ok ? 200 : 500 } = {}) {
  return { ok, status, json: async () => body };
}

export function captured(status = 'not_requested', reason) {
  return reply({
    ok: true,
    delivery: { status: 'captured', email_sent: false },
    newsletter: { status, ...(reason ? { reason } : {}) }
  });
}

export function optinPage(t, {
  file = 'index.html',
  url = `https://www.jeromykovatana.com/${file === 'index.html' ? '' : file.replace(/\.html$/, '')}?source=test#asset`
} = {}) {
  const dom = new JSDOM(source(file), { url, runScripts: 'outside-only' });
  const { window } = dom;
  const { document } = window;
  const requests = [];
  const replies = [];
  const opened = [];
  const events = [];
  const forbidden = [];
  const timers = new Map();
  let timerID = 0;

  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.IntersectionObserver = Observer;
  window.requestAnimationFrame = () => 0;
  window.cancelAnimationFrame = () => {};
  window.setTimeout = (callback, delay = 0) => {
    const id = ++timerID;
    timers.set(id, { callback, delay });
    return id;
  };
  window.clearTimeout = id => timers.delete(id);
  window.setInterval = () => 0;
  window.clearInterval = () => {};
  window.CONCIERGE_CONFIG = { BACKEND_URL: 'https://backend.example.test/chat' };
  window.open = (...args) => { opened.push(args); return null; };
  window.va = (...args) => events.push(JSON.parse(JSON.stringify(args)));
  window.fetch = async (input, options = {}) => {
    const endpoint = String(input);
    assert.ok(endpoint === 'https://backend.example.test/subscribe' || endpoint.startsWith('https://formsubmit.co/ajax/'), `Unexpected mocked endpoint: ${endpoint}`);
    const request = { url: endpoint, ...options, payload: JSON.parse(options.body) };
    requests.push(request);
    assert.ok(replies.length, 'Every request must have an explicit mocked response');
    const result = replies.shift();
    if (result instanceof Error) throw result;
    if (typeof result === 'function') return result(request);
    return result;
  };
  const disallow = kind => (...args) => {
    forbidden.push(kind);
    throw new Error(`External ${kind} is forbidden in form tests`);
  };
  window.XMLHttpRequest = disallow('XHR');
  window.WebSocket = disallow('WebSocket');
  window.navigator.sendBeacon = disallow('beacon');
  window.eval(source('app.js'));

  const flush = async () => {
    await new Promise(resolve => setImmediate(resolve));
    await new Promise(resolve => setImmediate(resolve));
  };

  t.after(() => {
    assert.deepEqual(forbidden, [], 'Tests must not perform external requests or sends');
    dom.window.close();
  });

  return {
    window, document, requests, replies, opened, events,
    form: kind => document.querySelector(`form[data-lead-form="${kind}"]`),
    button: form => form.querySelector('button[type="submit"]'),
    consent: form => form.querySelector('input[name="newsletter_consent"]'),
    status: form => form.dataset.leadForm === 'calc_results'
      ? document.getElementById('rd-calc-newsletter-status')
      : form.querySelector('.lead-form__status'),
    queue: (...responses) => replies.push(...responses),
    flush,
    runTimers: delay => {
      for (const [id, timer] of [...timers]) {
        if (timer.delay !== delay) continue;
        timers.delete(id);
        timer.callback();
      }
    },
    submit: async form => {
      form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
      await flush();
    }
  };
}

export function fillEmail(form, email = 'agent@example.test') {
  const input = form.elements.namedItem('email');
  assert.ok(input, 'Real form has an email input');
  input.value = email;
  return input;
}

export function newsletterEvents(page) {
  return page.events.filter(([operation, payload]) => operation === 'event' && /newsletter/i.test(payload.name));
}
