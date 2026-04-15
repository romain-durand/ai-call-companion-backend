
ALTER TABLE public.outbound_missions
  ADD COLUMN context_flexible TEXT,
  ADD COLUMN context_secret TEXT;
