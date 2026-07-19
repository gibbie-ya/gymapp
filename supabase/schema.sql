-- GymTracker database schema
-- Run this in the Supabase SQL editor on a fresh project.

-- Exercise definitions (auto-populated on import)
CREATE TABLE exercise_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  muscle_group TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Programme templates
CREATE TABLE programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  total_weeks INT NOT NULL,
  sessions_per_week INT NOT NULL,
  phases JSONB DEFAULT '[]',
  -- phases format: [{name, weeks_start, weeks_end, description, rpe, rest, tempo, accent_color}]
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One row per week+session combination in a programme
CREATE TABLE programme_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  session_number INT NOT NULL,
  label TEXT,
  notes TEXT,
  UNIQUE(programme_id, week_number, session_number)
);

-- Exercises within each session template
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programme_session_id UUID REFERENCES programme_sessions(id) ON DELETE CASCADE,
  exercise_name TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  target_sets INT NOT NULL,
  target_reps TEXT NOT NULL,
  notes TEXT,
  superset_group TEXT,
  is_drop_set BOOLEAN DEFAULT FALSE
);

-- User's enrolled programme (one active at a time per user)
CREATE TABLE user_programmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  programme_id UUID REFERENCES programmes(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Actual workout logs: one row per set performed
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  user_programme_id UUID REFERENCES user_programmes(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  session_number INT NOT NULL,
  exercise_name TEXT NOT NULL,
  set_number INT NOT NULL,
  weight_kg NUMERIC(6,2),
  reps INT,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bodyweight logs: one weigh-in per user per day
CREATE TABLE body_weight_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, logged_date)
);

-- RLS: enable on all tables
ALTER TABLE exercise_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_weight_logs ENABLE ROW LEVEL SECURITY;

-- Programmes and sessions are readable by authenticated users (admin inserts via import)
CREATE POLICY "Authenticated users can read programmes" ON programmes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert programmes" ON programmes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete programmes" ON programmes FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read programme_sessions" ON programme_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert programme_sessions" ON programme_sessions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete programme_sessions" ON programme_sessions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read session_exercises" ON session_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert session_exercises" ON session_exercises FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can delete session_exercises" ON session_exercises FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read exercise_definitions" ON exercise_definitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert exercise_definitions" ON exercise_definitions FOR INSERT TO authenticated WITH CHECK (true);

-- User data scoped to owner
CREATE POLICY "Users manage own programmes" ON user_programmes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own logs" ON workout_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own bodyweight" ON body_weight_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
