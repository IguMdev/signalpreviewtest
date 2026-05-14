-- Add follow_ups column to recurring_schedules
ALTER TABLE public.recurring_schedules
  ADD COLUMN IF NOT EXISTS follow_ups jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Create pending follow-ups queue table
CREATE TABLE IF NOT EXISTS public.recurring_pending_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.recurring_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  room_id uuid NOT NULL,
  account_id uuid,
  scheduled_at timestamptz NOT NULL,
  content text,
  image_path text,
  image_mime text,
  parse_mode text NOT NULL DEFAULT 'HTML',
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rpf_due
  ON public.recurring_pending_followups (status, scheduled_at);

ALTER TABLE public.recurring_pending_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own pending followups"
  ON public.recurring_pending_followups FOR SELECT
  USING (auth.uid() = user_id);
