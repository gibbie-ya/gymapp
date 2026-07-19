# Programme JSON format

The Import page (`/import`) accepts a JSON document describing a full training programme. Paste it, hit **Preview** to validate, then **Import**. A working example is in [`programme-upper-lower-4day.json`](programme-upper-lower-4day.json).

## Top-level shape

```json
{
  "name": "Upper/Lower 4-Day",
  "description": "Optional text shown on the programme select card",
  "total_weeks": 12,
  "sessions_per_week": 4,
  "phases": [],
  "week_groups": []
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | Re-importing with the same name prompts to delete and replace the existing programme |
| `description` | string | | Shown on the programme select card |
| `total_weeks` | number | ✓ | Drives the week strip and current-week calculation |
| `sessions_per_week` | number | | Informational only; actual sessions come from `week_groups` |
| `phases` | array | | See [Phases](#phases). Empty array is fine |
| `week_groups` | array | ✓ | See below |

## Week groups

A week group defines a set of sessions and the weeks they apply to. The importer **expands** each group into one `programme_sessions` row per week × session, so a group covering weeks 1–12 with 4 sessions becomes 48 rows.

```json
{
  "applies_to_weeks": "1-4",
  "sessions": [ ... ]
}
```

`applies_to_weeks` accepts:

- a range: `"1-4"` → weeks 1, 2, 3, 4
- a list: `"1,3,5"` → weeks 1, 3, 5
- a mix: `"1-4,9,11-12"` → weeks 1, 2, 3, 4, 9, 11, 12

If the same programming runs all the way through, use a single group covering every week (e.g. `"1-12"`). Use multiple groups when the plan changes between blocks — e.g. one group for weeks 1–4 and another for weeks 5–8 with different exercises or set counts.

## Sessions

```json
{
  "session_number": 1,
  "label": "Upper - Strength",
  "notes": "Optional coaching note shown on the session card",
  "exercises": [ ... ]
}
```

`session_number` is 1-based within the week and determines ordering and the logger URL (`/train/week/:week/session/:session`).

## Exercises

```json
{
  "name": "Bench press",
  "sets": 4,
  "reps": "6-8",
  "notes": "Pause on chest",
  "superset_group": "A",
  "is_drop_set": false
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | ✓ | **Logs join on this string.** Keep it identical across weeks/re-imports or history and pre-fill break |
| `sets` | number | ✓ | Number of set rows shown in the logger |
| `reps` | string | ✓ | Free text — `"8-10"`, `"10-12 per leg"`, `"30-45 sec"`, `"AMRAP"` all fine |
| `notes` | string | | Coaching cue shown under the exercise name |
| `superset_group` | string | | Exercises sharing a letter get a `SS <letter>` badge |
| `is_drop_set` | boolean | | Shows a `DROP` badge |

## Phases

Optional. Phases drive the coloured banner on the week view and the tempo/rest/RPE reminders in the session logger.

```json
{
  "name": "Accumulation",
  "weeks_start": 1,
  "weeks_end": 4,
  "description": "Build volume at moderate intensity",
  "rpe": "7-8",
  "rest": "90-120s",
  "tempo": "3-1-1",
  "accent_color": "#22c55e"
}
```

All fields are required for phases that exist. `accent_color` themes the week strip, session cards, and charts for the weeks the phase covers; weeks not covered by any phase fall back to the default green.

## Gotchas

- **Re-importing deletes user data.** Overwriting a programme cascades through `user_programmes`, which deletes enrolments **and workout logs** for anyone enrolled in it. The import page warns before doing this.
- Preview validates presence of `name`, `total_weeks`, and `week_groups` only — a typo inside a session/exercise object shows up as an import error, not a preview error.
- Exercise names are registered in `exercise_definitions` automatically on import.
