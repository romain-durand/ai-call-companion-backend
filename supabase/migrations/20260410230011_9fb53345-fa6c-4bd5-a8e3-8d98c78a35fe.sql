
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_instructions text;
ALTER TABLE public.caller_groups ADD COLUMN IF NOT EXISTS custom_instructions text;
