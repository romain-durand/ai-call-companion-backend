CREATE POLICY "Anon can read profiles via public view"
ON public.profiles
FOR SELECT
TO anon
USING (true);