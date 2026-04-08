
-- 1. Enum
CREATE TYPE public.notification_event_type AS ENUM ('urgent_call', 'callback_request', 'appointment_booked', 'call_summary');

-- 2. Table
CREATE TABLE public.notification_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type public.notification_event_type NOT NULL,
  channel public.notification_channel NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority_threshold public.notification_priority NOT NULL DEFAULT 'normal',
  quiet_hours_override BOOLEAN NOT NULL DEFAULT false,
  fallback_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_fallback_order_positive CHECK (fallback_order > 0)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Unique: one preference per profile × event × channel
CREATE UNIQUE INDEX uq_notification_pref ON public.notification_preferences(profile_id, event_type, channel);

-- Indexes
CREATE INDEX idx_notif_pref_account ON public.notification_preferences(account_id);
CREATE INDEX idx_notif_pref_profile_event ON public.notification_preferences(profile_id, event_type);

-- RLS: users manage their own, admins manage account-wide
CREATE POLICY "Users can view own preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = profile_id);

CREATE POLICY "Admins can view account preferences" ON public.notification_preferences
  FOR SELECT TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Users can insert own preferences" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Admins can insert account preferences" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Users can update own preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = profile_id);

CREATE POLICY "Admins can update account preferences" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Users can delete own preferences" ON public.notification_preferences
  FOR DELETE TO authenticated USING (auth.uid() = profile_id);

CREATE POLICY "Admins can delete account preferences" ON public.notification_preferences
  FOR DELETE TO authenticated USING (is_account_admin(auth.uid(), account_id));

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Account consistency trigger
CREATE OR REPLACE FUNCTION public.check_notif_pref_account()
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

CREATE TRIGGER trg_check_notif_pref_account
  BEFORE INSERT OR UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.check_notif_pref_account();

-- 3. Update handle_new_user to seed defaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _account_id UUID;
  _assistant_id UUID;
  _mode_id UUID;
  _display TEXT;
  _slug TEXT;
  _group RECORD;
  _default_groups TEXT[][] := ARRAY[
    ARRAY['Famille',      'family',     '👨‍👩‍👧‍👦', '#8B5CF6', '10'],
    ARRAY['Amis',         'friends',    '🤝',     '#06B6D4', '20'],
    ARRAY['VIP',          'vip',        '⭐',     '#F59E0B', '30'],
    ARRAY['Clients',      'clients',    '💼',     '#10B981', '40'],
    ARRAY['Prospects',    'leads',      '📋',     '#3B82F6', '50'],
    ARRAY['Livreurs',     'deliveries', '📦',     '#F97316', '60'],
    ARRAY['Inconnus',     'unknown',    '❓',     '#6B7280', '70'],
    ARRAY['Bloqués',      'blocked',    '🚫',     '#EF4444', '80']
  ];
  _group_id UUID;
  _behavior public.call_behavior;
  _i INT;
BEGIN
  _display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  _slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'gi'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- 1. Profile
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    _display,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );

  -- 2. Default account
  INSERT INTO public.accounts (id, name, slug)
  VALUES (gen_random_uuid(), _display, _slug)
  RETURNING id INTO _account_id;

  -- 3. Owner membership
  INSERT INTO public.account_members (account_id, profile_id, role, is_default_account)
  VALUES (_account_id, NEW.id, 'owner', true);

  -- 4. Default assistant profile
  INSERT INTO public.assistant_profiles (id, account_id, name, is_default)
  VALUES (gen_random_uuid(), _account_id, 'Mon Assistant', true)
  RETURNING id INTO _assistant_id;

  -- 5. Default assistant mode
  INSERT INTO public.assistant_modes (id, account_id, assistant_profile_id, name, slug, is_active)
  VALUES (gen_random_uuid(), _account_id, _assistant_id, 'Standard', 'standard', true)
  RETURNING id INTO _mode_id;

  -- 6. Seed default caller groups + handling rules
  FOR _i IN 1..array_length(_default_groups, 1) LOOP
    INSERT INTO public.caller_groups (id, account_id, name, slug, icon, color, group_type, priority_rank)
    VALUES (
      gen_random_uuid(), _account_id,
      _default_groups[_i][1], _default_groups[_i][2], _default_groups[_i][3],
      _default_groups[_i][4], 'system', _default_groups[_i][5]::int
    )
    RETURNING id INTO _group_id;

    _behavior := CASE _default_groups[_i][2]
      WHEN 'family'     THEN 'answer_and_escalate'::call_behavior
      WHEN 'friends'    THEN 'answer_and_take_message'::call_behavior
      WHEN 'vip'        THEN 'answer_and_escalate'::call_behavior
      WHEN 'clients'    THEN 'answer_and_book'::call_behavior
      WHEN 'leads'      THEN 'answer_and_take_message'::call_behavior
      WHEN 'deliveries' THEN 'answer_and_take_message'::call_behavior
      WHEN 'unknown'    THEN 'answer_and_take_message'::call_behavior
      WHEN 'blocked'    THEN 'block'::call_behavior
      ELSE 'answer_and_take_message'::call_behavior
    END;

    INSERT INTO public.call_handling_rules (
      account_id, assistant_mode_id, caller_group_id, behavior,
      booking_allowed, escalation_allowed, force_escalation, callback_allowed, summary_required, priority_rank
    ) VALUES (
      _account_id, _mode_id, _group_id, _behavior,
      _behavior = 'answer_and_book',
      _behavior = 'answer_and_escalate',
      false,
      _default_groups[_i][2] NOT IN ('blocked', 'unknown'),
      true,
      _default_groups[_i][5]::int
    );
  END LOOP;

  -- 7. Seed notification preferences
  -- urgent_call: push (1) + sms (2)
  INSERT INTO public.notification_preferences (account_id, profile_id, event_type, channel, enabled, priority_threshold, quiet_hours_override, fallback_order) VALUES
    (_account_id, NEW.id, 'urgent_call', 'push', true, 'high', true, 1),
    (_account_id, NEW.id, 'urgent_call', 'sms', true, 'high', true, 2),
    -- callback_request: push (1)
    (_account_id, NEW.id, 'callback_request', 'push', true, 'normal', false, 1),
    -- appointment_booked: push (1) + email (2)
    (_account_id, NEW.id, 'appointment_booked', 'push', true, 'normal', false, 1),
    (_account_id, NEW.id, 'appointment_booked', 'email', true, 'normal', false, 2),
    -- call_summary: push (1)
    (_account_id, NEW.id, 'call_summary', 'push', true, 'low', false, 1);

  RETURN NEW;
END;
$$;
