CREATE TABLE public.tracking_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  domain TEXT NOT NULL,
  verification_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  verified_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, domain)
);

CREATE INDEX idx_tracking_domains_user ON public.tracking_domains(user_id);
CREATE INDEX idx_tracking_domains_domain ON public.tracking_domains(domain);

ALTER TABLE public.tracking_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY td_select_own ON public.tracking_domains
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY td_insert_own ON public.tracking_domains
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY td_update_own ON public.tracking_domains
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY td_delete_own ON public.tracking_domains
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_tracking_domains_updated
  BEFORE UPDATE ON public.tracking_domains
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();