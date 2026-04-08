
-- ============================================================
-- 1. Enum for behavior type
-- ============================================================
CREATE TYPE public.call_behavior AS ENUM (
  'answer_and_take_message',
  'answer_and_transfer',
  'answer_and_book',
  'answer_and_escalate',
  'answer_only',
  'block',
  'voicemail'
);

CREATE TYPE public.contact_source AS ENUM (
  'manual',
  'google_contacts',
  'apple_contacts',
  'csv_import',
  'call_history',
  'other'
);

CREATE TYPE public.caller_group_type AS ENUM ('system', 'custom');

-- ============================================================
-- 2. caller_groups
-- ============================================================
CREATE TABLE public.caller_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id    UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  icon          TEXT,
  color         TEXT,
  group_type    public.caller_group_type NOT NULL DEFAULT 'custom',
  priority_rank INTEGER NOT NULL DEFAULT 0,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_caller_groups_slug ON public.caller_groups (account_id, slug);
CREATE INDEX idx_caller_groups_account ON public.caller_groups (account_id);

ALTER TABLE public.caller_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view caller groups"
  ON public.caller_groups FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert caller groups"
  ON public.caller_groups FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update caller groups"
  ON public.caller_groups FOR UPDATE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete caller groups"
  ON public.caller_groups FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE TRIGGER update_caller_groups_updated_at BEFORE UPDATE ON public.caller_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. contacts
-- ============================================================
CREATE TABLE public.contacts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id           UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source               public.contact_source NOT NULL DEFAULT 'manual',
  external_source_id   TEXT,
  first_name           TEXT,
  last_name            TEXT,
  display_name         TEXT,
  primary_phone_e164   TEXT,
  secondary_phone_e164 TEXT,
  email                TEXT,
  company_name         TEXT,
  notes                TEXT,
  is_favorite          BOOLEAN NOT NULL DEFAULT false,
  is_blocked           BOOLEAN NOT NULL DEFAULT false,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_account ON public.contacts (account_id);
CREATE INDEX idx_contacts_phone ON public.contacts (account_id, primary_phone_e164);
CREATE INDEX idx_contacts_email ON public.contacts (account_id, email);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contacts"
  ON public.contacts FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert contacts"
  ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update contacts"
  ON public.contacts FOR UPDATE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete contacts"
  ON public.contacts FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. contact_group_memberships
-- ============================================================
CREATE TABLE public.contact_group_memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  caller_group_id UUID NOT NULL REFERENCES public.caller_groups(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contact_group_unique ON public.contact_group_memberships (contact_id, caller_group_id);
CREATE INDEX idx_contact_group_account ON public.contact_group_memberships (account_id);
CREATE INDEX idx_contact_group_contact ON public.contact_group_memberships (contact_id);
CREATE INDEX idx_contact_group_group ON public.contact_group_memberships (caller_group_id);

ALTER TABLE public.contact_group_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contact group memberships"
  ON public.contact_group_memberships FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert contact group memberships"
  ON public.contact_group_memberships FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete contact group memberships"
  ON public.contact_group_memberships FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

-- No UPDATE needed: delete + re-insert for reassignment

-- ============================================================
-- 5. call_handling_rules
-- ============================================================
CREATE TABLE public.call_handling_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  assistant_mode_id   UUID NOT NULL REFERENCES public.assistant_modes(id) ON DELETE CASCADE,
  caller_group_id     UUID NOT NULL REFERENCES public.caller_groups(id) ON DELETE CASCADE,
  behavior            public.call_behavior NOT NULL DEFAULT 'answer_and_take_message',
  booking_allowed     BOOLEAN NOT NULL DEFAULT false,
  escalation_allowed  BOOLEAN NOT NULL DEFAULT false,
  force_escalation    BOOLEAN NOT NULL DEFAULT false,
  callback_allowed    BOOLEAN NOT NULL DEFAULT false,
  summary_required    BOOLEAN NOT NULL DEFAULT true,
  priority_rank       INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_call_handling_rules_unique ON public.call_handling_rules (assistant_mode_id, caller_group_id);
CREATE INDEX idx_call_handling_rules_account ON public.call_handling_rules (account_id);
CREATE INDEX idx_call_handling_rules_mode ON public.call_handling_rules (assistant_mode_id);

ALTER TABLE public.call_handling_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view call handling rules"
  ON public.call_handling_rules FOR SELECT TO authenticated
  USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert call handling rules"
  ON public.call_handling_rules FOR INSERT TO authenticated
  WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update call handling rules"
  ON public.call_handling_rules FOR UPDATE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete call handling rules"
  ON public.call_handling_rules FOR DELETE TO authenticated
  USING (is_account_admin(auth.uid(), account_id));

CREATE TRIGGER update_call_handling_rules_updated_at BEFORE UPDATE ON public.call_handling_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 6. Update handle_new_user to seed default caller groups + rules
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 6. Seed default caller groups + one handling rule per group
  FOR _i IN 1..array_length(_default_groups, 1) LOOP
    INSERT INTO public.caller_groups (id, account_id, name, slug, icon, color, group_type, priority_rank)
    VALUES (
      gen_random_uuid(),
      _account_id,
      _default_groups[_i][1],
      _default_groups[_i][2],
      _default_groups[_i][3],
      _default_groups[_i][4],
      'system',
      _default_groups[_i][5]::int
    )
    RETURNING id INTO _group_id;

    -- Default behavior per group
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

  RETURN NEW;
END;
$$;
