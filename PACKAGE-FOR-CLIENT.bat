@echo off
title Topi Vappa POS - Package Standalone App for Client
cd /d "%~dp0"

echo ========================================================
echo  Creating Standalone Windows Package for Client PC
echo  (Client will NOT need Node.js, Git, or any setup!)
echo ========================================================
echo.

node scripts/build-standalone.js

echo.
echo ========================================================
echo  All Done!
echo  Check the folder: release\Topi-Vappa-POS-Windows
echo  You can copy this folder to a USB drive or zip it and
echo  send it to your client.
echo ========================================================
echo.
pause
