
-- Drop and recreate all policies with proper schema-qualified function calls
DROP POLICY IF EXISTS "Admins can insert outbound missions" ON public.outbound_missions;
DROP POLICY IF EXISTS "Admins can update outbound missions" ON public.outbound_missions;
DROP POLICY IF EXISTS "Admins can delete outbound missions" ON public.outbound_missions;
DROP POLICY IF EXISTS "Members can view outbound missions" ON public.outbound_missions;

CREATE POLICY "Admins can insert outbound missions"
  ON public.outbound_missions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can update outbound missions"
  ON public.outbound_missions FOR UPDATE
  TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

CREATE POLICY "Admins can delete outbound missions"
  ON public.outbound_missions FOR DELETE
  TO authenticated
  USING (public.is_account_admin(auth.uid(), account_id));

CREATE POLICY "Members can view outbound missions"
  ON public.outbound_missions FOR SELECT
  TO authenticated
  USING (public.is_account_member(auth.uid(), account_id));
