Emergency alert history page added.

What changed:
- new page: emergency_text_history.html
- emergency_texting.html now links to View Alert History
- send-emergency-text now stores company_id on new log rows when available

Deploy steps:
1. Deploy site build to Netlify
2. Redeploy send-emergency-text with --no-verify-jwt
