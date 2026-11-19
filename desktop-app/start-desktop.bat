@echo off
title Topi Vappa POS - Desktop Edition
cd /d "%~dp0"

echo ====================================================
echo  Topi Vappa POS - Windows Desktop Edition
echo  (Silent Direct Thermal Printing - No Browser Prompts)
echo ====================================================
echo.

if not exist "node_modules\" (
  echo [Info] Installing dependencies...
  call npm install
)

echo [Info] Building frontend application...
call npm run build

echo [Info] Launching Desktop POS...
call npx electron .
