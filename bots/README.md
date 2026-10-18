# LogBook bots

The Telegram and MAX bots run as Supabase Edge Functions behind webhooks — no PC or server has to stay on:

- `supabase/functions/telegram-bot` — Telegram posts every update here (header `X-Telegram-Bot-Api-Secret-Token`, secret `TELEGRAM_WEBHOOK_SECRET`; `max_connections: 1`, so updates arrive one at a time);
- `supabase/functions/max-bot` — MAX posts every update to `…/max-bot?s=<MAX_WEBHOOK_SECRET>`;
- `supabase/functions/_shared/bot_runtime.ts` — fetch-based I/O, bot tokens from Vault (`logbook_platform_bot_token`), sessions via `platform-auth`, and the `bot_state` table (subscribers, MAX link codes, calculator input, cached sessions; service role only);
- `supabase/functions/_shared/ru_root_ca.ts` — the Russian Trusted Root CA that the MAX Bot API certificate chains to.

Both functions are deployed with `--no-verify-jwt`; the webhook secret is the authentication. The edge functions are the source of the bot logic now; the MAX bot there also has the numeric keypad calculator.

## Switching webhooks

A POST with the secret and `{"action":"setup"}` registers the webhook (Telegram: `setWebhook`, menu button, commands; MAX: `/subscriptions`, commands); `{"action":"teardown"}` removes it. To rotate a secret: `npx supabase secrets set TELEGRAM_WEBHOOK_SECRET=<new>` (or `MAX_WEBHOOK_SECRET`), then call `setup` with the new value.

## Rollback to the PC bots

`bot.js`, `max_bot.js`, `platform_session.js` and `run-bot.cmd` in this folder are the previous long-polling versions, kept only as a fallback. Polling and a webhook cannot run together:

1. call `teardown` on the function (or `deleteWebhook` / `DELETE /subscriptions`);
2. enable and start the Task Scheduler task (`LogBook Telegram bot` / `LogBook MAX bot`), which runs `run-bot.cmd` with tokens and data from `LOGBOOK_BOT_DATA` (default `%USERPROFILE%\Documents\ChatGPT\LolBook.apk`, outside the repository).

Subscribers and link codes live in `bot_state` now; the PC versions read the old JSON files, so copy them back from `bot_state` first if the rollback is more than temporary.

## Mini App URL

`*.vercel.app` is unreachable from Russian networks, so the Mini App is served from GitHub Pages (`Granit1846/Granit1846.github.io`, rebuilt from this repository). The Telegram bot's menu button points to `https://granit1846.github.io/#tg`. The MAX bot's Mini App URL is set in the MAX partner settings to `https://granit1846.github.io` (without a fragment).
