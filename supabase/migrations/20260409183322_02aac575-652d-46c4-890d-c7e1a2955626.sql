-- Drop the old uniqueness index that is too broad
DROP INDEX IF EXISTS public.uq_notification_pref;

-- Create the correct account-scoped uniqueness constraint
CREATE UNIQUE INDEX uq_notification_pref ON public.notification_preferences (account_id, profile_id, event_type, channel);