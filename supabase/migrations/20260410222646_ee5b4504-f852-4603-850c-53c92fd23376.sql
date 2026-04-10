-- Replace the system group deletion trigger to only protect the default catch-all group
CREATE OR REPLACE FUNCTION public.prevent_system_group_deletion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only protect the default catch-all group
  IF OLD.slug = 'default_group' THEN
    RAISE EXCEPTION 'Cannot delete the default group "%"', OLD.name;
  END IF;
  RETURN OLD;
END;
$function$;

-- Add a trigger to prevent deletion of groups that have contacts
CREATE OR REPLACE FUNCTION public.prevent_group_deletion_with_contacts()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.contact_group_memberships
    WHERE caller_group_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete group "%" because it still has contacts assigned', OLD.name;
  END IF;
  RETURN OLD;
END;
$function$;

CREATE TRIGGER trg_prevent_group_deletion_with_contacts
  BEFORE DELETE ON public.caller_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_group_deletion_with_contacts();