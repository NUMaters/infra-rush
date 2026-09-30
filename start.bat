@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
title INFRA RUSH

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install the LTS version from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
where go >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Go is not installed. Install it from https://go.dev/dl/ and run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages ^(first run only, a few minutes^)...
  call npm ci
  if errorlevel 1 goto :fail
)
if not exist dist\index.html (
  echo Building the game ^(first run only^)...
  call npm run build
  if errorlevel 1 goto :fail
)

echo.
echo INFRA RUSH: http://localhost:8080/
echo Close this window to stop the game.
start "" "http://localhost:8080/"
go run ./server -addr 127.0.0.1:8080 -static dist -master master
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo [ERROR] Startup failed. See the messages above.
pause
exit /b 1
