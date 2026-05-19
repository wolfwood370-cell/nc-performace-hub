-- Migration: appointments table
-- ----------------------------------------------------------------------
-- Closes audit finding M3 (MOCK_APPOINTMENTS in CoachCalendar) by
-- introducing the real `appointments` table the calendar grid binds to.
--
-- An appointment is a non-workout calendar item the coach schedules with
-- (or for) an athlete: e.g. video check-in, in-person PT session,
-- nutrition consult. Type is open-ended via TEXT — no enum to avoid the
-- typical "add a new type means a migration" trap. The frontend uses
-- `'check-in' | 'pt-session' | 'other'` today but is free to extend.
--
-- RLS model mirrors `workout_logs`:
--   - Coach: full CRUD on their own appointments.
--   - Athlete: read-only access to their own.

CREATE TABLE IF NOT EXISTS public.appointments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  athlete_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'other'
              CHECK (type IN ('check-in', 'pt-session', 'consult', 'other')),
  date        DATE NOT NULL,
  time        TIME,
  duration_min INTEGER CHECK (duration_min IS NULL OR duration_min > 0),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_coach_date
  ON public.appointments (coach_id, date);

CREATE INDEX IF NOT EXISTS idx_appointments_athlete_date
  ON public.appointments (athlete_id, date);

-- Update timestamp trigger (matches the pattern used for `workouts`).
CREATE OR REPLACE FUNCTION public.set_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON public.appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.set_appointments_updated_at();

-- RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach can read own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = coach_id);

CREATE POLICY "Athlete can read own appointments"
  ON public.appointments FOR SELECT
  USING (auth.uid() = athlete_id);

CREATE POLICY "Coach can insert own appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coach can update own appointments"
  ON public.appointments FOR UPDATE
  USING (auth.uid() = coach_id)
  WITH CHECK (auth.uid() = coach_id);

CREATE POLICY "Coach can delete own appointments"
  ON public.appointments FOR DELETE
  USING (auth.uid() = coach_id);
