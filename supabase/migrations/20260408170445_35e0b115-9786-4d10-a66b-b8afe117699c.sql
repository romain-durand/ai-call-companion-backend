
-- 1. Account consistency trigger for call_sessions
CREATE OR REPLACE FUNCTION public.check_call_session_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.phone_number_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.phone_numbers WHERE id = NEW.phone_number_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'phone_number % does not belong to account %', NEW.phone_number_id, NEW.account_id;
  END IF;

  IF NEW.caller_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.caller_groups WHERE id = NEW.caller_group_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'caller_group % does not belong to account %', NEW.caller_group_id, NEW.account_id;
  END IF;

  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = NEW.contact_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'contact % does not belong to account %', NEW.contact_id, NEW.account_id;
  END IF;

  IF NEW.active_mode_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.assistant_modes WHERE id = NEW.active_mode_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'assistant_mode % does not belong to account %', NEW.active_mode_id, NEW.account_id;
  END IF;

  -- profile_id: check membership in the account (profile belongs to account via account_members)
  IF NEW.profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.account_members WHERE profile_id = NEW.profile_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'profile % is not a member of account %', NEW.profile_id, NEW.account_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_call_session_account
  BEFORE INSERT OR UPDATE ON public.call_sessions
  FOR EACH ROW EXECUTE FUNCTION public.check_call_session_account();

-- 2. CHECK constraints
ALTER TABLE public.call_sessions
  ADD CONSTRAINT chk_duration_non_negative CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  ADD CONSTRAINT chk_urgency_score_range CHECK (urgency_score IS NULL OR (urgency_score >= 0 AND urgency_score <= 1));

ALTER TABLE public.call_messages
  ADD CONSTRAINT chk_seq_no_positive CHECK (seq_no > 0);

ALTER TABLE public.tool_invocations
  ADD CONSTRAINT chk_latency_non_negative CHECK (latency_ms IS NULL OR latency_ms >= 0);

-- call_messages content: use a validation trigger (CHECK with OR on nullable works but a trigger gives better error messages)
CREATE OR REPLACE FUNCTION public.check_call_message_content()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.content_text IS NULL AND NEW.content_json IS NULL THEN
    RAISE EXCEPTION 'call_message must have at least content_text or content_json';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_call_message_content
  BEFORE INSERT OR UPDATE ON public.call_messages
  FOR EACH ROW EXECUTE FUNCTION public.check_call_message_content();

-- 3. Unique provider call identity
CREATE UNIQUE INDEX uq_provider_call_id
  ON public.call_sessions (provider, provider_call_id)
  WHERE provider_call_id IS NOT NULL;

-- 4. Change default final_outcome to 'missed' (a new session starts as unanswered until proven otherwise)
ALTER TABLE public.call_sessions
  ALTER COLUMN final_outcome SET DEFAULT 'missed'::call_outcome;
