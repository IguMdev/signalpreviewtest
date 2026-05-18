CREATE TABLE public.schedule_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.schedule_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY sf_select_own ON public.schedule_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sf_insert_own ON public.schedule_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sf_update_own ON public.schedule_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY sf_delete_own ON public.schedule_folders FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER schedule_folders_touch BEFORE UPDATE ON public.schedule_folders
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.recurring_schedules
  ADD COLUMN folder_id uuid REFERENCES public.schedule_folders(id) ON DELETE SET NULL;

CREATE INDEX idx_recurring_schedules_folder ON public.recurring_schedules(folder_id);