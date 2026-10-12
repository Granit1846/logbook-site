@echo off
chcp 65001 > nul
cd /d "%~dp0"
"C:\Program Files\Git\cmd\git.exe" config --global --add safe.directory "*"
"C:\Program Files\Git\cmd\git.exe" config user.name "Developer"
"C:\Program Files\Git\cmd\git.exe" config user.email "dev@example.com"
"C:\Program Files\Git\cmd\git.exe" branch -M main
"C:\Program Files\Git\cmd\git.exe" add .
"C:\Program Files\Git\cmd\git.exe" commit -m "Initial commit of LogBook website and Telegram Mini App"
"C:\Program Files\Git\cmd\git.exe" log -n 1 --oneline
