-- Runtime state of the webhook bots (subscriber lists, MAX link codes), formerly JSON files on the bot PC.
-- Server-only: the edge functions use the service role; clients have no access.
CREATE TABLE IF NOT EXISTS public.bot_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_state ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bot_state FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_state TO service_role;
