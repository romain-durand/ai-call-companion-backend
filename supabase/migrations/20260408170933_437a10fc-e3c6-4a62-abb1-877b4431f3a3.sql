
-- 1. Enums
CREATE TYPE public.calendar_provider AS ENUM ('google', 'outlook', 'apple', 'other');
CREATE TYPE public.calendar_connection_status AS ENUM ('active', 'expired', 'revoked', 'error');
CREATE TYPE public.appointment_status AS ENUM ('tentative', 'confirmed', 'cancelled', 'completed', 'no_show');
CREATE TYPE public.booked_by_type AS ENUM ('assistant', 'user', 'external');

-- 2. calendar_connections
CREATE TABLE public.calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider public.calendar_provider NOT NULL DEFAULT 'google',
  provider_account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  status public.calendar_connection_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendar connections" ON public.calendar_connections
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert calendar connections" ON public.calendar_connections
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update calendar connections" ON public.calendar_connections
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete calendar connections" ON public.calendar_connections
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_calendar_connections_account ON public.calendar_connections(account_id);
CREATE INDEX idx_calendar_connections_profile ON public.calendar_connections(profile_id);
CREATE UNIQUE INDEX uq_calendar_connection_provider ON public.calendar_connections(account_id, profile_id, provider, provider_account_id) WHERE provider_account_id IS NOT NULL;

CREATE TRIGGER update_calendar_connections_updated_at
  BEFORE UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Account consistency: profile must be member of account
CREATE OR REPLACE FUNCTION public.check_calendar_connection_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.account_members WHERE profile_id = NEW.profile_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'profile % is not a member of account %', NEW.profile_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_calendar_connection_account
  BEFORE INSERT OR UPDATE ON public.calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.check_calendar_connection_account();

-- 3. calendar_calendars
CREATE TABLE public.calendar_calendars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  calendar_connection_id UUID NOT NULL REFERENCES public.calendar_connections(id) ON DELETE CASCADE,
  provider_calendar_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_read_only BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view calendars" ON public.calendar_calendars
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert calendars" ON public.calendar_calendars
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update calendars" ON public.calendar_calendars
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete calendars" ON public.calendar_calendars
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_calendar_calendars_connection ON public.calendar_calendars(calendar_connection_id);
CREATE UNIQUE INDEX uq_calendar_provider_id ON public.calendar_calendars(calendar_connection_id, provider_calendar_id);

-- Account consistency
CREATE OR REPLACE FUNCTION public.check_calendar_calendar_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.calendar_connections WHERE id = NEW.calendar_connection_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'calendar_connection % does not belong to account %', NEW.calendar_connection_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_calendar_calendar_account
  BEFORE INSERT OR UPDATE ON public.calendar_calendars
  FOR EACH ROW EXECUTE FUNCTION public.check_calendar_calendar_account();

-- 4. booking_types
CREATE TABLE public.booking_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0,
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0,
  allowed_from_hour_local INTEGER NOT NULL DEFAULT 8,
  allowed_to_hour_local INTEGER NOT NULL DEFAULT 18,
  max_days_ahead INTEGER NOT NULL DEFAULT 30,
  requires_confirmation BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_duration_positive CHECK (duration_minutes > 0),
  CONSTRAINT chk_buffer_before_non_negative CHECK (buffer_before_minutes >= 0),
  CONSTRAINT chk_buffer_after_non_negative CHECK (buffer_after_minutes >= 0),
  CONSTRAINT chk_hours_valid CHECK (allowed_from_hour_local >= 0 AND allowed_from_hour_local < 24 AND allowed_to_hour_local > 0 AND allowed_to_hour_local <= 24 AND allowed_from_hour_local < allowed_to_hour_local),
  CONSTRAINT chk_max_days_positive CHECK (max_days_ahead > 0)
);

ALTER TABLE public.booking_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view booking types" ON public.booking_types
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert booking types" ON public.booking_types
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update booking types" ON public.booking_types
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete booking types" ON public.booking_types
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE UNIQUE INDEX uq_booking_type_slug ON public.booking_types(account_id, slug);
CREATE INDEX idx_booking_types_account ON public.booking_types(account_id);

CREATE TRIGGER update_booking_types_updated_at
  BEFORE UPDATE ON public.booking_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. booking_rules
CREATE TABLE public.booking_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  booking_type_id UUID NOT NULL REFERENCES public.booking_types(id) ON DELETE CASCADE,
  assistant_mode_id UUID NOT NULL REFERENCES public.assistant_modes(id) ON DELETE CASCADE,
  caller_group_id UUID NOT NULL REFERENCES public.caller_groups(id) ON DELETE CASCADE,
  can_book_directly BOOLEAN NOT NULL DEFAULT false,
  can_offer_alternatives BOOLEAN NOT NULL DEFAULT true,
  max_suggestions INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_max_suggestions_range CHECK (max_suggestions >= 1 AND max_suggestions <= 10)
);

ALTER TABLE public.booking_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view booking rules" ON public.booking_rules
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert booking rules" ON public.booking_rules
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update booking rules" ON public.booking_rules
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete booking rules" ON public.booking_rules
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE UNIQUE INDEX uq_booking_rule ON public.booking_rules(booking_type_id, assistant_mode_id, caller_group_id);
CREATE INDEX idx_booking_rules_account ON public.booking_rules(account_id);

CREATE TRIGGER update_booking_rules_updated_at
  BEFORE UPDATE ON public.booking_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Account consistency for booking_rules
CREATE OR REPLACE FUNCTION public.check_booking_rule_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.booking_types WHERE id = NEW.booking_type_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'booking_type % does not belong to account %', NEW.booking_type_id, NEW.account_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.assistant_modes WHERE id = NEW.assistant_mode_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'assistant_mode % does not belong to account %', NEW.assistant_mode_id, NEW.account_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caller_groups WHERE id = NEW.caller_group_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'caller_group % does not belong to account %', NEW.caller_group_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_booking_rule_account
  BEFORE INSERT OR UPDATE ON public.booking_rules
  FOR EACH ROW EXECUTE FUNCTION public.check_booking_rule_account();

-- 6. appointments
CREATE TABLE public.appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE SET NULL,
  booking_type_id UUID REFERENCES public.booking_types(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  provider public.calendar_provider,
  provider_event_id TEXT,
  title TEXT NOT NULL DEFAULT 'Rendez-vous',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Paris',
  status public.appointment_status NOT NULL DEFAULT 'tentative',
  booked_by public.booked_by_type NOT NULL DEFAULT 'assistant',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_appointment_times CHECK (ends_at > starts_at)
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view appointments" ON public.appointments
  FOR SELECT TO authenticated USING (is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert appointments" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update appointments" ON public.appointments
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete appointments" ON public.appointments
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE INDEX idx_appointments_account_starts ON public.appointments(account_id, starts_at);
CREATE INDEX idx_appointments_contact ON public.appointments(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_appointments_call_session ON public.appointments(call_session_id) WHERE call_session_id IS NOT NULL;
CREATE INDEX idx_appointments_status ON public.appointments(account_id, status);
CREATE UNIQUE INDEX uq_appointment_provider_event ON public.appointments(provider, provider_event_id) WHERE provider_event_id IS NOT NULL;

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Account consistency for appointments
CREATE OR REPLACE FUNCTION public.check_appointment_account()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.call_session_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  IF NEW.booking_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.booking_types WHERE id = NEW.booking_type_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'booking_type % does not belong to account %', NEW.booking_type_id, NEW.account_id;
  END IF;
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = NEW.contact_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'contact % does not belong to account %', NEW.contact_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_appointment_account
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.check_appointment_account();
