ALTER TABLE public.meta_integrations
ADD COLUMN IF NOT EXISTS event_mappings jsonb NOT NULL DEFAULT jsonb_build_object(
  'join', 'CompleteRegistration',
  'leave', 'off',
  'kicked', 'off'
);