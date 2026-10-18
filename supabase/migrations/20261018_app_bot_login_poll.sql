-- Android/desktop bot login: only the app holding the poll secret may collect the session.
ALTER TABLE public.telegram_auth_sessions ADD COLUMN IF NOT EXISTS poll_hash text;
