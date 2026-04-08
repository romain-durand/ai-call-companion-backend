
-- ============================================================
-- FIX 1: account_members INSERT — admin-only (no self-join)
-- ============================================================
DROP POLICY IF EXISTS "Self or admins can insert members" ON public.account_members;

CREATE POLICY "Admins can insert members"
  ON public.account_members FOR INSERT TO authenticated
  WITH CHECK (
    is_account_admin(auth.uid(), account_id)
  );

-- ============================================================
-- FIX 2: invited_by_profile_id FK → ON DELETE SET NULL
-- ============================================================
ALTER TABLE public.account_members
  DROP CONSTRAINT IF EXISTS account_members_invited_by_profile_id_fkey;

ALTER TABLE public.account_members
  ADD CONSTRAINT account_members_invited_by_profile_id_fkey
  FOREIGN KEY (invited_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- FIX 3: Profiles — co-member visibility
-- ============================================================
-- Keep existing self-only SELECT, UPDATE, INSERT policies unchanged.
-- Add a new SELECT policy for co-members.

CREATE POLICY "Co-members can view shared account profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.account_members my_m
      JOIN public.account_members their_m ON my_m.account_id = their_m.account_id
      WHERE my_m.profile_id = auth.uid()
        AND their_m.profile_id = profiles.id
    )
  );

-- ============================================================
-- FIX 4: Partial unique index — one default account per profile
-- ============================================================
CREATE UNIQUE INDEX idx_one_default_account_per_profile
  ON public.account_members (profile_id)
  WHERE is_default_account = true;

-- ============================================================
-- FIX 5: No DELETE policies added for profiles or accounts
-- (intentionally non-deletable through normal app RLS)
-- ============================================================
-- Explicitly: no DELETE policy on profiles.
-- Explicitly: no DELETE policy on accounts.
