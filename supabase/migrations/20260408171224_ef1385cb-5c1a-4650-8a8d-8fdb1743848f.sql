
-- 1. Enums
CREATE TYPE public.notification_channel AS ENUM ('push', 'sms', 'email');
CREATE TYPE public.notification_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed');
CREATE TYPE public.escalation_method AS ENUM ('call', 'push', 'sms');
CREATE TYPE public.escalation_event_status AS ENUM ('pending', 'attempting', 'reached', 'unreached', 'timeout');
CREATE TYPE public.callback_status AS ENUM ('pending', 'scheduled', 'completed', 'cancelled', 'expired');
CREATE TYPE public.callback_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- 2. notifications
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  channel public.notification_channel NOT NULL,
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  title TEXT NOT NULL,
  body TEXT,
  status public.notification_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view notifications" ON public.notifications
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_notifications_account ON public.notifications(account_id, created_at DESC);
CREATE INDEX idx_notifications_profile ON public.notifications(profile_id, created_at DESC);
CREATE INDEX idx_notifications_call ON public.notifications(call_session_id) WHERE call_session_id IS NOT NULL;
CREATE INDEX idx_notifications_status ON public.notifications(status) WHERE status = 'pending';

-- Account consistency
CREATE OR REPLACE FUNCTION public.check_notification_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members WHERE profile_id = NEW.profile_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'profile % is not a member of account %', NEW.profile_id, NEW.account_id;
  END IF;
  IF NEW.call_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_notification_account
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.check_notification_account();

-- 3. escalation_events
CREATE TABLE public.escalation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  target_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trigger_reason TEXT NOT NULL,
  urgency_level public.urgency_level NOT NULL DEFAULT 'high',
  method public.escalation_method NOT NULL DEFAULT 'push',
  status public.escalation_event_status NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view escalation events" ON public.escalation_events
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert escalation events" ON public.escalation_events
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update escalation events" ON public.escalation_events
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_escalation_account ON public.escalation_events(account_id, created_at DESC);
CREATE INDEX idx_escalation_call ON public.escalation_events(call_session_id);
CREATE INDEX idx_escalation_target ON public.escalation_events(target_profile_id);
CREATE INDEX idx_escalation_status ON public.escalation_events(status) WHERE status IN ('pending', 'attempting');

-- Account consistency
CREATE OR REPLACE FUNCTION public.check_escalation_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members WHERE profile_id = NEW.target_profile_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'target_profile % is not a member of account %', NEW.target_profile_id, NEW.account_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_escalation_account
  BEFORE INSERT OR UPDATE ON public.escalation_events
  FOR EACH ROW EXECUTE FUNCTION public.check_escalation_account();

-- 4. callback_requests
CREATE TABLE public.callback_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  caller_name TEXT,
  caller_phone_e164 TEXT,
  reason TEXT,
  priority public.callback_priority NOT NULL DEFAULT 'normal',
  preferred_time_note TEXT,
  status public.callback_status NOT NULL DEFAULT 'pending',
  created_by public.booked_by_type NOT NULL DEFAULT 'assistant',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.callback_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view callback requests" ON public.callback_requests
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert callback requests" ON public.callback_requests
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update callback requests" ON public.callback_requests
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete callback requests" ON public.callback_requests
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_callback_account_status ON public.callback_requests(account_id, status, created_at DESC);
CREATE INDEX idx_callback_priority ON public.callback_requests(account_id, priority) WHERE status = 'pending';
CREATE INDEX idx_callback_contact ON public.callback_requests(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_callback_call ON public.callback_requests(call_session_id) WHERE call_session_id IS NOT NULL;

-- Account consistency
CREATE OR REPLACE FUNCTION public.check_callback_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.call_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = NEW.contact_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'contact % does not belong to account %', NEW.contact_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_callback_account
  BEFORE INSERT OR UPDATE ON public.callback_requests
  FOR EACH ROW EXECUTE FUNCTION public.check_callback_account();
