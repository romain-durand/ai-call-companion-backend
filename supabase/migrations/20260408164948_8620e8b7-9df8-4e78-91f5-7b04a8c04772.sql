
-- 1. Add only truly missing foreign keys (the _account_id ones already exist from prior migration)
-- Skip: caller_groups_account_id_fkey, contacts_account_id_fkey, 
--        contact_group_memberships_account_id_fkey, contact_group_memberships_contact_id_fkey,
--        contact_group_memberships_caller_group_id_fkey,
--        call_handling_rules_account_id_fkey, call_handling_rules_assistant_mode_id_fkey,
--        call_handling_rules_caller_group_id_fkey,
--        assistant_modes_account_id_fkey, assistant_modes_assistant_profile_id_fkey,
--        assistant_profiles_account_id_fkey, phone_numbers_account_id_fkey,
--        account_members_account_id_fkey, account_members_profile_id_fkey,
--        account_members_invited_by_profile_id_fkey
-- All FKs were created in previous migrations. Moving to triggers and constraints.

-- 2. Account consistency trigger for contact_group_memberships
CREATE OR REPLACE FUNCTION public.check_contact_group_membership_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = NEW.contact_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'contact % does not belong to account %', NEW.contact_id, NEW.account_id;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.caller_groups WHERE id = NEW.caller_group_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'caller_group % does not belong to account %', NEW.caller_group_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_contact_group_membership_account
BEFORE INSERT OR UPDATE ON public.contact_group_memberships
FOR EACH ROW EXECUTE FUNCTION public.check_contact_group_membership_account();

-- 3. Account consistency trigger for call_handling_rules
CREATE OR REPLACE FUNCTION public.check_call_handling_rule_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
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

CREATE TRIGGER trg_check_call_handling_rule_account
BEFORE INSERT OR UPDATE ON public.call_handling_rules
FOR EACH ROW EXECUTE FUNCTION public.check_call_handling_rule_account();

-- 4. Auto-compute display_name for contacts
CREATE OR REPLACE FUNCTION public.compute_contact_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.display_name IS NULL OR trim(NEW.display_name) = '' THEN
    NEW.display_name := COALESCE(
      NULLIF(trim(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '')), ''),
      NEW.company_name,
      NEW.email,
      NEW.primary_phone_e164,
      'Contact sans nom'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_compute_contact_display_name
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.compute_contact_display_name();

-- 5. Case-insensitive email via citext
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

ALTER TABLE public.contacts
  ALTER COLUMN email TYPE public.citext USING email::public.citext;

-- 6. Protect system caller groups from deletion
CREATE OR REPLACE FUNCTION public.prevent_system_group_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.group_type = 'system' THEN
    RAISE EXCEPTION 'Cannot delete system caller group "%"', OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_prevent_system_group_deletion
BEFORE DELETE ON public.caller_groups
FOR EACH ROW EXECUTE FUNCTION public.prevent_system_group_deletion();

-- 7. Performance indexes
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON public.contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_primary_phone ON public.contacts(account_id, primary_phone_e164) WHERE primary_phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(account_id, email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_caller_groups_account_slug ON public.caller_groups(account_id, slug);
CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_contact ON public.contact_group_memberships(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_group ON public.contact_group_memberships(caller_group_id);
CREATE INDEX IF NOT EXISTS idx_call_handling_rules_mode ON public.call_handling_rules(assistant_mode_id);
CREATE INDEX IF NOT EXISTS idx_call_handling_rules_group ON public.call_handling_rules(caller_group_id);
