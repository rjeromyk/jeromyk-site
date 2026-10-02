import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { captured, fillEmail, htmlFiles, newsletterEvents, optinPage, reply, source } from './optin-harness.mjs';

const version = 'jeromyk-newsletter-v1';

test('every asset form offers separately labelled, unchecked optional newsletter consent', () => {
  let forms = 0;
  for (const file of htmlFiles()) {
    const dom = new JSDOM(source(file));
    try {
      for (const form of dom.window.document.querySelectorAll('form[data-lead-form]')) {
        const kind = form.dataset.leadForm;
        const checkbox = form.querySelector('input[name="newsletter_consent"]');
        if (!['playbook', 'checklist', 'calc_results'].includes(kind)) {
          assert.equal(checkbox, null, `${file}: contact is separate from newsletter enrollment`);
          continue;
        }
        forms++;
        assert.ok(checkbox, `${file}: ${kind} consent control exists`);
        assert.equal(checkbox.type, 'checkbox', `${file}: consent uses a checkbox`);
        assert.equal(checkbox.checked, false, `${file}: starts unchecked`);
        assert.equal(checkbox.defaultChecked, false, `${file}: reset defaults unchecked`);
        assert.equal(checkbox.required, false, `${file}: asset access does not require newsletter consent`);
        assert.equal(checkbox.dataset.newsletterConsentVersion || form.dataset.newsletterConsentVersion, version, `${file}: consent text is versioned`);
        assert.ok(checkbox.labels.length, `${file}: consent has an accessible label`);
        const description = dom.window.document.getElementById(checkbox.getAttribute('aria-describedby'));
        assert.ok(description, `${file}: consent details are accessible from the checkbox`);
        assert.match(description.textContent, /emails? from Jeromy Kovatana/i, `${file}: description identifies the email sender`);
      }
    } finally { dom.window.close(); }
  }
  assert.equal(forms, 10, 'Checks both homepage forms, both playbook-page forms, checklist, and five article forms');
});

