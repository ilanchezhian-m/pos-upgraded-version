@echo off
title Topi Vappa POS - Create Lightweight Update Patch
cd /d "%~dp0"

echo ========================================================
echo  Creating Lightweight 2MB Update Patch for Client PC
echo  (Client PC will NOT need Node.js, Git, or heavy setup!)
echo ========================================================
echo.

node scripts/build-patch.js

echo.
pause
