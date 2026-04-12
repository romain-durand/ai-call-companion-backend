-- Add is_default_outbound flag to phone_numbers
ALTER TABLE public.phone_numbers
ADD COLUMN is_default_outbound boolean NOT NULL DEFAULT false;

-- Ensure at most one default outbound number per account
CREATE UNIQUE INDEX idx_phone_numbers_default_outbound
ON public.phone_numbers (account_id)
WHERE is_default_outbound = true AND status = 'active';