-- Legacy desktop/Android builds used anonymous table access and stored login
-- passwords in rows readable by every anonymous client. Retire that channel.
REVOKE ALL ON TABLE public.telegram_auth_sessions FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.telegram_auth_sessions TO service_role;

-- Invalidate passwords that were exposed through the former public table.
UPDATE auth.users SET
  encrypted_password = crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')),
  updated_at = now()
WHERE email ~ '^tg_[0-9]+@telegram\.logbook$';

-- Old confirmed rows are no longer needed and contain exposed passwords.
DELETE FROM public.telegram_auth_sessions;
