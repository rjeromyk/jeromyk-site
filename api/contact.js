// Lead form relay — receives JSON POSTs from the site forms and emails them
// via FormSubmit's AJAX API. The destination address lives in the CONTACT_EMAIL
// env var on Vercel so it never appears in this public repo.

const MAX_FIELD_LENGTH = 2000;

function clean(value) {
  return String(value || '').slice(0, MAX_FIELD_LENGTH).trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const to = process.env.CONTACT_EMAIL;
  if (!to) {
    res.status(500).json({ ok: false, error: 'CONTACT_EMAIL not configured' });
    return;
  }

  const b = req.body || {};

  // Honeypot — bots fill every field; humans never see this one.
  if (b._gotcha) {
    res.status(200).json({ ok: true });
    return;
  }

  const email = clean(b.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ ok: false, error: 'Valid email required' });
    return;
  }

  const formType = b.form_type === 'playbook' ? 'playbook' : 'contact';
  const subject =
    formType === 'playbook'
      ? `Playbook download: ${email}`
      : `New strategy call inquiry: ${clean(b.name) || email}`;

  const payload = {
    _subject: subject,
    _template: 'table',
    _captcha: 'false',
    form_type: formType,
    name: clean(b.name),
    email,
    phone: clean(b.phone),
    company: clean(b.company),
    monthly_ad_spend: clean(b.monthly_ad_spend),
    message: clean(b.message),
    page: clean(b.page),
    submitted_at: new Date().toISOString(),
  };

  try {
    const r = await fetch(`https://formsubmit.co/ajax/${to}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false || data.success === 'false') {
      res.status(502).json({ ok: false, error: 'Email relay failed' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch {
    res.status(502).json({ ok: false, error: 'Email relay failed' });
  }
}
