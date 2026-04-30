# v409b Netlify Function Deploy Notes

This build includes a server-side Netlify Function for board item photo uploads:

`netlify/functions/upload-board-photo.js`

Required Netlify environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Important: Netlify drag-and-drop deploys can upload static files but may not build/deploy functions. Deploy this build through Git or Netlify CLI.

CLI deploy:

```bash
npm install
netlify deploy --prod
```

After deploy, verify the function exists:

```text
https://zummee.net/.netlify/functions/upload-board-photo
```

A non-404 response means the function deployed. A 405 Method Not Allowed is acceptable when opened directly in the browser because the function expects POST.
