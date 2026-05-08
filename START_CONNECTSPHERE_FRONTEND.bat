@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-frontend.ps1"
if errorlevel 1 (
  echo.
  echo Frontend failed to start. Check the message above.
  pause
)
