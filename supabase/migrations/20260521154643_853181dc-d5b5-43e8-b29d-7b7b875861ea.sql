-- Impede dois sinais no mesmo minuto para a mesma sala.
-- Usa um índice único em (room_id, entry_at). Como entry_at sempre cai
-- exatamente no minuto cheio (segundo 0, ms 0), a comparação por timestamp
-- equivale a "mesmo minuto".
CREATE UNIQUE INDEX IF NOT EXISTS signal_events_room_entry_unique
  ON public.signal_events (room_id, entry_at);