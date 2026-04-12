
ALTER TABLE public.calendar_calendars
ADD COLUMN is_watched BOOLEAN NOT NULL DEFAULT false;

-- Set primary calendars as watched by default
UPDATE public.calendar_calendars SET is_watched = true WHERE is_primary = true;
