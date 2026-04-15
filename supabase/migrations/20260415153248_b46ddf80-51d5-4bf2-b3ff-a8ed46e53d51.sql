-- Add hangup_by column to track who ended the call
ALTER TABLE public.outbound_missions
ADD COLUMN hangup_by text DEFAULT NULL;

COMMENT ON COLUMN public.outbound_missions.hangup_by IS 'Who hung up: callee, assistant, or error';