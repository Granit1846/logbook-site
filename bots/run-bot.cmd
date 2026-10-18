@echo off
rem Runs one LogBook bot and restarts it 5 seconds after it exits. Usage: run-bot.cmd bot.js ^| max_bot.js
rem Tokens and data live in LOGBOOK_BOT_DATA, outside the repository; logs are appended there under logs\.
cd /d "%~dp0"
if not defined LOGBOOK_BOT_DATA set "LOGBOOK_BOT_DATA=%USERPROFILE%\Documents\ChatGPT\LolBook.apk"
if not exist "%LOGBOOK_BOT_DATA%\logs" mkdir "%LOGBOOK_BOT_DATA%\logs"
:loop
echo [%date% %time%] start %1>> "%LOGBOOK_BOT_DATA%\logs\%~n1.log"
node %1 >> "%LOGBOOK_BOT_DATA%\logs\%~n1.log" 2>&1
timeout /t 5 /nobreak >nul
goto loop