for (const [kind, file, asset] of [
  ['playbook', 'index.html', '/playbook.pdf'],
  ['checklist', 'vendor-vetting-checklist.html', '/vendor-vetting-checklist.pdf']
]) {
  test(`${kind}: unchecked consent captures the asset request without enrolling in a newsletter`, async t => {
    const p = optinPage(t, { file });
    const form = p.form(kind);
    fillEmail(form, '  agent@example.test  ');
    p.consent(form).value = 'true'; // A string value cannot turn an unchecked box into consent.
    p.queue(captured());
    await p.submit(form);
    assert.equal(p.requests.length, 1);
    const { payload, method, headers } = p.requests[0];
    assert.equal(method, 'POST');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.equal(payload.email, 'agent@example.test');
    assert.equal(payload.source, kind);
    assert.equal(payload.newsletter_consent, false);
    assert.equal(typeof payload.newsletter_consent, 'boolean');
    assert.equal(Object.hasOwn(payload, 'consent_version'), false);
    assert.equal(payload.page, p.window.location.pathname);
    assert.doesNotMatch(payload.page, /[?#]/);
    assert.deepEqual(p.opened, [[asset, '_blank', 'noopener']]);
    assert.equal(newsletterEvents(p).length, 0);
    assert.equal(p.consent(form).checked, false);
    assert.equal(form.elements.namedItem('email').value, '');
    assert.doesNotMatch(p.status(form)?.textContent || '', /subscribed|newsletter signup|newsletter request/i);
    const assetEvent = p.events.find(([, event]) => event.name === 'asset_request_captured');
    assert.ok(assetEvent, 'Asset capture has its own purpose-specific event');
    assert.deepEqual(assetEvent[1].data, { page: p.window.location.pathname, source: kind });
    assert.doesNotMatch(JSON.stringify(p.events), /agent@example\.test/);
  });
}

test('checked consent sends a true boolean and text version regardless of the checkbox string value', async t => {
  const p = optinPage(t);
  const form = p.form('playbook');
  fillEmail(form);
  const consent = p.consent(form);
  consent.value = 'false';
  consent.checked = true;
  p.queue(captured('subscribed'));
  await p.submit(form);
  assert.equal(p.requests[0].payload.newsletter_consent, true);
  assert.equal(typeof p.requests[0].payload.newsletter_consent, 'boolean');
  assert.equal(p.requests[0].payload.consent_version, version);
  assert.equal(consent.checked, false, 'Success reset never preserves consent for the next request');
  assert.match(p.status(form).textContent, /signed up/i);
  assert.equal(p.status(form).getAttribute('role'), 'status');
  assert.equal(newsletterEvents(p).length, 1, 'Newsletter purpose has a separate event');
  assert.deepEqual(newsletterEvents(p)[0], ['event', {
    name: 'newsletter_consent_captured',
    data: { page: '/', source: 'playbook', consent_version: version, status: 'subscribed' }
  }]);
  assert.doesNotMatch(JSON.stringify(p.events), /agent@example\.test/);
  assert.equal(p.opened.length, 1);

  p.runTimers(4000);
  fillEmail(form, 'second@example.test');
  p.queue(captured());
  await p.submit(form);
  assert.equal(p.requests[1].payload.newsletter_consent, false);
  assert.equal(Object.hasOwn(p.requests[1].payload, 'consent_version'), false);
  assert.equal(newsletterEvents(p).length, 1, 'A later unchecked request does not imply newsletter consent');
});

for (const reason of ['not_configured', 'suppressed', 'provider_error']) {
  test(`durable capture with newsletter pending (${reason}) still delivers the PDF and avoids a subscribed claim`, async t => {
    const p = optinPage(t, { file: 'vendor-vetting-checklist.html' });
    const form = p.form('checklist');
    fillEmail(form);
    p.consent(form).checked = true;
    p.queue(captured('pending', reason));
    await p.submit(form);
    assert.deepEqual(p.opened, [['/vendor-vetting-checklist.pdf', '_blank', 'noopener']]);
    assert.equal(form.elements.namedItem('email').value, '');
    assert.equal(p.consent(form).checked, false);
    const status = p.status(form);
    assert.ok(status, 'Opt-in result has a separate accessible announcer');
    assert.equal(status.getAttribute('role'), 'status');
    assert.ok(status.textContent.trim(), 'Pending signup is explained rather than hidden');
    assert.doesNotMatch(status.textContent, /you(?:['’]re| are) (?:subscribed|signed up)|successfully subscribed|emails? (?:were |has been |have been )?sent|check your inbox/i);
    assert.equal(newsletterEvents(p).length, 1, 'Consent request is measured separately from completed subscription');
  });
}

test('calculator captures the exact snapshot and reports saved results without opening a PDF or claiming an email', async t => {
  const p = optinPage(t);
  const form = p.form('calc_results');
  const snapshot = 'mode=2call; leads=100; pickups=50; booked=20; showed=10; closes=5; spend=1000; premium=1000';
  form.elements.namedItem('funnel_snapshot').value = snapshot;
  fillEmail(form);
  p.queue(captured());
  await p.submit(form);
  assert.equal(p.requests[0].payload.source, 'calculator');
  assert.equal(p.requests[0].payload.fields.funnel_snapshot, snapshot);
  assert.equal(p.requests[0].payload.newsletter_consent, false);
  assert.equal(Object.hasOwn(p.requests[0].payload, 'consent_version'), false);
  assert.deepEqual(p.opened, []);
  assert.equal(form.style.display, 'none');
  const done = p.document.getElementById('rd-calc-capture-done');
  assert.notEqual(done.style.display, 'none');
  assert.match(done.textContent, /(?:request|results).*saved|saved.*(?:request|results)/i);
  assert.doesNotMatch(done.textContent + p.button(form).textContent, /check your inbox|on the way|(?:results|email) sent/i);
  assert.equal(newsletterEvents(p).length, 0);
  assert.ok(p.events.some(([, event]) => event.name === 'asset_request_captured' && event.data.source === 'calculator'));
});

test('checked calculator consent announces pending signup outside the hidden capture form', async t => {
  const p = optinPage(t);
  const form = p.form('calc_results');
  fillEmail(form);
  const snapshot = 'mode=1call; leads=100; pickups=50; closes=5';
  form.elements.namedItem('funnel_snapshot').value = snapshot;
  p.consent(form).checked = true;
  p.queue(captured('pending', 'not_configured'));
  await p.submit(form);
  assert.equal(p.requests[0].payload.newsletter_consent, true);
  assert.equal(p.requests[0].payload.consent_version, version);
  assert.equal(p.requests[0].payload.fields.funnel_snapshot, snapshot);
  assert.equal(p.consent(form).checked, false);
  const status = p.status(form);
  assert.ok(status);
  assert.equal(form.contains(status), false, 'Hiding calculator form must not hide the signup status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.notEqual(status.style.display, 'none');
  assert.match(status.textContent, /newsletter request is saved/i);
  assert.equal(newsletterEvents(p).length, 1);
  assert.equal(newsletterEvents(p)[0][1].data.source, 'calculator');
  assert.equal(newsletterEvents(p)[0][1].data.status, 'pending');
  assert.deepEqual(p.opened, []);
});

test('separate playbook forms keep independent consent and accessible result messages', async t => {
  const p = optinPage(t, { file: 'free-playbook.html' });
  const [first, second] = p.document.querySelectorAll('form[data-lead-form="playbook"]');
  assert.ok(first && second);
  fillEmail(first, 'first@example.test');
  fillEmail(second, 'second@example.test');
  p.consent(first).checked = true;
  p.queue(captured('subscribed'));
  await p.submit(first);
  assert.equal(p.requests[0].payload.newsletter_consent, true);
  assert.equal(p.consent(second).checked, false);
  assert.equal(second.elements.namedItem('email').value, 'second@example.test');
  assert.equal(p.status(second).textContent, '');
  p.queue(captured());
  await p.submit(second);
  assert.equal(p.requests[1].payload.newsletter_consent, false);
  assert.equal(Object.hasOwn(p.requests[1].payload, 'consent_version'), false);
  assert.match(p.status(first).textContent, /signed up/i);
  assert.equal(p.status(second).textContent, '');
  assert.equal(newsletterEvents(p).length, 1);
  assert.equal(p.opened.length, 2);
});

test('honeypot asset submission makes no request', async t => {
  const p = optinPage(t);
  const form = p.form('playbook');
  fillEmail(form);
  form.elements.namedItem('_honey').value = 'bot';
  p.consent(form).checked = true;
  await p.submit(form);
  assert.deepEqual(p.requests, []);
  assert.deepEqual(p.events, [], 'Bot submissions are not recorded as captured consent or asset conversions');
});

test('an in-flight asset submission cannot create duplicate requests', async t => {
  const p = optinPage(t);
  const form = p.form('playbook');
  fillEmail(form);
  let resolveRequest;
  p.queue(() => new Promise(resolve => { resolveRequest = resolve; }));
  await p.submit(form);
  assert.equal(p.requests.length, 1);
  assert.equal(p.button(form).disabled, true);
  await p.submit(form);
  assert.equal(p.requests.length, 1);
  resolveRequest(captured());
  await p.flush();
  assert.equal(p.opened.length, 1);
  assert.equal(form.elements.namedItem('email').value, '');
});

for (const [name, response] of [
  ['2xx explicitly rejected result', reply({ ok: false, delivery: { status: 'captured' }, newsletter: { status: 'subscribed' } })],
  ['2xx empty result', reply({})],
  ['2xx truthy string ok', reply({ ok: 'true', delivery: { status: 'captured' } })],
  ['2xx without durable capture', reply({ ok: true, delivery: { status: 'pending' } })],
  ['HTTP failure', reply({ ok: false }, { ok: false })],
  ['invalid JSON', { ok: true, json: async () => { throw new SyntaxError('Malformed JSON'); } }],
  ['network rejection', new Error('Mock network failure')]
]) {
  test(`${name} preserves input, prevents success, and allows a corrected retry`, async t => {
    const p = optinPage(t);
    const form = p.form('playbook');
    const input = fillEmail(form);
    p.consent(form).checked = true;
    p.queue(response);
    await p.submit(form);
    assert.equal(input.value, 'agent@example.test');
    assert.equal(p.consent(form).checked, true);
    assert.equal(p.button(form).disabled, false);
    assert.match(p.button(form).textContent, /try again/i);
    assert.deepEqual(p.opened, []);
    assert.deepEqual(p.events, []);
    p.queue(captured('subscribed'));
    await p.submit(form);
    assert.equal(p.requests.length, 2);
    assert.equal(p.requests[1].payload.newsletter_consent, true);
    assert.equal(input.value, '');
    assert.equal(p.consent(form).checked, false);
    assert.equal(p.opened.length, 1);
  });
}

test('contact retains its legacy FormSubmit payload and does not enroll the sender', async t => {
  const p = optinPage(t, { file: 'contact.html' });
  const form = p.form('contact');
  form.elements.namedItem('name').value = 'Test Agent';
  fillEmail(form);
  form.elements.namedItem('phone').value = '5550100000';
  form.elements.namedItem('company').value = 'Test Agency';
  form.elements.namedItem('monthly_ad_spend').value = '50k-100k';
  form.elements.namedItem('message').value = 'Please review the funnel.';
  p.queue(reply({ success: true }));
  await p.submit(form);
  assert.equal(p.requests.length, 1);
  assert.match(p.requests[0].url, /^https:\/\/formsubmit\.co\/ajax\//);
  assert.deepEqual(p.requests[0].payload, {
    _honey: '', name: 'Test Agent', email: 'agent@example.test', phone: '5550100000',
    company: 'Test Agency', monthly_ad_spend: '50k-100k', message: 'Please review the funnel.',
    form_type: 'contact', page: '/contact', _subject: 'New funnel teardown inquiry: Test Agent',
    _template: 'table', _captcha: 'false'
  });
  assert.deepEqual(p.opened, []);
  assert.equal(newsletterEvents(p).length, 0);
  assert.deepEqual(p.events.map(([, event]) => event.name), ['call_inquiry']);
  assert.equal(form.elements.namedItem('email').value, '');
});

test('a failed contact provider acknowledgement cannot show success', async t => {
  const p = optinPage(t, { file: 'contact.html' });
  const form = p.form('contact');
  fillEmail(form);
  form.elements.namedItem('name').value = 'Test Agent';
  p.queue(reply({ success: false }));
  await p.submit(form);
  assert.equal(form.elements.namedItem('email').value, 'agent@example.test');
  assert.equal(p.button(form).disabled, false);
  assert.match(p.button(form).textContent, /try again/i);
  assert.deepEqual(p.events, []);
});
