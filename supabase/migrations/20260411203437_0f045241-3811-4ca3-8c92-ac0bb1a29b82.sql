
-- Enum for chat direction
CREATE TYPE public.chat_direction AS ENUM ('to_user', 'to_assistant');

-- Enum for chat message status
CREATE TYPE public.chat_message_status AS ENUM ('pending', 'answered', 'expired');

-- Table
CREATE TABLE public.live_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  direction public.chat_direction NOT NULL,
  content TEXT NOT NULL,
  status public.chat_message_status NOT NULL DEFAULT 'pending',
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_live_chat_session ON public.live_chat_messages(call_session_id, direction);
CREATE INDEX idx_live_chat_pending ON public.live_chat_messages(account_id, status) WHERE status = 'pending';

-- RLS
ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view live chat messages"
  ON public.live_chat_messages FOR SELECT
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Members can insert live chat messages"
  ON public.live_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can update live chat messages"
  ON public.live_chat_messages FOR UPDATE
  TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

-- Integrity trigger: check call_session belongs to account
CREATE OR REPLACE FUNCTION public.check_live_chat_account()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_live_chat_account
  BEFORE INSERT ON public.live_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_live_chat_account();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
