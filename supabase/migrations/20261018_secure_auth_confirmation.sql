-- Only the signed bot gateway may confirm an existing, recent login request.
CREATE OR REPLACE FUNCTION public.logbook_telegram_confirm_auth(
  p_code text, p_telegram_id bigint, p_first_name text, p_username text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text := 'tg_' || p_telegram_id::text || '@telegram.logbook';
  v_password text := encode(gen_random_bytes(32), 'hex');
  v_user_id uuid;
  v_encrypted_pw text;
BEGIN
  IF p_telegram_id IS NULL OR p_telegram_id <= 0 OR p_code IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  PERFORM 1 FROM public.telegram_auth_sessions
    WHERE code = p_code AND status = 'pending'
      AND created_at >= now() - interval '10 minutes'
    FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  v_encrypted_pw := crypt(v_password, gen_salt('bf'));
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token,
      email_change_confirm_status, is_sso_user, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_user_id,
      'authenticated', 'authenticated', v_email, v_encrypted_pw,
      now(), jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('telegram_id', p_telegram_id, 'first_name', p_first_name, 'username', p_username),
      now(), now(), '', '', '', '', '', '', '', '', 0, false, false
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email', v_user_id::text, now(), now(), now()
    ) ON CONFLICT DO NOTHING;
  ELSE
    UPDATE auth.users SET encrypted_password = v_encrypted_pw, updated_at = now()
      WHERE id = v_user_id;
  END IF;

  UPDATE public.telegram_auth_sessions SET
    telegram_id = p_telegram_id, first_name = p_first_name,
    username = p_username, auth_email = v_email,
    auth_password = v_password, status = 'confirmed', confirmed_at = now()
    WHERE code = p_code;
  RETURN jsonb_build_object('ok', true, 'email', v_email, 'password', v_password);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.logbook_telegram_confirm_auth(text, bigint, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logbook_telegram_confirm_auth(text, bigint, text, text)
  TO service_role;
