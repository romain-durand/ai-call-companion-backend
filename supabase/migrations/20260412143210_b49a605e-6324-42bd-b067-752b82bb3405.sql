
ALTER TABLE public.calendar_calendars
ADD COLUMN is_target BOOLEAN NOT NULL DEFAULT false;

-- Set primary calendar as target by default
UPDATE public.calendar_calendars SET is_target = true WHERE is_primary = true;
