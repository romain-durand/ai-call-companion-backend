
-- Create enums
CREATE TYPE public.mission_status AS ENUM ('draft', 'queued', 'in_progress', 'completed', 'failed', 'cancelled');
CREATE TYPE public.mission_result AS ENUM ('pending', 'success', 'partial', 'failure', 'no_answer');

-- Create outbound_missions table
CREATE TABLE public.outbound_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  status public.mission_status NOT NULL DEFAULT 'draft',
  objective TEXT NOT NULL,
  target_phone_e164 TEXT NOT NULL,
  target_name TEXT,
  constraints_json JSONB DEFAULT '{}'::jsonb,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result_summary TEXT,
  result_status public.mission_result NOT NULL DEFAULT 'pending',
  call_session_id UUID REFERENCES public.call_sessions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for bridge server polling
CREATE INDEX idx_outbound_missions_queue ON public.outbound_missions (status, scheduled_at)
  WHERE status = 'queued';

-- Updated_at trigger
CREATE TRIGGER update_outbound_missions_updated_at
  BEFORE UPDATE ON public.outbound_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Account consistency trigger
CREATE OR REPLACE FUNCTION public.check_outbound_mission_account()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.call_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_outbound_mission_account_trigger
  BEFORE INSERT OR UPDATE ON public.outbound_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.check_outbound_mission_account();

-- Enable RLS
ALTER TABLE public.outbound_missions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view outbound missions"
  ON public.outbound_missions FOR SELECT
  TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert outbound missions"
  ON public.outbound_missions FOR INSERT
  TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update outbound missions"
  ON public.outbound_missions FOR UPDATE
  TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete outbound missions"
  ON public.outbound_missions FOR DELETE
  TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

-- Enable realtime for live status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_missions;
