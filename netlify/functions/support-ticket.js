exports.handler = async function(event) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  try {
    const body = JSON.parse(event.body || '{}');
    const ticketId = String(body.ticket_id || '').slice(0, 40) || ('ZUM-' + Date.now());
    const name = String(body.name || '').slice(0, 120);
    const email = String(body.email || '').slice(0, 180);
    const company = String(body.company || '').slice(0, 180);
    const category = String(body.category || 'Support request').slice(0, 120);
    const message = String(body.message || '').slice(0, 5000);
    const source = String(body.source || '').slice(0, 80);
    const pageUrl = String(body.page_url || '').slice(0, 500);
    const userAgent = String(body.user_agent || '').slice(0, 500);
    if (!email || !message) return { statusCode: 400, headers: cors, body: JSON.stringify({ ok: false, error: 'Email and message are required.' }) };
    const apiKey = process.env.RESEND_API_KEY;
    const to = process.env.ZUMMEE_SUPPORT_EMAIL || 'support@zummee.net';
    const from = process.env.ZUMMEE_SUPPORT_FROM || 'Zummee Support <support@mail.zummee.net>';
    if (!apiKey) return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: 'Support email is not configured.' }) };
    const html = `
      <div style="font-family:Arial,sans-serif;color:#102f4a;line-height:1.5">
        <h2>New Zummee Support Ticket</h2>
        <p><strong>Ticket:</strong> ${escapeHtml(ticketId)}</p>
        <p><strong>Category:</strong> ${escapeHtml(category)}</p>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company / Community:</strong> ${escapeHtml(company)}</p>
        <p><strong>Source:</strong> ${escapeHtml(source)}</p>
        <hr />
        <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
        <hr />
        <p><strong>Page:</strong> ${escapeHtml(pageUrl)}</p>
        <p><strong>User Agent:</strong> ${escapeHtml(userAgent)}</p>
      </div>`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, reply_to: email, subject: `[Zummee Support] ${ticketId} - ${category}`, html })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { statusCode: 502, headers: cors, body: JSON.stringify({ ok: false, error: result.message || 'Support email failed.' }) };
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true, ticket_id: ticketId, email_id: result.id || null }) };
  } catch (err) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ ok: false, error: err.message || 'Unexpected error' }) };
  }
};
function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (ch) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}
