
-- 1. Rename Standard → Travail and swap active mode for existing accounts
UPDATE public.assistant_modes SET name = 'Travail', slug = 'work', description = 'Heures de bureau — priorise les clients et VIP'
WHERE slug = 'standard';

UPDATE public.assistant_modes SET is_active = false WHERE slug = 'work';
UPDATE public.assistant_modes SET is_active = true WHERE slug = 'personal';

-- 2. Update the signup trigger
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
  _default_groups TEXT[][] := ARRAY[
    ARRAY['Non classés',  'default_group', '❓', '#6B7280', '0'],
    ARRAY['Famille',      'family',        '👨‍👩‍👧‍👦', '#8B5CF6', '10'],
    ARRAY['Amis',         'friends',       '🤝',     '#06B6D4', '20'],
    ARRAY['Travail',      'work_group',    '💼',     '#10B981', '30'],
    ARRAY['VIP',          'vip',           '⭐',     '#F59E0B', '40'],
    ARRAY['Bloqués',      'blocked',       '🚫',     '#EF4444', '50']
  ];
  _group_ids UUID[];
  _group_slugs TEXT[];
  _group_id UUID;
  _i INT;
  _modes TEXT[][] := ARRAY[
    ARRAY['Travail',   'work',     'Heures de bureau — priorise les clients et VIP', 'false'],
    ARRAY['Personnel', 'personal', 'Temps libre — famille et amis en priorité',      'true'],
    ARRAY['Nuit',      'night',    'Ne déranger qu''en cas d''urgence',              'false'],
    ARRAY['Focus',     'focus',    'Concentration totale — tout en messagerie',      'false']
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

  INSERT INTO public.profiles (id, email, display_name, avatar_url, phone_e164)
  VALUES (NEW.id, NEW.email, _display,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''));

  INSERT INTO public.accounts (id, name, slug)
  VALUES (gen_random_uuid(), _display, _slug)
  RETURNING id INTO _account_id;

  INSERT INTO public.account_members (account_id, profile_id, role, is_default_account)
  VALUES (_account_id, NEW.id, 'owner', true);

  INSERT INTO public.assistant_profiles (id, account_id, name, is_default)
  VALUES (gen_random_uuid(), _account_id, 'Mon Assistant', true)
  RETURNING id INTO _assistant_id;

  _group_ids := ARRAY[]::UUID[];
  _group_slugs := ARRAY[]::TEXT[];
  FOR _i IN 1..array_length(_default_groups, 1) LOOP
    INSERT INTO public.caller_groups (id, account_id, name, slug, icon, color, group_type, priority_rank)
    VALUES (gen_random_uuid(), _account_id,
      _default_groups[_i][1], _default_groups[_i][2], _default_groups[_i][3],
      _default_groups[_i][4], 'system', _default_groups[_i][5]::int)
    RETURNING id INTO _group_id;
    _group_ids := array_append(_group_ids, _group_id);
    _group_slugs := array_append(_group_slugs, _default_groups[_i][2]);
  END LOOP;

  FOR _m IN 1..array_length(_modes, 1) LOOP
    INSERT INTO public.assistant_modes (id, account_id, assistant_profile_id, name, slug, description, is_active)
    VALUES (gen_random_uuid(), _account_id, _assistant_id, _modes[_m][1], _modes[_m][2], _modes[_m][3], _modes[_m][4]::boolean)
    RETURNING id INTO _mode_id;

    FOR _i IN 1..array_length(_group_slugs, 1) LOOP
      _behavior := CASE
        WHEN _modes[_m][2] = 'work' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'vip' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        WHEN _modes[_m][2] = 'personal' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'friends' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
        WHEN _modes[_m][2] = 'night' THEN
          CASE _group_slugs[_i]
            WHEN 'family' THEN 'answer_and_escalate'::call_behavior
            WHEN 'blocked' THEN 'block'::call_behavior
            ELSE 'answer_and_take_message'::call_behavior
          END
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
        false, _behavior = 'answer_and_escalate', false,
        _group_slugs[_i] != 'blocked', true, _default_groups[_i][5]::int
      );
    END LOOP;
  END LOOP;

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
