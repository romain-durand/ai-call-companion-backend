
-- 1. Update handle_new_user to create 4 modes with rules per group
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _account_id UUID;
  _assistant_id UUID;
  _mode_id UUID;
  _display TEXT;
  _slug TEXT;
  _group RECORD;
  _default_groups TEXT[][] := ARRAY[
    ARRAY['Non classés',  'default_group', '❓', '#6B7280', '0'],
    ARRAY['Famille',      'family',        '👨‍👩‍👧‍👦', '#8B5CF6', '10'],
    ARRAY['Amis',         'friends',       '🤝',     '#06B6D4', '20'],
    ARRAY['Travail',      'work',          '💼',     '#10B981', '30'],
    ARRAY['VIP',          'vip',           '⭐',     '#F59E0B', '40'],
    ARRAY['Bloqués',      'blocked',       '🚫',     '#EF4444', '50']
  ];
  _group_ids UUID[];
  _group_slugs TEXT[];
  _group_id UUID;
  _i INT;

  -- Mode definitions: name, slug, description, is_active
  _modes TEXT[][] := ARRAY[
    ARRAY['Standard', 'standard', 'Heures de bureau — priorise les clients et VIP', 'true'],
    ARRAY['Personnel', 'personal', 'Temps libre — famille et amis en priorité', 'false'],
    ARRAY['Nuit', 'night', 'Ne déranger qu''en cas d''urgence', 'false'],
    ARRAY['Focus', 'focus', 'Concentration totale — tout en messagerie', 'false']
  ];
  _m INT;
  _behavior public.call_behavior;
BEGIN
  _display := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  _slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'gi'))
            || '-' || substr(gen_random_uuid()::text, 1, 8);

  -- 1. Profile
  INSERT INTO public.profiles (id, email, display_name, avatar_url, phone_e164)
  VALUES (
    NEW.id,
    NEW.email,
    _display,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '')
  );

  -- 2. Default account
  INSERT INTO public.accounts (id, name, slug)
  VALUES (gen_random_uuid(), _display, _slug)
  RETURNING id INTO _account_id;

  -- 3. Owner membership
  INSERT INTO public.account_members (account_id, profile_id, role, is_default_account)
  VALUES (_account_id, NEW.id, 'owner', true);

  -- 4. Default assistant profile
  INSERT INTO public.assistant_profiles (id, account_id, name, is_default)
  VALUES (gen_random_uuid(), _account_id, 'Mon Assistant', true)
  RETURNING id INTO _assistant_id;

  -- 5. Seed default caller groups
  _group_ids := ARRAY[]::UUID[];
  _group_slugs := ARRAY[]::TEXT[];
  FOR _i IN 1..array_length(_default_groups, 1) LOOP
    INSERT INTO public.caller_groups (id, account_id, name, slug, icon, color, group_type, priority_rank)
    VALUES (
      gen_random_uuid(), _account_id,
      _default_groups[_i][1], _default_groups[_i][2], _default_groups[_i][3],
      _default_groups[_i][4], 'system', _default_groups[_i][5]::int
    )
    RETURNING id INTO _group_id;
    _group_ids := array_append(_group_ids, _group_id);
    _group_slugs := array_append(_group_slugs, _default_groups[_i][2]);
  END LOOP;

  -- 6. Create 4 modes with handling rules per group
  FOR _m IN 1..array_length(_modes, 1) LOOP
    INSERT INTO public.assistant_modes (id, account_id, assistant_profile_id, name, slug, description, is_active)
    VALUES (gen_random_uuid(), _account_id, _assistant_id, _modes[_m][1], _modes[_m][2], _modes[_m][3], _modes[_m][4]::boolean)
    RETURNING id INTO _mode_id;

    -- Create rules for each group in this mode
    FOR _i IN 1..array_length(_group_slugs, 1) LOOP
      _behavior := CASE
        -- Standard mode: escalate family+VIP, message others, block blocked
        WHEN _modes[_m][2] = 'standard' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'vip' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        -- Personnel mode: escalate family+friends, message others
        WHEN _modes[_m][2] = 'personal' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'friends' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        -- Nuit mode: only escalate family, everything else message
        WHEN _modes[_m][2] = 'night' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        -- Focus mode: block blocked, message everything
        WHEN _modes[_m][2] = 'focus' THEN
          CASE _group_slugs[_i]
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        ELSE 'answer_and_take_message'::call_behavior
      END;

      INSERT INTO public.call_handling_rules (
        account_id, assistant_mode_id, caller_group_id, behavior,
        booking_allowed, escalation_allowed, force_escalation, callback_allowed, summary_required, priority_rank
      ) VALUES (
        _account_id, _mode_id, _group_ids[_i], _behavior,
        false,
        _behavior = 'answer_and_escalate',
        false,
        _group_slugs[_i] != 'blocked',
        true,
        _default_groups[_i][5]::int
      );
    END LOOP;
  END LOOP;

  -- 7. Seed notification preferences
  INSERT INTO public.notification_preferences (account_id, profile_id, event_type, channel, enabled, priority_threshold, quiet_hours_override, fallback_order) VALUES
    (_account_id, NEW.id, 'urgent_call', 'push', true, 'high', true, 1),
    (_account_id, NEW.id, 'urgent_call', 'sms', true, 'high', true, 2),
    (_account_id, NEW.id, 'callback_request', 'push', true, 'normal', false, 1),
    (_account_id, NEW.id, 'appointment_booked', 'push', true, 'normal', false, 1),
    (_account_id, NEW.id, 'appointment_booked', 'email', true, 'normal', false, 2),
    (_account_id, NEW.id, 'call_summary', 'push', true, 'low', false, 1);

  RETURN NEW;
