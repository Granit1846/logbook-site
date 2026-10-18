# LogBook bots

The Telegram and MAX bots run as separate, long-lived Node.js processes. Vercel serves the site and does not run these polling processes.

This folder is the only copy of the bot code. Tokens and runtime files stay outside the repository in the directory named by `LOGBOOK_BOT_DATA` (default for `run-bot.cmd`: `%USERPROFILE%\Documents\ChatGPT\LolBook.apk`):

- `.env` with `BOT_TOKEN`, `MAX_BOT_TOKEN` and `ADMIN_ID` — never commit it;
- `subscribers.json`, `max_subscribers.json`, `max_link_requests.json` — private and persistent; both bots must share this directory for the two-step MAX ↔ Telegram link code;
- temporary payloads, backups being sent, and `logs\bot.log` / `logs\max_bot.log`.

## Running

`run-bot.cmd bot.js` or `run-bot.cmd max_bot.js` starts one bot and restarts it 5 seconds after it exits.

On the bot PC two Task Scheduler tasks, `LogBook Telegram bot` and `LogBook MAX bot`, start them hidden at logon:

```powershell
$dir = "<repo>\bots"; $user = "$env:USERDOMAIN\$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
foreach ($bot in @(@('LogBook Telegram bot','bot.js'), @('LogBook MAX bot','max_bot.js'))) {
  $action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\conhost.exe" -Argument "--headless $env:WINDIR\System32\cmd.exe /c run-bot.cmd $($bot[1])" -WorkingDirectory $dir
  Register-ScheduledTask -TaskName $bot[0] -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
}
```

Stop or restart them with `Stop-ScheduledTask` / `Start-ScheduledTask -TaskName 'LogBook MAX bot'`. Never run a second copy at the same time: two pollers steal each other's updates.

## Mini App URL

`*.vercel.app` is unreachable from Russian networks, so the Mini App is served from GitHub Pages (`Granit1846/Granit1846.github.io`, rebuilt from this repository). The Telegram bot sets its menu button to `https://granit1846.github.io/#tg` on start. Set the MAX bot's Mini App URL in the MAX partner settings to `https://granit1846.github.io` (without a fragment), then use the bot's `open_app` button. The bundled Russian Trusted Root CA certificate is used only for MAX API TLS verification.
