CREATE POLICY "Public can view profile display name"
ON public.profiles
FOR SELECT
TO anon
USING (true);