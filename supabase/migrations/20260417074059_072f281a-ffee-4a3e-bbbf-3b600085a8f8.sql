ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS about_shareable text,
  ADD COLUMN IF NOT EXISTS about_confidential text,
  ADD COLUMN IF NOT EXISTS current_note_shareable text,
  ADD COLUMN IF NOT EXISTS current_note_confidential text,
  ADD COLUMN IF NOT EXISTS current_note_expires_at timestamptz;