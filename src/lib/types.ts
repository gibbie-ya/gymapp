export interface Phase {
  name: string
  weeks_start: number
  weeks_end: number
  description: string
  rpe: string
  rest: string
  tempo: string
  accent_color: string
}

export interface Programme {
  id: string
  name: string
  description: string | null
  total_weeks: number
  sessions_per_week: number
  phases: Phase[]
  created_at: string
}

export interface ProgrammeSession {
  id: string
  programme_id: string
  week_number: number
  session_number: number
  label: string | null
  notes: string | null
}

export interface SessionExercise {
  id: string
  programme_session_id: string
  exercise_name: string
  order_index: number
  target_sets: number
  target_reps: string
  notes: string | null
  superset_group: string | null
  is_drop_set: boolean
}

export interface UserProgramme {
  id: string
  user_id: string
  programme_id: string
  start_date: string
  active: boolean
  created_at: string
}

export interface WorkoutLog {
  id: string
  user_id: string
  user_programme_id: string
  week_number: number
  session_number: number
  exercise_name: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  notes: string | null
  logged_at: string
}

export interface BodyWeightLog {
  id: string
  user_id: string
  logged_date: string
  weight_kg: number
  created_at: string
}

export interface SetLog {
  exerciseName: string
  setNumber: number
  weightKg: number | null
  reps: number | null
}
