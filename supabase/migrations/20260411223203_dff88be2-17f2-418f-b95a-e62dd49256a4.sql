-- Create transfer request status enum
CREATE TYPE public.transfer_status AS ENUM ('pending', 'accepted', 'declined', 'timeout', 'completed');

-- Create transfer_requests table
CREATE TABLE public.transfer_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  call_session_id UUID NOT NULL REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT '',
  caller_name TEXT,
  caller_phone_e164 TEXT,
  status public.transfer_status NOT NULL DEFAULT 'pending',
  answered_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transfer_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view transfer requests"
ON public.transfer_requests FOR SELECT
TO authenticated
USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Members can update transfer requests"
ON public.transfer_requests FOR UPDATE
TO authenticated
USING (is_account_member(auth.uid(), account_id));

CREATE POLICY "Admins can insert transfer requests"
ON public.transfer_requests FOR INSERT
TO authenticated
WITH CHECK (is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete transfer requests"
ON public.transfer_requests FOR DELETE
TO authenticated
USING (is_account_admin(auth.uid(), account_id));

-- Allow service role to insert (bridge server uses service role)
-- Service role bypasses RLS by default, so no extra policy needed

-- Trigger for updated_at
CREATE TRIGGER update_transfer_requests_updated_at
  BEFORE UPDATE ON public.transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Account isolation trigger
CREATE OR REPLACE FUNCTION public.check_transfer_request_account()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.call_sessions WHERE id = NEW.call_session_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'call_session % does not belong to account %', NEW.call_session_id, NEW.account_id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_check_transfer_request_account
  BEFORE INSERT OR UPDATE ON public.transfer_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_transfer_request_account();

-- Enable realtime for instant notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.transfer_requests;