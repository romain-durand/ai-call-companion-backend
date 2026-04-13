-- Remove the dangerous anon policy on profiles table
DROP POLICY IF EXISTS "Anon can read profiles via public view" ON public.profiles;

-- Switch view back to security definer (safe: only exposes display_name, first_name)
ALTER VIEW public.public_profiles SET (security_invoker = off);