
UPDATE public.call_handling_rules chr
SET priority_rank = cg.priority_rank
FROM public.caller_groups cg
WHERE chr.caller_group_id = cg.id
  AND chr.priority_rank != cg.priority_rank;
