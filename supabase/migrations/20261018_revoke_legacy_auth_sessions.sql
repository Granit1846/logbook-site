-- Password rotation alone does not invalidate refresh tokens from old sessions.
-- A fresh signed Mini App launch obtains a new session automatically.
DELETE FROM auth.sessions
WHERE user_id IN (
  SELECT id FROM auth.users
  WHERE email ~ '^tg_[0-9]+@telegram\.logbook$'
);
