CREATE POLICY "Admins can delete escalation events"
ON public.escalation_events
FOR DELETE
TO authenticated
USING (is_account_admin(auth.uid(), account_id));