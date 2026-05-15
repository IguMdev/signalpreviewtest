CREATE TABLE public.meta_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  pixel_id text NOT NULL,
  access_token text NOT NULL,
  test_event_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY mi_select_own ON public.meta_integrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY mi_insert_own ON public.meta_integrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY mi_update_own ON public.meta_integrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY mi_delete_own ON public.meta_integrations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_meta_integrations_updated_at
BEFORE UPDATE ON public.meta_integrations
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Log de eventos enviados ao Meta (para debug e auditoria)
CREATE TABLE public.meta_event_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_name text NOT NULL,
  event_id text,
  ok boolean NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meta_event_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY mel_select_own ON public.meta_event_logs FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_meta_event_logs_user_created ON public.meta_event_logs(user_id, created_at DESC);