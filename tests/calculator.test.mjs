import assert from 'node:assert/strict';
import test from 'node:test';
import { page } from './harness.mjs';

const shared = { leads: 100, pickups: 50, closes: 5, spend: 1000, premium: 1000 };

test('one→two→one preserves shared inputs and independently calculated results', t => {
  const p = page(t, { calculator: true });
  p.fill(shared);
  for (const mode of ['2call', '1call']) {
    p.mode(mode);
    for (const [key, value] of Object.entries(shared)) assert.equal(p.field(key).value, String(value));
    assert.equal(p.result('Cost per policy'), '$200');
    assert.equal(p.result('Weekly premium'), '$5,000');
    assert.equal(p.result('Lead → close rate'), '5.0%');
    assert.equal(p.rate('leads', 'pickups'), '50.0%');
  }
  assert.equal(p.rate('pickups', 'closes'), '10.0%');
  assert.equal(p.hookCalls.length, 1, 'mode changes must not refire the concierge hook');
});

test('two-call stages are remembered but absent from one-call snapshots and hook payloads', t => {
  const p = page(t, { calculator: true });
  p.mode('2call');
  p.fill({ leads: 100, pickups: 50, booked: 20, showed: 10, closes: 5, premium: 1000 });
  p.mode('1call');
  p.input('spend', 1000); // The first complete diagnosis is deliberately in one-call mode.
  assert.equal(p.field('booked'), null);
  assert.equal(p.field('showed'), null);
  assert.doesNotMatch(p.snapshot(), /(?:booked|showed)=/);
  assert.equal(p.hookCalls.length, 1);
  assert.equal(p.hookCalls[0].booked, null);
  assert.equal(p.hookCalls[0].showed, null);
  p.mode('2call');
  assert.equal(p.field('booked').value, '20');
  assert.equal(p.field('showed').value, '10');
  assert.equal(p.rate('pickups', 'booked'), '40.0%');
  assert.equal(p.rate('booked', 'showed'), '50.0%');
  assert.equal(p.rate('showed', 'closes'), '50.0%');
  assert.match(p.snapshot(), /booked=20/);
  assert.match(p.snapshot(), /showed=10/);
});

test('cleared shared and two-call fields stay blank through subsequent rebuilds', t => {
  const p = page(t, { calculator: true });
  p.mode('2call');
  p.fill({ ...shared, booked: 20, showed: 10 });
  p.input('closes', '');
  p.input('booked', '');
  for (const mode of ['1call', '2call']) {
    p.mode(mode);
    assert.equal(p.field('closes').value, '');
    assert.equal(p.result('Cost per policy'), undefined);
    assert.equal(p.result('Lead → close rate'), undefined);
    assert.doesNotMatch(p.snapshot(), /closes=/);
  }
  assert.equal(p.field('booked').value, '');
  assert.doesNotMatch(p.snapshot(), /booked=/);
});

test('clearing every field returns to an empty calculator through two→one→two', t => {
  const p = page(t, { calculator: true });
  p.mode('2call');
  p.fill({ ...shared, booked: 20, showed: 10 });
  for (const field of p.document.querySelectorAll('#rd-calc [data-field]')) p.input(field.dataset.field, '');
  for (const mode of ['1call', '2call']) {
    p.mode(mode);
    for (const field of p.document.querySelectorAll('#rd-calc [data-field]')) assert.equal(field.value, '');
    assert.equal(p.document.querySelector('#rd-results').children.length, 0);
    assert.equal(p.document.querySelector('#rd-results').style.display, 'none');
    assert.notEqual(p.document.querySelector('#rd-calc-empty').style.display, 'none');
    assert.equal(p.document.querySelector('#rd-calc-msg').style.display, 'none');
    for (const arrow of p.document.querySelectorAll('.rate')) assert.equal(arrow.textContent, '—');
    assert.doesNotMatch(p.snapshot(), /(?:leads|pickups|booked|showed|closes|spend|premium)=/);
  }
});

test('explicit zeros survive rebuilds without NaN, Infinity or false empty values', t => {
  const p = page(t, { calculator: true });
  p.mode('2call');
  p.fill({ leads: 0, pickups: 0, booked: 0, showed: 0, closes: 0, spend: 0, premium: 0 });
  for (const mode of ['1call', '2call']) {
    p.mode(mode);
    for (const field of p.document.querySelectorAll('#rd-calc [data-field]')) assert.equal(field.value, '0');
    assert.equal(p.result('Weekly premium'), '$0');
    assert.equal(p.result('Cost per policy'), undefined);
    assert.equal(p.result('Lead → close rate'), undefined);
    assert.doesNotMatch(p.document.querySelector('#rd-results').textContent, /NaN|Infinity/);
    for (const arrow of p.document.querySelectorAll('.rate')) assert.equal(arrow.textContent, '—');
  }
  assert.equal(p.hookCalls.length, 0);
});

test('clicking the already-selected mode preserves the focused field and its DOM identity', t => {
  const p = page(t, { calculator: true });
  p.fill(shared);
  const field = p.field('pickups');
  field.focus();
  p.mode('1call');
  p.mode('1call');
  assert.equal(p.field('pickups'), field);
  assert.equal(p.document.activeElement, field);
  assert.equal(field.value, '50');
  assert.equal(p.hookCalls.length, 1);
});

test('impossible stage counts remain flagged after mode changes and correct after input', t => {
  const p = page(t, { calculator: true });
  p.fill({ leads: 100, pickups: 150, closes: 5 });
  for (const mode of ['2call', '1call']) {
    p.mode(mode);
    assert.equal(p.field('pickups').value, '150');
    const row = p.field('pickups').closest('.rd-fnode');
    assert.ok(row.classList.contains('has-error'));
    assert.match(row.querySelector('.rd-field-error').textContent, /can't exceed weekly leads \(100\)/i);
    assert.equal(p.rate('leads', 'pickups'), '—');
    assert.equal(p.document.querySelector('#rd-calc-capture').style.display, 'none');
  }
  p.input('pickups', 50);
  assert.equal(p.field('pickups').closest('.rd-fnode').classList.contains('has-error'), false);
  assert.equal(p.rate('leads', 'pickups'), '50.0%');
});
