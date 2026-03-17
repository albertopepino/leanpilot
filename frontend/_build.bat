@echo off
cd /d "%~dp0"
call npm run build 2>&1
echo EXIT_CODE=%ERRORLEVEL%
