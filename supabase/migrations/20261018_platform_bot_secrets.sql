-- ASVS V6: bot tokens stay encrypted at rest and are readable only by the server role.
CREATE OR REPLACE FUNCTION public.logbook_platform_bot_token(p_platform text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = CASE p_platform
    WHEN 'max' THEN 'logbook_max_bot_token'
    WHEN 'telegram' THEN 'logbook_telegram_bot_token'
    ELSE NULL
  END
  ORDER BY created_at DESC
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.logbook_platform_bot_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.logbook_platform_bot_token(text) TO service_role;
