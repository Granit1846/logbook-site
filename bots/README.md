# LogBook bots

The Telegram and MAX bots run as separate, long-lived Node.js processes. Vercel serves the site and does not run these polling processes.

Create `bots/.env` on the bot host with `BOT_TOKEN`, `MAX_BOT_TOKEN`, and `ADMIN_ID`. Do not commit that file. Start each process from this directory:

```sh
node bot.js
node max_bot.js
```

Keep `max_subscribers.json`, `subscribers.json`, and `max_link_requests.json` private and persistent on the bot host. Both bots must use the same directory for the two-step MAX ↔ Telegram link code. The bundled Russian Trusted Root CA certificate is used only for MAX API TLS verification.

Set the MAX bot's Mini App URL in the MAX partner settings to `https://logbook-site-five.vercel.app` (without a URL fragment), then use the bot's `open_app` button. The MAX client adds signed `WebAppData` to the launch URL.
