
-- Extend contact_source enum to support new import sources
ALTER TYPE public.contact_source ADD VALUE IF NOT EXISTS 'google_import';
ALTER TYPE public.contact_source ADD VALUE IF NOT EXISTS 'vcard_import';

-- New table for contact import OAuth connections
CREATE TABLE IF NOT EXISTS public.contact_import_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'google',
  provider_account_id TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}'::TEXT[],
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, profile_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_contact_import_connections_account
  ON public.contact_import_connections(account_id);

ALTER TABLE public.contact_import_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view contact import connections"
  ON public.contact_import_connections
  FOR SELECT TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert contact import connections"
  ON public.contact_import_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update contact import connections"
  ON public.contact_import_connections
  FOR UPDATE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete contact import connections"
  ON public.contact_import_connections
  FOR DELETE TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

CREATE TRIGGER update_contact_import_connections_updated_at
  BEFORE UPDATE ON public.contact_import_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
