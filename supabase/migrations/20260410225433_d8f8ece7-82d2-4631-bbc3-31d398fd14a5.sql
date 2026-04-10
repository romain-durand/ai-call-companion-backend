
DO $$
DECLARE
  _acc RECORD;
  _mode_id UUID;
  _group RECORD;
  _behavior public.call_behavior;
BEGIN
  FOR _acc IN SELECT id FROM public.accounts LOOP
    -- Get the work mode for this account
    SELECT id INTO _mode_id FROM public.assistant_modes
      WHERE account_id = _acc.id AND slug = 'work' LIMIT 1;

    IF _mode_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Delete old rules for this mode
    DELETE FROM public.call_handling_rules
      WHERE assistant_mode_id = _mode_id AND account_id = _acc.id;

    -- Recreate rules from current groups
    FOR _group IN SELECT id, slug, priority_rank FROM public.caller_groups WHERE account_id = _acc.id LOOP
      _behavior := CASE _group.slug
        WHEN 'family' THEN 'answer_and_escalate'::call_behavior
        WHEN 'vip' THEN 'answer_and_escalate'::call_behavior
        WHEN 'blocked' THEN 'block'::call_behavior
        ELSE 'answer_and_take_message'::call_behavior
      END;

      INSERT INTO public.call_handling_rules (
        account_id, assistant_mode_id, caller_group_id, behavior,
        booking_allowed, escalation_allowed, force_escalation, callback_allowed, summary_required, priority_rank
      ) VALUES (
        _acc.id, _mode_id, _group.id, _behavior,
        false, _behavior = 'answer_and_escalate', false,
        _group.slug != 'blocked', true, _group.priority_rank
      );
    END LOOP;
  END LOOP;
END;
$$;
