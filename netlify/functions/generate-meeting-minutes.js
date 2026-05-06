// Netlify Function: create complete, editable HOA board meeting minutes
// Uses transcript + structured page data (attendance, agenda, homeowner forum, new business, notes).
// Required environment variable: OPENAI_API_KEY

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!process.env.OPENAI_API_KEY) {
    return json(500, { error: 'OPENAI_API_KEY is not configured in Netlify environment variables.' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const transcript = String(body.transcript || '').trim();
    const agenda = String(body.agenda || '').trim();
    const meeting = body.meeting || {};
    const sources = normalizeSources(body.sources || {});

    if (!transcript && !hasStructuredSources(sources)) {
      return json(400, { error: 'Missing transcript or structured meeting sources.' });
    }

    const prompt = buildPrompt({ transcript, agenda, meeting, sources });

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MINUTES_MODEL || process.env.OPENAI_SUMMARY_MODEL || 'gpt-4.1-mini',
        input: [
          {
            role: 'system',
            content: [
              'You are drafting formal HOA board meeting minutes for employee review.',
              'Use structured page data as the source of truth and the transcript to add context.',
              'Do not invent motions, seconds, vote counts, attendees, adjournment times, or facts.',
              'Merge duplicate topics across transcript, agenda, homeowner forum, new business, and notes.',
              'Preserve manually entered items, but rewrite them in professional board-minutes style.',
              'Output only the finished minutes draft. No explanations.'
            ].join(' ')
          },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json(response.status, { error: data.error?.message || 'OpenAI minutes generation failed.' });
    }

    const minutes = extractText(data).trim();
    return json(200, { minutes, meeting, sourcesUsed: Object.keys(sources).filter(Boolean) });
  } catch (err) {
    return json(500, { error: err.message || 'Unexpected minutes generation error.' });
  }
};

function normalizeSources(sources) {
  return {
    attendance: Array.isArray(sources.attendance) ? sources.attendance : [],
    agenda: sources.agenda || {},
    homeownerOpenForum: Array.isArray(sources.homeownerOpenForum) ? sources.homeownerOpenForum : [],
    newBusiness: Array.isArray(sources.newBusiness) ? sources.newBusiness : [],
    quickNotes: Array.isArray(sources.quickNotes) ? sources.quickNotes : [],
    template: sources.template || ''
  };
}

function hasStructuredSources(sources) {
  return Boolean(
    sources.attendance.length ||
    sources.homeownerOpenForum.length ||
    sources.newBusiness.length ||
    sources.quickNotes.length ||
    (sources.agenda && (sources.agenda.text || sources.agenda.date || sources.agenda.location))
  );
}

function buildPrompt({ transcript, agenda, meeting, sources }) {
  const present = sources.attendance.filter(a => a.present).map(a => a.name).join(', ') || 'Not stated';
  const absent = sources.attendance.filter(a => !a.present).map(a => a.name).join(', ') || 'None stated';
  const agendaObj = sources.agenda || {};
  const meetingDate = agendaObj.date || meeting.meetingDate || meeting.date || 'Not stated';
  const meetingTime = agendaObj.time || meeting.meetingTime || meeting.time || meeting.meetingStartedAt || 'Not stated';
  const location = agendaObj.location || meeting.location || meeting.meetingLocation || 'Not stated';
  const ended = meeting.meetingEndedAt || meeting.endedAt || meeting.recordingEndedAt || 'Not stated';

  return `Create complete HOA board meeting minutes using the sample format below and the collected meeting data.

TARGET FORMAT STYLE:
Association/Community Name
Minutes: Board of Directors Meeting
Meeting date and time
Physical location and/or Zoom/WebEx link

Board Members Present: [names]
Board Members Absent: [names]
Property Managers Present: [names if stated, otherwise Not stated]

Meeting called to order by [person/title if stated] at [time]. Board of Directors quorum established [if supported by attendance or transcript; otherwise write Quorum: Not stated].

Motion: [formal motion text]
Vote: [vote result/count]

Board and Committee Reports
1. ...

Property Management Report
1. ...

Financial Report
1. ...

Old Business
1. ...

New Business
1. ...

Homeowner Open Forum
1. ...

Motion: Adjourn Meeting
Vote: [vote result/count]

The [President/Chair/Board] adjourned the meeting at [time].

IMPORTANT ASSEMBLY RULES:
- Use structured data below as the source of truth when it conflicts with transcript.
- Use the transcript to add context, decisions, motions, discussion details, and missing descriptions.
- Merge duplicate items. If a topic appears in New Business and the transcript, write it once in the most appropriate section.
- Preserve manually entered Homeowner Open Forum and New Business items, but polish wording.
- Do not invent motions, vote counts, mover/second, attendees, owners, dates, or adjournment time.
- If no formal motion or vote was captured, do not create one. Write only discussion/decision language.
- If a required section has no support, write "No report" or "Not stated" as appropriate.
- Keep the tone professional, concise, and suitable to send to the board for approval after employee review.
- Output plain text only. No markdown tables.

MEETING DETAILS FROM PAGE:
Community/Association: ${meeting.communityName || 'Not stated'}
Meeting Date: ${meetingDate}
Meeting Time: ${meetingTime}
Location / Zoom: ${location}
Meeting Started At: ${meeting.meetingStartedAt || 'Not stated'}
Meeting Ended / Adjourned At: ${ended}
Generated At: ${meeting.generatedAt || 'Not stated'}

ATTENDANCE FROM PAGE:
Board Members Present: ${present}
Board Members Absent: ${absent}

AGENDA FROM PAGE:
${agendaObj.text || agenda || 'Not provided'}

HOMEOWNER OPEN FORUM FROM PAGE:
${sources.homeownerOpenForum.length ? sources.homeownerOpenForum.map((x, i) => `${i + 1}. ${x}`).join('\n') : 'None entered'}

NEW BUSINESS FROM PAGE:
${sources.newBusiness.length ? sources.newBusiness.map((x, i) => `${i + 1}. [${x.status || 'manual'}] ${x.text || x}`).join('\n') : 'None entered'}

QUICK NOTES / MANUAL EMPLOYEE NOTES:
${sources.quickNotes.length ? sources.quickNotes.map((x, i) => `${i + 1}. ${x}`).join('\n') : 'None entered'}

TRANSCRIPT:
${transcript || 'No transcript provided. Use structured data only.'}`;
}

function extractText(data) {
  if (typeof data.output_text === 'string') return data.output_text;
  try {
    const parts = [];
    for (const item of data.output || []) {
      for (const content of item.content || []) {
        if (content.text) parts.push(content.text);
      }
    }
    return parts.join('\n');
  } catch (_) {
    return '';
  }
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
