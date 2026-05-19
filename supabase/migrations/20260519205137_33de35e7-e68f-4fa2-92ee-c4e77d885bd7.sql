
ALTER TABLE public.user_engagement_subscriptions
  ADD COLUMN IF NOT EXISTS target_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS auto_dispatched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ues_target_room ON public.user_engagement_subscriptions(target_room_id);
CREATE INDEX IF NOT EXISTS idx_ues_user_pending_alloc ON public.user_engagement_subscriptions(user_id, status, bot_type) WHERE target_room_id IS NULL;
