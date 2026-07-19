# Database reference

All tables live in Supabase PostgreSQL. The full DDL is in [`supabase/schema.sql`](../supabase/schema.sql) — run it once in the Supabase SQL editor. This document explains what each table is for and how they relate.

## Entity overview

```
programmes ─┬─< programme_sessions ─< session_exercises
            │
            └─< user_programmes >─ auth.users
                     │
                     └─< workout_logs
```

Programme data (templates) is shared across all users. User data (`user_programmes`, `workout_logs`) is private to each user via row-level security.

## Tables

### `programmes`

One row per training programme template.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT | Import overwrites match on this |
| `description` | TEXT | Shown on the programme select card |
| `total_weeks` | INT | Length of the programme |
| `sessions_per_week` | INT | Informational; sessions are defined per week below |
| `phases` | JSONB | Array of phase objects: `{name, weeks_start, weeks_end, description, rpe, rest, tempo, accent_color}` |
| `created_at` | TIMESTAMPTZ | |

### `programme_sessions`

One row per **week + session** combination — a 12-week, 4-session programme has 48 rows. The importer expands `applies_to_weeks` ranges into these rows.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `programme_id` | UUID FK → programmes | `ON DELETE CASCADE` |
| `week_number` | INT | 1-based |
| `session_number` | INT | 1-based within the week |
| `label` | TEXT | e.g. "Upper Body - Push + Pull" |
| `notes` | TEXT | |

Unique on `(programme_id, week_number, session_number)`.

### `session_exercises`

The exercises prescribed in one `programme_sessions` row, in display order.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `programme_session_id` | UUID FK → programme_sessions | `ON DELETE CASCADE` |
| `exercise_name` | TEXT | Free text; joins to logs by name, not FK |
| `order_index` | INT | Display order within the session |
| `target_sets` | INT | Number of set rows shown in the logger |
| `target_reps` | TEXT | Free text, e.g. `"8-10"` |
| `notes` | TEXT | Coaching cue shown under the exercise name |
| `superset_group` | TEXT | e.g. `"A"` — exercises sharing a group get a superset badge |
| `is_drop_set` | BOOLEAN | Shows a drop-set badge |

### `exercise_definitions`

A registry of every exercise name seen, auto-populated during import (`ON CONFLICT DO NOTHING` on `name`). Not currently read by the app; exists for future features like muscle-group filtering.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `name` | TEXT UNIQUE | |
| `muscle_group` | TEXT | Nullable, unused for now |
| `created_at` | TIMESTAMPTZ | |

### `user_programmes`

A user's enrolment in a programme. Only one row per user should have `active = true`; starting a new programme deactivates the old one first (done client-side in `ProgrammeSelectPage`).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | Referenced by workout_logs, so history survives programme switches |
| `user_id` | UUID FK → auth.users | `ON DELETE CASCADE` |
| `programme_id` | UUID FK → programmes | `ON DELETE CASCADE` |
| `start_date` | DATE | Week 1 starts here; current week = `floor(daysSince / 7) + 1` |
| `active` | BOOLEAN | |
| `created_at` | TIMESTAMPTZ | |

### `workout_logs`

The actual training data: **one row per set performed**. Saving a session deletes all rows for that `(user_programme_id, week_number, session_number)` and inserts fresh — an upsert at session granularity.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | Needed for RLS |
| `user_programme_id` | UUID FK → user_programmes | `ON DELETE CASCADE` |
| `week_number` | INT | |
| `session_number` | INT | |
| `exercise_name` | TEXT | Matches `session_exercises.exercise_name` by string |
| `set_number` | INT | 1-based |
| `weight_kg` | NUMERIC(6,2) | Nullable — bodyweight/skipped sets |
| `reps` | INT | Nullable |
| `notes` | TEXT | Unused by the UI currently |
| `logged_at` | TIMESTAMPTZ | Used to find the "most recent previous session" for pre-fill |

### `body_weight_logs`

Weekly (or whenever) weigh-ins, one row per user per day — logging twice on the same day overwrites via upsert on the unique constraint.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | `ON DELETE CASCADE` |
| `logged_date` | DATE | Defaults to today; unique with `user_id` |
| `weight_kg` | NUMERIC(5,2) | |
| `created_at` | TIMESTAMPTZ | |

### `daily_metrics`

Calories consumed and daily step count, one row per user per day. Both columns are nullable so either can be logged alone; the upsert only sends filled fields, so logging one never nulls the other.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | `ON DELETE CASCADE` |
| `logged_date` | DATE | Defaults to today; unique with `user_id` |
| `calories` | INT | Nullable |
| `steps` | INT | Nullable |
| `created_at` | TIMESTAMPTZ | |

## Row-level security

RLS is enabled on every table.

- **Template tables** (`programmes`, `programme_sessions`, `session_exercises`, `exercise_definitions`): any authenticated user can read; insert/delete allowed for authenticated users so the Import page works. There is no roles system — anyone signed in can import or overwrite programmes. Fine for a single-user or trusted-group deployment; add an admin check if that changes.
- **User tables** (`user_programmes`, `workout_logs`, `body_weight_logs`, `daily_metrics`): `FOR ALL USING (auth.uid() = user_id)` — users can only see and modify their own rows.

## Design notes

- **Exercises join by name, not ID.** `workout_logs.exercise_name` is a string matched against `session_exercises.exercise_name`. This keeps history intact when a programme is re-imported (which deletes and recreates all session/exercise rows with new UUIDs). The trade-off: renaming an exercise in the JSON breaks the link to old logs and pre-fill.
- **Re-import deletes history-independent template data only.** Deleting a programme cascades to `programme_sessions` and `session_exercises`, but `user_programmes` rows pointing at it are also cascaded — **re-importing over a programme users are enrolled in will delete their enrolment and logs**. Import prompts for confirmation before overwriting for this reason.
- **Save is not transactional.** The delete + insert happens as two requests from the client. A failed insert after a successful delete would lose that session's logs (they'd still be in the inputs on-screen, so re-saving recovers).
