# PTracker — Goals, Tasks & Opportunity Tracker

A mobile-style PWA for tracking goals, tasks and milestones — plus an
**Opportunities section** that aggregates internships and jobs from 20+
sources and matches them to each user's career profile.

Built with vanilla JavaScript + Vite (no framework), Firebase Auth,
Cloud Firestore and Cloud Functions.

## Features

- **Tracker** — goals, tasks, subtasks, real-time cross-device sync,
  calendar, progress stats, custom themes/backgrounds, PWA install.
- **Opportunities** — career profile (degree, branch, skills, interests,
  preferred roles/locations), aggregated listings from 20+ websites,
  keyword match scores (0–100%), filters (Internship/Job, India/Global,
  search, sort), bookmarks, manual "Sync now".

## Getting started

```bash
npm install
cp .env.example .env   # fill in your Firebase web app config
npm run dev
```

The app runs in **local-only mode** (setup screen) until Firebase is
configured. Enable Google / Email / Anonymous auth and create a Firestore
database in the Firebase console.

## Opportunities section setup

The listings are written exclusively by a scraper (client writes are denied
by `firestore.rules`). **Pick ONE of the two runtimes below** — both use the
same adapters and write the same data.

### Option A — GitHub Actions (free, no card required) ✅ recommended

Runs the scraper as a scheduled workflow: free unlimited minutes on public
repos, nothing to deploy, no Firebase billing.

1. Create a **service account key** so the Action can write to Firestore:
   Firebase console → Project settings → Service accounts →
   **Generate new private key** (JSON).
2. On GitHub: repo → Settings → Secrets and variables → Actions →
   **New repository secret**:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` — the **entire JSON file content**
3. Optional sources keys (also repo secrets, same place):
   `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`, `CAREERJET_AFFID`
4. Push the repo — the workflow `.github/workflows/sync-opportunities.yml`
   runs every 6 hours. You can also trigger it manually:
   repo → **Actions** → Sync opportunities → **Run workflow**.

### Option B — Cloud Functions (requires Blaze/billing)

```bash
firebase deploy --only functions
firebase functions:secrets:set ADZUNA_APP_ID     # etc.
```

Scheduled every 6 hours; also enables the in-app **Sync** button
(Option A users sync from the Actions tab instead).

With either option: listings older than 45 days are pruned automatically,
and per-source health (counts, skips, errors) is visible in the
`sync_meta` Firestore collection — and in-app via the underlined
"Synced … · N sources" line on the Jobs screen.

### One-tap sync (optional, free)

By default the in-app Sync button opens the GitHub Actions page. To make
it trigger a real sync with one tap, deploy the tiny trigger proxy in
`workers/sync-trigger.js` on Cloudflare's free tier (no card):

1. Create a fine-grained GitHub PAT: Settings → Developer settings →
   Fine-grained tokens → **only this repo**, permission
   **Actions: Read and write**.
2. Cloudflare dashboard → Workers & Pages → Create Worker → paste
   `workers/sync-trigger.js` → deploy → Settings → Variables:
   - `GH_PAT` (Secret) — the token
   - `GH_REPO` — `sakshamwadhankar/Internship-Tracker-IEEE`
   - `ALLOWED_ORIGINS` — `https://ptracker-app-7117.web.app,http://localhost:5173`
3. Put the worker URL in `.env` as `VITE_SYNC_TRIGGER_URL` and rebuild.

The scheduled GitHub Action stays in charge either way; the button just
adds an on-demand run.

## Sources (20)

| Type | Sources |
| --- | --- |
| Public/official APIs | Adzuna (IN/GB/US), Remotive, Arbeitnow, Jooble, The Muse, Jobicy, HN "Who is hiring" (Algolia), SmartRecruiters, Careerjet, We Work Remotely (RSS) |
| Multi-company ATS boards | Greenhouse, Lever, Ashby (each covers many companies — extend the token lists in `functions/src/sources/*.js`) |
| Indian boards (HTML) | Internshala, Naukri, Unstop, Instahyre, LetIntern, Cutshort |
| ToS-flagged (disabled) | LinkedIn guest endpoint (`functions/src/sources/linkedin.js`, opt-in) |

**Note on scraping:** LinkedIn/Indeed prohibit scraping in their terms of
service; the plan relies on official APIs wherever possible. Indian board
adapters are best-effort — if a site changes its markup, that source fails
*in isolation* and its error is visible in `sync_meta/{sourceId}`.

## Adding a source

1. Create `functions/src/sources/<name>.js`:

   ```js
   import { fetchJson } from './lib.js';
   export default {
     id: 'myboard', name: 'My Board', region: 'india', kind: 'api',
     requires: ['MYBOARD_KEY'],           // optional
     async fetchJobs({ fetchImpl, env } = {}) { /* return raw jobs */ },
   };
   ```

2. Register it in `functions/src/sources/index.js`.
3. Raw jobs are normalized + deduped automatically
   (doc ID = hash of company|title|applyUrl).

## Development

```bash
npm test                 # client unit tests (node --test)
cd functions && npm i && npm test   # functions unit tests
```

- `src/utils.js` — pure helpers incl. `scoreOpportunity`
  (skills 50 / roles 20 / location 15 / degree 10 / recency 5)
- `src/opportunities.js` — Firestore data layer for profile, listings,
  bookmarks, sync status
- `functions/src/` — scraper: `sync.js` (engine), `normalize.js`
  (canonical shape + dedupe), `sources/` (adapters)

## Deploy

```bash
npm run build           # or: firebase deploy (hosting + functions + rules)
```
