-- An email account signed in on the app can attach a bot: the confirmed code then makes it
-- the email alias of the bot account (tg_<id>@telegram.logbook).
ALTER TABLE public.telegram_auth_sessions ADD COLUMN IF NOT EXISTS link_user_id uuid;
