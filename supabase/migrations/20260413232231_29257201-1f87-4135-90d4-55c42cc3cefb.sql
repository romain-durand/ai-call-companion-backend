DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT id, display_name
FROM public.profiles;

ALTER VIEW public.public_profiles SET (security_invoker = off);

GRANT SELECT ON public.public_profiles TO anon;