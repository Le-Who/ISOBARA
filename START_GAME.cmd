@echo off
setlocal
set "SCRIPT=%~dp0START_GAME.ps1"

if not exist "%SCRIPT%" (
  echo ERROR: START_GAME.ps1 was not found.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%"
set "RC=%ERRORLEVEL%"
if not "%RC%"=="0" pause
exit /b %RC%
