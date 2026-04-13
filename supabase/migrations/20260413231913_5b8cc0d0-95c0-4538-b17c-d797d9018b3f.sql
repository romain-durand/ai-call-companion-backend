-- Remove the overly permissive anon policy
DROP POLICY IF EXISTS "Public can view profile display name" ON public.profiles;

-- Create a safe public view with only non-sensitive fields
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, display_name, first_name
FROM public.profiles;

-- Grant anon access to the view only
GRANT SELECT ON public.public_profiles TO anon;
