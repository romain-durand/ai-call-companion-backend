
-- First revert column to text, then move extension
ALTER TABLE public.contacts ALTER COLUMN email TYPE text USING email::text;
DROP EXTENSION IF EXISTS citext;
CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
ALTER TABLE public.contacts ALTER COLUMN email TYPE extensions.citext USING email::extensions.citext;
