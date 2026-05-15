
-- 1) Default credits to 0 and reset existing balances
ALTER TABLE public.profiles ALTER COLUMN credits SET DEFAULT 0;
UPDATE public.profiles SET credits = 0;

-- 2) Allow credit_transactions to be inserted by service role (no policy needed; service bypasses RLS)
--    Add an updated_at-style index for lookups
CREATE INDEX IF NOT EXISTS idx_credit_tx_user_created ON public.credit_transactions (user_id, created_at DESC);

-- 3) Trigger: BEFORE INSERT on rooms — require >=1 credit, decrement atomically
CREATE OR REPLACE FUNCTION public.consume_room_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining int;
BEGIN
  UPDATE public.profiles
     SET credits = credits - 1
   WHERE id = NEW.user_id
     AND credits >= 1
   RETURNING credits INTO remaining;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'Créditos insuficientes para criar uma sala. Adquira o Plano Básico ou Premium na aba Recarga.'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.credit_transactions (user_id, delta, reason)
  VALUES (NEW.user_id, -1, 'room_create');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_consume_room_credit ON public.rooms;
CREATE TRIGGER trg_consume_room_credit
BEFORE INSERT ON public.rooms
FOR EACH ROW EXECUTE FUNCTION public.consume_room_credit();
