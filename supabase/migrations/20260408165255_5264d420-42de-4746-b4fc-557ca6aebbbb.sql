
-- 1. Enums
CREATE TYPE public.call_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE public.urgency_level AS ENUM ('none', 'low', 'medium', 'high', 'critical');
CREATE TYPE public.escalation_status AS ENUM ('none', 'pending', 'accepted', 'declined', 'timeout');
CREATE TYPE public.call_outcome AS ENUM ('completed', 'missed', 'rejected', 'failed', 'voicemail', 'escalated', 'transferred');
CREATE TYPE public.transcript_status AS ENUM ('none', 'pending', 'processing', 'ready', 'failed');
CREATE TYPE public.speaker_role AS ENUM ('caller', 'assistant', 'system', 'tool');
CREATE TYPE public.tool_invocation_status AS ENUM ('pending', 'success', 'error', 'timeout');

-- 2. call_sessions
CREATE TABLE public.call_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  phone_number_id UUID REFERENCES public.phone_numbers(id) ON DELETE SET NULL,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'twilio',
  provider_call_id TEXT,
  direction public.call_direction NOT NULL DEFAULT 'inbound',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  caller_phone_e164 TEXT,
  caller_name_raw TEXT,
  caller_country_code TEXT DEFAULT 'FR',
  caller_group_id UUID REFERENCES public.caller_groups(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  active_mode_id UUID REFERENCES public.assistant_modes(id) ON DELETE SET NULL,
  detected_intent TEXT,
  urgency_score NUMERIC(3,2),
  urgency_level public.urgency_level NOT NULL DEFAULT 'none',
  assistant_handled BOOLEAN NOT NULL DEFAULT true,
  escalated_to_user BOOLEAN NOT NULL DEFAULT false,
  escalation_status public.escalation_status NOT NULL DEFAULT 'none',
  final_outcome public.call_outcome NOT NULL DEFAULT 'completed',
  summary_short TEXT,
  summary_long TEXT,
  recording_url TEXT,
  transcript_status public.transcript_status NOT NULL DEFAULT 'none',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view call sessions"
  ON public.call_sessions FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert call sessions"
  ON public.call_sessions FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update call sessions"
  ON public.call_sessions FOR UPDATE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete call sessions"
  ON public.call_sessions FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

-- Indexes for call_sessions
CREATE INDEX idx_call_sessions_account_started ON public.call_sessions(account_id, started_at DESC);
CREATE INDEX idx_call_sessions_caller_phone ON public.call_sessions(account_id, caller_phone_e164) WHERE caller_phone_e164 IS NOT NULL;
CREATE INDEX idx_call_sessions_contact ON public.call_sessions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_call_sessions_outcome ON public.call_sessions(account_id, final_outcome);
CREATE INDEX idx_call_sessions_urgency ON public.call_sessions(account_id, urgency_level) WHERE urgency_level != 'none';
CREATE INDEX idx_call_sessions_provider_call ON public.call_sessions(provider, provider_call_id) WHERE provider_call_id IS NOT NULL;
CREATE INDEX idx_call_sessions_direction ON public.call_sessions(account_id, direction);

-- Updated_at trigger
CREATE TRIGGER update_call_sessions_updated_at
  BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. call_messages
CREATE TABLE public.call_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  seq_no INTEGER NOT NULL,
  speaker public.speaker_role NOT NULL DEFAULT 'caller',
  content_text TEXT,
  content_json JSONB,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  tool_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_call_message_seq UNIQUE (call_session_id, seq_no)
);

ALTER TABLE public.call_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view call messages"
  ON public.call_messages FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert call messages"
  ON public.call_messages FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete call messages"
  ON public.call_messages FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_call_messages_session_seq ON public.call_messages(call_session_id, seq_no);
CREATE INDEX idx_call_messages_account ON public.call_messages(account_id);

-- 4. tool_invocations
CREATE TABLE public.tool_invocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  request_json JSONB,
  response_json JSONB,
  status public.tool_invocation_status NOT NULL DEFAULT 'pending',
  latency_ms INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.tool_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tool invocations"
  ON public.tool_invocations FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert tool invocations"
  ON public.tool_invocations FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update tool invocations"
  ON public.tool_invocations FOR UPDATE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_tool_invocations_session ON public.tool_invocations(call_session_id);
CREATE INDEX idx_tool_invocations_account ON public.tool_invocations(account_id, created_at DESC);
CREATE INDEX idx_tool_invocations_status ON public.tool_invocations(status) WHERE status IN ('error', 'timeout');
CREATE INDEX idx_tool_invocations_tool ON public.tool_invocations(tool_name);

-- 5. Account consistency triggers
CREATE OR REPLACE FUNCTION public.check_call_message_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_call_message_account
  BEFORE INSERT OR UPDATE ON public.call_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_call_message_account();

CREATE OR REPLACE FUNCTION public.check_tool_invocation_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_tool_invocation_account
  BEFORE INSERT OR UPDATE ON public.tool_invocations
  FOR EACH ROW EXECUTE FUNCTION public.check_tool_invocation_account();

-- 6. Enable realtime for call_sessions (useful for live dashboard)
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
