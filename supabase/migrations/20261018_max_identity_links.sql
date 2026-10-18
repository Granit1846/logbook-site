-- ASVS V2/V4: only a bot-confirmed MAX identity may share a Telegram account.
CREATE TABLE IF NOT EXISTS public.max_identity_links (
  max_user_id bigint PRIMARY KEY,
  telegram_user_id bigint NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.max_identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.max_identity_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.max_identity_links TO service_role;
