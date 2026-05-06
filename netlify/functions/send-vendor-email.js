// Zummee v522 — Board Meetings vendor email via Resend
// Required Netlify env var: RESEND_API_KEY
// Recommended env var: FROM_EMAIL or RESEND_FROM_EMAIL, e.g. notifications@your-verified-domain.com

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: true, message: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'Zummee <notifications@zummee.com>';

  if (!apiKey) {
    return json(500, {
      error: true,
      message: 'RESEND_API_KEY is not configured in Netlify.'
    });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_e) {
    return json(400, { error: true, message: 'Invalid JSON payload.' });
  }

  const bcc = uniqueEmails(Array.isArray(body.bcc) ? body.bcc : []);
  if (!bcc.length) {
    return json(400, { error: true, message: 'No vendor email addresses selected.' });
  }

  const subject = clean(body.subject || 'New Business Item');
  const communityName = clean(body.communityName || 'Selected community');
  const message = clean(body.message || 'New business item added.');

  const textBody = [
    `Community: ${communityName}`,
    '',
    'New Business Item:',
    message,
    '',
    '— Zummee'
  ].join('\n');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;line-height:1.55;color:#17324d;">
      <h2 style="margin:0 0 12px;">New Business Item</h2>
      <p style="margin:0 0 14px;"><strong>Community:</strong> ${escapeHtml(communityName)}</p>
      <div style="padding:14px 16px;border:1px solid #d7e3ef;border-radius:14px;background:#f7fbff;white-space:pre-wrap;">${escapeHtml(message)}</div>
      <p style="margin:18px 0 0;color:#60758a;">— Zummee</p>
    </div>
  `;

  // Resend requires a visible To address. Use sender/from as To and vendors as BCC.
  const to = process.env.VENDOR_EMAIL_TO || fromEmail.replace(/^.*<(.+)>.*$/, '$1');

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        bcc,
        subject,
        text: textBody,
        html: htmlBody
      })
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Resend vendor email failed:', result);
      return json(response.status, {
        error: true,
        message: result && result.message ? result.message : 'Resend email failed.',
        details: result
      });
    }

    return json(200, {
      ok: true,
      id: result && result.id,
      sentToCount: bcc.length
    });
  } catch (error) {
    console.error('send-vendor-email unexpected error:', error);
    return json(500, {
      error: true,
      message: 'Unexpected error while sending vendor email.'
    });
  }
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function uniqueEmails(values) {
  const seen = new Set();
  return values
    .map(clean)
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .filter(email => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
