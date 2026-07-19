# GymTracker

A full-stack gym workout tracker. Log in with Google, pick a training programme, and track your workouts week by week. The app knows which week you're on from your programme start date, and when you log a session it pre-fills each exercise with what you lifted last time.

Replaces a previous localStorage-based single-page app — all data now lives in Supabase.

**Live at [gymtracker-cwh.pages.dev](https://gymtracker-cwh.pages.dev)** (Cloudflare Pages project `gymtracker`).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + TypeScript, built with Vite 8 |
| Routing | React Router v7 |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Auth | Google OAuth only (via Supabase) |
| Hosting | Cloudflare Pages (static SPA) |
| Styling | Inline styles, dark theme — no CSS framework |

## Features

- **Google sign-in** — no passwords, no sign-up flow.
- **Programme enrolment** — pick a programme, set a start date; the current week is calculated automatically from that date.
- **Week view** — week strip (W1–W12…), phase banner (RPE / rest / tempo per phase), session cards with a "Logged" badge once saved.
- **Session logger** — one card per exercise with a row per set. Weight and reps are pre-filled from your most recent session for that exercise, with a "Last time: Xkg × Y reps" reference label under each row. Superset and drop-set badges. Save is an upsert: re-saving a session replaces its logs.
- **Rest timer** — sticky bar in the session logger: 1:00 / 1:30 / 2:00 presets, +15s extension, and a beep + vibration when time's up.
- **PR detection** — type a weight that beats your best-ever for that exercise and a 🏆 PR badge appears on the set row, live.
- **Plate calculator** — enter a target weight and get the per-side plate breakdown; bar weight and your plate inventory are configurable (saved on-device).
- **Session stats** — live total volume (kg) while logging, a "Workout completed in X min · Y kg" banner on save, and per-session volume on the week view cards.
- **Progress** — SVG line chart of top set weight per week per exercise, plus best-set / estimated-1RM (Epley) / total-volume / weeks-logged stats and a full set history table.
- **Bodyweight tracking** — quick weigh-in entry on the Progress page with a date-scaled trend line and change-since-start.
- **JSON import** — paste a programme definition, preview it, and import. Week ranges like `"1-4"` or `"1,3,5"` expand into per-week session rows. Re-importing a programme with the same name prompts before overwriting.

## Getting started

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql) — this creates all tables and row-level-security policies.

### 2. Google OAuth

1. In [Google Cloud Console](https://console.cloud.google.com): create a project → APIs & Services → Credentials → Create OAuth 2.0 Client ID (Web application).
2. Add the authorised redirect URI: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback` — this is the only Google-side URL needed; Supabase brokers the OAuth flow, so app domains do **not** need to be Google authorised JavaScript origins.
3. In Supabase: Authentication → Providers → Google → paste the Client ID and Client Secret, enable.
4. In Supabase: Authentication → URL Configuration → set the Site URL to your production domain and add **both** the production domain and `http://localhost:5173` to Redirect URLs. The app redirects back to `window.location.origin` after login, and Supabase only allows redirects on this list.

### 3. Environment

```sh
cp .env.example .env
```

Fill in both values (Supabase dashboard → Settings → API):

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 4. Run

```sh
npm install
npm run dev      # http://localhost:5173
```

### 5. Import a programme

Sign in, go to **Import**, paste a programme JSON (format documented in [`docs/PROGRAMME_FORMAT.md`](docs/PROGRAMME_FORMAT.md) — a ready-made example is in [`docs/programme-upper-lower-4day.json`](docs/programme-upper-lower-4day.json)), Preview, then Import. Go back to the home page to enrol in it.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with HMR on port 5173 |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run lint` | Lint with oxlint |
| `npm run preview` | Serve the production build locally |

## Deploying to Cloudflare Pages

The site is deployed by **direct upload** with wrangler (no git integration):

```sh
npm run build
CLOUDFLARE_API_TOKEN=<token> npx wrangler pages deploy dist --project-name=gymtracker --branch=main
```

- The token needs Pages edit permissions (the "Edit Cloudflare Workers" template covers it).
- Because the build runs locally, `VITE_SUPABASE_*` values are baked into the bundle from your local `.env` at build time — no environment variables are needed in the Pages project settings.
- `public/_redirects` (already in the repo) rewrites all paths to `index.html` so React Router works on direct URL access.
- One-time setup for a new project: `npx wrangler pages project create <name> --production-branch=main`.

Remember to add the production domain to Supabase's allowed redirect URLs (Authentication → URL Configuration, see [Google OAuth](#2-google-oauth) above) — otherwise sign-in redirects fall back to the Site URL.

## Project structure

```
src/
  lib/
    supabase.ts        Supabase client (fails fast if env vars missing)
    types.ts           Shared TypeScript types mirroring the DB schema
    utils.ts           Week calculation, phase lookup, week-range parser, colour palette
  components/
    Layout.tsx         Sticky header, nav, sign-out; wraps every authed page
    PhaseBar.tsx       Phase banner (name, RPE, rest, tempo, description)
    ExerciseLogger.tsx One exercise card: set rows, pre-fill, "last time" labels
    ProgressChart.tsx  SVG line chart + stats for one exercise
  pages/
    LoginPage.tsx           /login
    ProgrammeSelectPage.tsx /select
    WeekViewPage.tsx        /train and /train/week/:week
    SessionLoggerPage.tsx   /train/week/:week/session/:session
    ProgressPage.tsx        /progress
    ImportPage.tsx          /import
  App.tsx              Router + AuthGuard + root redirect
  main.tsx             Entry point
supabase/
  schema.sql           Full database schema + RLS policies
docs/
  ARCHITECTURE.md      How the app works: auth, routing, data flow, key algorithms
  DATABASE.md          Table-by-table schema reference
  PROGRAMME_FORMAT.md  JSON import format specification
  programme-upper-lower-4day.json  Example importable programme (12-week upper/lower split)
```

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — auth flow, week calculation, pre-fill logic, save semantics
- [docs/DATABASE.md](docs/DATABASE.md) — every table, column, and RLS policy explained
- [docs/PROGRAMME_FORMAT.md](docs/PROGRAMME_FORMAT.md) — how to write an importable programme JSON
