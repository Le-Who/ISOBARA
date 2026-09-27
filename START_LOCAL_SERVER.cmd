@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Для локального сервера нужен Node.js 20 или новее.
 echo Без установки Node.js можно открыть START_GAME.cmd.
 pause
 exit /b 1
)
node tools\serve.mjs --open
if errorlevel 1 pause
