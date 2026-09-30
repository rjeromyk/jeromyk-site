import assert from 'node:assert/strict';
import test from 'node:test';
import { page } from './harness.mjs';

function concierge(t, width = 390) {
  const p = page(t, { width, concierge: true });
  p.intersect('book', false);
  return p;
}

test('mobile calculator teaser waits for even a tiny calculator intersection to end', t => {
  const p = concierge(t);
  p.intersect('calculator', true, 0.001);
  p.complete();
  assert.equal(p.teaser(), null);
  assert.equal(p.window.sessionStorage.getItem('jk_teaser_calc'), null);
  const fab = p.document.querySelector('.cc-fab');
  assert.ok(fab, 'manual launcher remains available');
  fab.click();
  assert.equal(p.document.querySelector('#jk-concierge').classList.contains('cc-open'), true);
  assert.equal(fab.getAttribute('aria-expanded'), 'true');
  fab.click();
  p.intersect('calculator', false);
  assert.match(p.teaser()?.textContent ?? '', /Those numbers have room/);
  assert.equal(p.window.sessionStorage.getItem('jk_teaser_calc'), '1');
});

test('mobile idle teaser is deferred while calculating and appears after scrolling out', t => {
  const p = concierge(t);
  p.intersect('calculator', true);
  p.timeout(35000);
  assert.equal(p.teaser(), null);
  assert.equal(p.window.sessionStorage.getItem('jk_teaser_35s'), null);
  p.intersect('calculator', false);
  assert.match(p.teaser()?.textContent ?? '', /Quick question/);
});

test('pending calculator intent outranks pending idle intent on mobile', t => {
  const p = concierge(t);
  p.intersect('calculator', true);
  p.timeout(35000);
  p.complete();
  assert.equal(p.teaser(), null);
  p.intersect('calculator', false);
  assert.match(p.teaser()?.textContent ?? '', /Those numbers have room/);
  assert.equal(p.window.sessionStorage.getItem('jk_teaser_35s'), null);
});

test('booking guard continues to defer a pending calculator teaser after calculator exit', t => {
  const p = concierge(t);
  p.intersect('calculator', true);
  p.complete();
  p.intersect('book', true, 0.001);
  p.intersect('calculator', false);
  assert.equal(p.teaser(), null);
  assert.equal(p.window.sessionStorage.getItem('jk_teaser_calc'), null);
  p.intersect('book', false);
  assert.match(p.teaser()?.textContent ?? '', /Those numbers have room/);
});

test('767px defers while 768px retains desktop calculator teaser behavior', t => {
  const mobile = concierge(t, 767);
  mobile.intersect('calculator', true);
  mobile.complete();
  assert.equal(mobile.teaser(), null);
  const desktop = concierge(t, 768);
  desktop.intersect('calculator', true);
  desktop.complete();
  assert.match(desktop.teaser()?.textContent ?? '', /Those numbers have room/);
});

test('media-query changes release unseen pending intent and hide an existing teaser on mobile', t => {
  const p = concierge(t, 767);
  p.intersect('calculator', true);
  p.complete();
  assert.equal(p.teaser(), null);
  p.resize(768);
  assert.match(p.teaser()?.textContent ?? '', /Those numbers have room/);
  p.resize(767);
  assert.equal(p.teaser(), null);
  assert.ok(p.document.querySelector('.cc-fab'));
  p.intersect('calculator', false);
  assert.equal(p.teaser(), null, 'a teaser already shown in this session is not repeated');
});

test('entering the mobile calculator dismisses a pre-existing idle teaser', t => {
  const p = concierge(t);
  p.intersect('calculator', false);
  p.timeout(35000);
  assert.ok(p.teaser());
  p.intersect('calculator', true, 0.001);
  assert.equal(p.teaser(), null);
  assert.ok(p.document.querySelector('.cc-fab'));
});

test('booking hides existing teasers on desktop as well as mobile', t => {
  const p = concierge(t, 1200);
  p.complete();
  assert.ok(p.teaser());
  p.intersect('book', true);
  assert.equal(p.teaser(), null);
  assert.ok(p.document.querySelector('.cc-fab'));
});
