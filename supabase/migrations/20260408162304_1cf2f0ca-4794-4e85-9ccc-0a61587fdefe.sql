
-- Fix permissive INSERT policy on accounts
DROP POLICY IF EXISTS "Authenticated users can create accounts" ON public.accounts;

-- The signup trigger runs as SECURITY DEFINER so it bypasses RLS.
-- For normal user-initiated account creation, require the user to be authenticated.
-- We keep a policy but scope it so only the trigger (SECURITY DEFINER) or
-- a logged-in user can create. Since the trigger bypasses RLS, we can be strict here.
CREATE POLICY "Authenticated users can create accounts"
  ON public.accounts FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_members
      WHERE account_id = accounts.id AND profile_id = auth.uid() AND role = 'owner'
    )
  );
