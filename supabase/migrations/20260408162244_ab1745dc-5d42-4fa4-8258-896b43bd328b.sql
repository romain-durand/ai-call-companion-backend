
-- ============================================================
-- 1. Drop old objects
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop enums if they were partially created
DROP TYPE IF EXISTS public.account_role CASCADE;
DROP TYPE IF EXISTS public.record_status CASCADE;
DROP TYPE IF EXISTS public.verification_status CASCADE;
DROP TYPE IF EXISTS public.ownership_type CASCADE;
DROP TYPE IF EXISTS public.mode_type CASCADE;
DROP FUNCTION IF EXISTS public.is_account_member(UUID, UUID) CASCADE;

-- ============================================================
-- 2. Create enum types
-- ============================================================
CREATE TYPE public.account_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE public.record_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');
CREATE TYPE public.verification_status AS ENUM ('pending', 'verified', 'failed');
CREATE TYPE public.ownership_type AS ENUM ('owned', 'rented', 'trial');
CREATE TYPE public.mode_type AS ENUM ('manual', 'scheduled', 'auto');

-- ============================================================
-- 3. Create ALL tables first (no policies yet)
-- ============================================================

-- profiles
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY,
  email        TEXT,
  phone_e164   TEXT,
  first_name   TEXT,
  last_name    TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  status       public.record_status NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- accounts
CREATE TABLE public.accounts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'personal',
  timezone     TEXT NOT NULL DEFAULT 'Europe/Paris',
  locale       TEXT NOT NULL DEFAULT 'fr',
  status       public.record_status NOT NULL DEFAULT 'active',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_accounts_slug ON public.accounts (slug);

-- account_members
CREATE TABLE public.account_members (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id            UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id            UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role                  public.account_role NOT NULL DEFAULT 'member',
  is_default_account    BOOLEAN NOT NULL DEFAULT false,
  invited_by_profile_id UUID REFERENCES public.profiles(id),
  joined_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_account_members_unique ON public.account_members (account_id, profile_id);
CREATE INDEX idx_account_members_profile ON public.account_members (profile_id);

-- phone_numbers
CREATE TABLE public.phone_numbers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL DEFAULT 'twilio',
  provider_number_id  TEXT,
  e164_number         TEXT NOT NULL,
  label               TEXT,
  country_code        TEXT NOT NULL DEFAULT 'FR',
  capabilities        JSONB NOT NULL DEFAULT '{"voice": true, "sms": false}'::jsonb,
  ownership_type      public.ownership_type NOT NULL DEFAULT 'owned',
  verification_status public.verification_status NOT NULL DEFAULT 'pending',
  status              public.record_status NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_phone_numbers_e164 ON public.phone_numbers (e164_number);
CREATE INDEX idx_phone_numbers_account ON public.phone_numbers (account_id);

-- assistant_profiles
CREATE TABLE public.assistant_profiles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id         UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name               TEXT NOT NULL DEFAULT 'Assistant',
  description        TEXT,
  voice_name         TEXT NOT NULL DEFAULT 'Puck',
  language_code      TEXT NOT NULL DEFAULT 'fr-FR',
  greeting_text      TEXT NOT NULL DEFAULT 'Bonjour, comment puis-je vous aider ?',
  introduction_style TEXT NOT NULL DEFAULT 'formal',
  tone_style         TEXT NOT NULL DEFAULT 'professional',
  brevity_level      TEXT NOT NULL DEFAULT 'balanced',
  status             public.record_status NOT NULL DEFAULT 'active',
  is_default         BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_profiles_account ON public.assistant_profiles (account_id);

-- assistant_modes
CREATE TABLE public.assistant_modes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id              UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  assistant_profile_id    UUID NOT NULL REFERENCES public.assistant_profiles(id) ON DELETE CASCADE,
  name                    TEXT NOT NULL DEFAULT 'Standard',
  slug                    TEXT NOT NULL DEFAULT 'standard',
  description             TEXT,
  mode_type               public.mode_type NOT NULL DEFAULT 'manual',
  is_active               BOOLEAN NOT NULL DEFAULT true,
  auto_activation_rules   JSONB DEFAULT '{}'::jsonb,
  urgency_sensitivity     TEXT NOT NULL DEFAULT 'medium',
  allow_booking           BOOLEAN NOT NULL DEFAULT true,
  quiet_hours_enabled     BOOLEAN NOT NULL DEFAULT false,
  quiet_hours_start_local TIME,
  quiet_hours_end_local   TIME,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_assistant_modes_slug ON public.assistant_modes (account_id, slug);
CREATE INDEX idx_assistant_modes_account ON public.assistant_modes (account_id);
CREATE INDEX idx_assistant_modes_profile ON public.assistant_modes (assistant_profile_id);

-- ============================================================
-- 4. Enable RLS on all tables
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistant_modes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. Helper function (all tables exist now)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_account_member(_user_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE profile_id = _user_id AND account_id = _account_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_account_admin(_user_id UUID, _account_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_members
    WHERE profile_id = _user_id AND account_id = _account_id AND role IN ('owner', 'admin')
  );
$$;

-- ============================================================
-- 6. RLS policies
-- ============================================================

-- profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- accounts
CREATE POLICY "Members can view their accounts"
  ON public.accounts FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), id));
CREATE POLICY "Admins can update their accounts"
  ON public.accounts FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), id));
CREATE POLICY "Authenticated users can create accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (true);

-- account_members
CREATE POLICY "Members can view co-members"
  ON public.account_members FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Self or admins can insert members"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR public.is_account_admin(auth.uid(), account_id)
  );
CREATE POLICY "Admins can update members"
  ON public.account_members FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Owners can delete members"
  ON public.account_members FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.account_members am
    WHERE am.account_id = account_members.account_id
      AND am.profile_id = auth.uid()
      AND am.role = 'owner'
  ));

-- phone_numbers
CREATE POLICY "Members can view phone numbers"
  ON public.phone_numbers FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert phone numbers"
  ON public.phone_numbers FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update phone numbers"
  ON public.phone_numbers FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete phone numbers"
  ON public.phone_numbers FOR DELETE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

-- assistant_profiles
CREATE POLICY "Members can view assistant profiles"
  ON public.assistant_profiles FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert assistant profiles"
  ON public.assistant_profiles FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update assistant profiles"
  ON public.assistant_profiles FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete assistant profiles"
  ON public.assistant_profiles FOR DELETE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

-- assistant_modes
CREATE POLICY "Members can view assistant modes"
  ON public.assistant_modes FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));
CREATE POLICY "Admins can insert assistant modes"
  ON public.assistant_modes FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can update assistant modes"
  ON public.assistant_modes FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));
CREATE POLICY "Admins can delete assistant modes"
  ON public.assistant_modes FOR DELETE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

-- ============================================================
-- 7. updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_account_members_updated_at BEFORE UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON public.phone_numbers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assistant_profiles_updated_at BEFORE UPDATE ON public.assistant_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_assistant_modes_updated_at BEFORE UPDATE ON public.assistant_modes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. Signup flow trigger
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
  _display TEXT;
  _slug TEXT;
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
  INSERT INTO public.assistant_modes (account_id, assistant_profile_id, name, slug, is_active)
  VALUES (_account_id, _assistant_id, 'Standard', 'standard', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
