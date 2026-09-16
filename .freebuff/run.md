# NurtureLoop — Preview Run Doc

Plain static multi-page site. **No package.json, no build step, no dependencies, no env files.**

Pages: `index.html` (landing, entry) → `app.html`, `journey.html`, `care-plan.html`, `carebridge.html`, `more.html` — sharing `assets/i18n.js` and `assets/nurtureloop.js`.

## Artifacts to reproduce

None. A fresh checkout needs no copying and no install.

Do NOT use the single-file `htmlPath` preview mode: it only serves `index.html`, so
"Enter NurtureLoop" and every cross-page link would 404. Always run the HTTP server below.

## How to run the server

From the project root, serve on **127.0.0.1:8742** (this project's established port; keep it
unless taken — if taken, pick a free port and pass it instead):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'python.exe' -ArgumentList '-m','http.server','8742','--bind','127.0.0.1' -WorkingDirectory 'C:\Users\dhurg\Documents\NutureLoop' -RedirectStandardOutput 'C:\Users\dhurg\Documents\NutureLoop\.freebuff\preview.log' -RedirectStandardError 'C:\Users\dhurg\Documents\NutureLoop\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

- stdout and stderr must go to different files (PowerShell requirement).
- Register `http://127.0.0.1:8742/index.html` with the pid that the command prints.
- Verify: `curl http://127.0.0.1:8742/index.html` → 200.

## Notes

- When editing `assets/*.js`, bump the `?v=N` query in the `<script src>` tags across all six
  pages (currently `?v=4`) or browsers may serve stale cached copies.
- The app persists the chosen language (`en`/`ta`/`hi`) in localStorage under `nl-lang`;
  it carries across landing ↔ app navigation by design.
