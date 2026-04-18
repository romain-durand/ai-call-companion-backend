
-- Step 1: Move group memberships from duplicate to keeper, avoiding conflicts
WITH dups AS (
  SELECT email,
         (array_agg(id ORDER BY (CASE WHEN primary_phone_e164 IS NOT NULL THEN 0 ELSE 1 END), created_at))[1] AS keep_id,
         array_agg(id) AS all_ids
  FROM public.contacts
  WHERE account_id='de6eaf77-6dcf-428f-af9c-898671e83f7b' AND email IS NOT NULL
  GROUP BY email HAVING COUNT(*)>1
),
to_remove AS (
  SELECT keep_id, unnest(all_ids) AS dup_id FROM dups
)
UPDATE public.contact_group_memberships m
SET contact_id = tr.keep_id
FROM to_remove tr
WHERE m.contact_id = tr.dup_id
  AND m.contact_id <> tr.keep_id
  AND NOT EXISTS (
    SELECT 1 FROM public.contact_group_memberships m2
    WHERE m2.contact_id = tr.keep_id AND m2.caller_group_id = m.caller_group_id
  );

-- Step 2: Delete remaining (now-redundant) memberships on duplicates
WITH dups AS (
  SELECT (array_agg(id ORDER BY (CASE WHEN primary_phone_e164 IS NOT NULL THEN 0 ELSE 1 END), created_at))[1] AS keep_id,
         array_agg(id) AS all_ids
  FROM public.contacts
  WHERE account_id='de6eaf77-6dcf-428f-af9c-898671e83f7b' AND email IS NOT NULL
  GROUP BY email HAVING COUNT(*)>1
),
to_remove AS (
  SELECT keep_id, unnest(all_ids) AS dup_id FROM dups
)
DELETE FROM public.contact_group_memberships
WHERE contact_id IN (SELECT dup_id FROM to_remove WHERE dup_id <> keep_id);

-- Step 3: Delete duplicate contacts
WITH dups AS (
  SELECT (array_agg(id ORDER BY (CASE WHEN primary_phone_e164 IS NOT NULL THEN 0 ELSE 1 END), created_at))[1] AS keep_id,
         array_agg(id) AS all_ids
  FROM public.contacts
  WHERE account_id='de6eaf77-6dcf-428f-af9c-898671e83f7b' AND email IS NOT NULL
  GROUP BY email HAVING COUNT(*)>1
),
to_remove AS (
  SELECT keep_id, unnest(all_ids) AS dup_id FROM dups
)
DELETE FROM public.contacts
WHERE id IN (SELECT dup_id FROM to_remove WHERE dup_id <> keep_id);