END;
$$;

-- 2. Backfill existing accounts with missing modes
DO $$
DECLARE
  _acc RECORD;
  _assistant_id UUID;
  _mode_id UUID;
  _group RECORD;
  _behavior public.call_behavior;
  _modes TEXT[][] := ARRAY[
    ARRAY['Personnel', 'personal', 'Temps libre — famille et amis en priorité', 'false'],
    ARRAY['Nuit', 'night', 'Ne déranger qu''en cas d''urgence', 'false'],
    ARRAY['Focus', 'focus', 'Concentration totale — tout en messagerie', 'false']
  ];
  _m INT;
BEGIN
  FOR _acc IN SELECT id FROM public.accounts LOOP
    -- Get assistant profile for this account
    SELECT id INTO _assistant_id FROM public.assistant_profiles
      WHERE account_id = _acc.id AND is_default = true LIMIT 1;

    IF _assistant_id IS NULL THEN
      CONTINUE;
    END IF;

    -- Also add description to existing Standard mode if missing
    UPDATE public.assistant_modes
    SET description = 'Heures de bureau — priorise les clients et VIP'
    WHERE account_id = _acc.id AND slug = 'standard' AND description IS NULL;

    -- Create each missing mode
    FOR _m IN 1..array_length(_modes, 1) LOOP
      -- Skip if mode already exists
      IF EXISTS (SELECT 1 FROM public.assistant_modes WHERE account_id = _acc.id AND slug = _modes[_m][2]) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.assistant_modes (id, account_id, assistant_profile_id, name, slug, description, is_active)
      VALUES (gen_random_uuid(), _acc.id, _assistant_id, _modes[_m][1], _modes[_m][2], _modes[_m][3], false)
      RETURNING id INTO _mode_id;

      -- Create rules for each caller group in this account
      FOR _group IN SELECT id, slug FROM public.caller_groups WHERE account_id = _acc.id LOOP
        _behavior := CASE
          WHEN _modes[_m][2] = 'personal' THEN
            CASE _group.slug
              WHEN 'family' THEN 'answer_and_escalate'::call_behavior
              WHEN 'friends' THEN 'answer_and_escalate'::call_behavior
              WHEN 'blocked' THEN 'block'::call_behavior
              ELSE 'answer_and_take_message'::call_behavior
            END
          WHEN _modes[_m][2] = 'night' THEN
            CASE _group.slug
              WHEN 'family' THEN 'answer_and_escalate'::call_behavior
              WHEN 'blocked' THEN 'block'::call_behavior
              ELSE 'answer_and_take_message'::call_behavior
            END
          WHEN _modes[_m][2] = 'focus' THEN
            CASE _group.slug
              WHEN 'blocked' THEN 'block'::call_behavior
              ELSE 'answer_and_take_message'::call_behavior
            END
          ELSE 'answer_and_take_message'::call_behavior
        END;

        INSERT INTO public.call_handling_rules (
          account_id, assistant_mode_id, caller_group_id, behavior,
          booking_allowed, escalation_allowed, force_escalation, callback_allowed, summary_required, priority_rank
        ) VALUES (
          _acc.id, _mode_id, _group.id, _behavior,
          false,
          _behavior = 'answer_and_escalate',
          false,
          _group.slug != 'blocked',
          true,
          0
        );
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;
