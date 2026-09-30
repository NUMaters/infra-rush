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

node scripts\launcher.mjs
if errorlevel 1 (
  echo.
  echo [ERROR] Startup failed. See the messages above.
  pause
  exit /b 1
)
