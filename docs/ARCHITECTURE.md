# Architecture

How the app works end to end. For the schema see [DATABASE.md](DATABASE.md); for the import JSON see [PROGRAMME_FORMAT.md](PROGRAMME_FORMAT.md).

## Big picture

Static React SPA (Cloudflare Pages) talking directly to Supabase — there is no API server. The browser holds a Supabase session (Google OAuth) and queries PostgreSQL through supabase-js; row-level security is the authorization layer.

```
Browser (React SPA) ──supabase-js──▶ Supabase (PostgreSQL + Auth + RLS)
        ▲
        └── served as static files by Cloudflare Pages
```

## Auth flow

- `LoginPage` calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`. Supabase brokers the whole OAuth dance; Google only ever redirects to the Supabase callback URL, which then redirects back to the app origin. This means the app origin must be in Supabase's **Redirect URLs** allow-list (Authentication → URL Configuration) but does **not** need to be a Google authorized JavaScript origin.
- Every authed route is wrapped in `AuthGuard` (`App.tsx`), which resolves the session (`getSession`), subscribes to `onAuthStateChange`, and bounces to `/login` on sign-out. `session === undefined` renders a loading screen — this distinguishes "still checking" from "definitely signed out".
- `Layout` renders the sign-out button; supabase-js persists the session in `localStorage` and auto-refreshes tokens.

## Routing

| Route | Page | Notes |
|---|---|---|
| `/login` | `LoginPage` | Only unauthed route |
| `/` | `RootRedirect` | → `/train` if the user has an active `user_programmes` row, else `/select` |
| `/select` | `ProgrammeSelectPage` | Enrol: pick programme + start date |
| `/train` | `WeekViewPage` | Shows the **current** week |
| `/train/week/:week` | `WeekViewPage` | Shows any week |
| `/train/week/:week/session/:session` | `SessionLoggerPage` | Log a workout |
| `/progress` | `ProgressPage` | Charts + history |
| `/import` | `ImportPage` | Paste/preview/import programme JSON |
| `*` | redirect to `/` | |

Direct URL access works in production because `public/_redirects` rewrites everything to `index.html` (Cloudflare Pages convention).

## Key algorithms

### Current week (`lib/utils.ts` → `getCurrentWeek`)

```
week = clamp(floor(calendarDaysSince(start_date) / 7) + 1, 1, total_weeks)
```

Week 1 starts on the enrolment `start_date`; the result is clamped so a finished programme pins to its last week rather than running past the end.

### Enrolment (`ProgrammeSelectPage`)

Starting a programme first sets `active = false` on any existing active `user_programmes` rows, then inserts a new active row. Old rows are kept — `workout_logs` reference `user_programmes.id`, so history survives switching programmes (but the Progress page only shows logs for the *active* enrolment).

### Pre-fill / "last time" labels (`SessionLoggerPage`)

For each exercise in the session, the page fetches that exercise's most recent logs (ordered by `logged_at` desc), groups them by `week-session`, drops the group belonging to the session being edited, and takes the newest remaining group. Those per-set values become:

- the input pre-fill (unless the current session already has saved logs, which win), and
- the "Last time: Xkg × Y reps" label under each set row.

Matching is by `exercise_name` **string**, not ID — see the design notes in [DATABASE.md](DATABASE.md).

### Save semantics (`SessionLoggerPage` → `saveSession`)

Save is an upsert at session granularity: delete all `workout_logs` for `(user_programme_id, week, session)`, then insert one row per set that has a weight **or** reps value. Untouched exercises still save — the save buffer (`allSetsRef`) is seeded from the pre-fill values on load, so what you see in the inputs is what gets saved. The delete + insert is two requests (not transactional); a failure between them loses that session's rows, but the on-screen inputs still hold the data so re-saving recovers.

### Import expansion (`ImportPage`)

Each `week_group` is expanded client-side: for every week in `applies_to_weeks` × every session in the group, insert a `programme_sessions` row, then bulk-insert its `session_exercises`. Finally every distinct exercise name is upserted into `exercise_definitions`. Re-importing a same-named programme deletes the old one first (after a confirm) — the FK cascade wipes its sessions, exercises, **enrolments, and logs**.

### Progress chart (`ProgressChart`)

Hand-rolled SVG, no chart library. For the selected exercise: max `weight_kg` per week → line + dots, x-scaled over `total_weeks`, y-scaled between the min and max logged weight. Stats row shows first-log date, best set, and number of distinct weeks logged.

### Session tools (`SessionTools`)

The rest timer and plate calculator live in a bar fixed to the bottom of the session logger. It's rendered through a React portal to `document.body` because `<main>` carries a CSS animation whose transform would otherwise become the containing block and break `position: fixed`. The completion beep's `AudioContext` is created inside the start-button click handler — autoplay policy blocks audio contexts created outside a user gesture. Plate inventory and bar weight persist in `localStorage` (device-level preference, not synced).

### PR detection

`SessionLoggerPage` fetches each exercise's best-ever `weight_kg` (all programmes, excluding the session being edited) alongside the pre-fill query. `ExerciseLogger` shows a 🏆 badge live on any set row whose typed weight beats it. First-ever sessions show no badges — there's no baseline to beat.

### Volume & 1RM

Volume is `Σ weight × reps` per session — computed live in the logger, shown on logged week-view cards, and totalled per exercise on the progress stats. Estimated 1RM uses Epley (`w × (1 + reps/30)`, `lib/utils.ts`), taking the best single set across all logs.

## Conventions

- **Styling** is 100% inline style objects with the shared dark palette in `lib/utils.ts` (`colors`). No CSS framework, no CSS modules — keep it that way for consistency.
- **Phase accents**: pages resolve the current phase via `getPhaseForWeek` and thread its `accent_color` through week strip, session cards, logger, and charts; default is `colors.green`.
- **Types** in `lib/types.ts` mirror the DB tables 1:1 (snake_case fields), plus the camelCase `SetLog` used for in-flight logger state.
- **Error handling** is optimistic: reads assume happy path (`data ?? []`), the import page is the only flow that surfaces errors verbosely.
