// Netlify Function: secure AI transcription for Board Meetings
// Required environment variable: OPENAI_API_KEY

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!process.env.OPENAI_API_KEY) {
    return json(500, { error: 'OPENAI_API_KEY is not configured in Netlify environment variables.' });
  }

  try {
    const parsed = await readIncomingAudio(event);
    const file = parsed.file;
    const meeting = parsed.meeting || null;

    if (!file) return json(400, { error: 'Missing audio file payload.' });
    if (!file.size) return json(400, { error: 'Audio file is empty. Please record again.' });

    const form = new FormData();
    form.append('file', file, parsed.filename || file.name || 'board-meeting.webm');
    form.append('model', process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
    form.append('response_format', 'json');
    form.append('prompt', 'This is an HOA board meeting. Preserve names, motions, votes, action items, vendor names, community names, and dates accurately.');

    const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form
    });

    const transcriptionJson = await transcriptionResponse.json().catch(() => ({}));
    if (!transcriptionResponse.ok) {
      return json(transcriptionResponse.status, {
        error: transcriptionJson.error?.message || 'OpenAI transcription failed.',
        details: {
          filename: parsed.filename || file.name || null,
          mimeType: file.type || parsed.mimeType || null,
          size: file.size || null
        }
      });
    }

    const transcript = transcriptionJson.text || transcriptionJson.transcript || '';
    const ai = transcript ? await summarizeTranscript(transcript) : { summary: '', action_items: [] };

    return json(200, {
      transcript,
      summary: ai.summary || '',
      action_items: Array.isArray(ai.action_items) ? ai.action_items : [],
      meeting,
      audio: {
        filename: parsed.filename || file.name || null,
        mimeType: file.type || parsed.mimeType || null,
        size: file.size || null
      }
    });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected transcription error.' });
  }
};

async function readIncomingAudio(event) {
  const headers = normalizeHeaders(event.headers || {});
  const contentType = headers['content-type'] || '';

  // Preferred path: browser sends multipart/form-data with a real File and filename.
  if (contentType.includes('multipart/form-data')) {
    const bodyBuffer = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'binary');

    const req = new Request('https://zummee.local/transcribe', {
      method: 'POST',
      headers: { 'content-type': contentType },
      body: bodyBuffer
    });

    const form = await req.formData();
    const file = form.get('file');
    const filename = String(form.get('filename') || (file && file.name) || 'board-meeting.webm');
    const mimeType = String(form.get('mimeType') || (file && file.type) || 'audio/webm');
    let meeting = null;
    try { meeting = JSON.parse(String(form.get('meeting') || 'null')); } catch (_) {}

    return { file, filename, mimeType, meeting };
  }

  // Backward-compatible fallback for older JSON builds.
  const body = JSON.parse(event.body || '{}');
  if (!body.audioBase64) return { file: null };

  const mimeType = body.mimeType || 'audio/webm';
  const filename = body.filename || filenameFromMime(mimeType);
  const audioBuffer = Buffer.from(body.audioBase64, 'base64');
  const file = new File([audioBuffer], filename, { type: mimeType });
  return { file, filename, mimeType, meeting: body.meeting || null };
}

async function summarizeTranscript(transcript) {
  try {
    const summaryResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_SUMMARY_MODEL || 'gpt-4.1-mini',
        input: [
          { role: 'system', content: 'You turn HOA board meeting transcripts into concise board-ready summaries. Return strict JSON only.' },
          { role: 'user', content: `Return JSON with keys summary, motions, votes, action_items, follow_ups. Transcript:\n\n${transcript}` }
        ],
        text: { format: { type: 'json_object' } }
      })
    });

    const summaryJson = await summaryResponse.json().catch(() => ({}));
    const raw = summaryJson.output_text || summaryJson.output?.[0]?.content?.[0]?.text || '';
    const parsed = JSON.parse(raw || '{}');
    return {
      summary: parsed.summary || '',
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items : []
    };
  } catch (_) {
    return { summary: '', action_items: [] };
  }
}

function filenameFromMime(mimeType) {
  const t = String(mimeType || '').toLowerCase();
  if (t.includes('mp4') || t.includes('m4a') || t.includes('aac')) return 'board-meeting.m4a';
  if (t.includes('mpeg') || t.includes('mp3')) return 'board-meeting.mp3';
  if (t.includes('wav')) return 'board-meeting.wav';
  if (t.includes('ogg')) return 'board-meeting.ogg';
  return 'board-meeting.webm';
}

function normalizeHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers || {})) out[String(k).toLowerCase()] = v;
  return out;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(payload)
  };
}
