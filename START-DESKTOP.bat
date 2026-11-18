@echo off
title Topi Vappa POS - Desktop Startup
cd /d "%~dp0"

echo ====================================================
echo  Topi Vappa Complete POS System (Desktop Edition)
echo ====================================================
echo.

echo [1/3] Starting Print Server (Port 5001)...
start "Print Server" cmd /k "cd /d %~dp0print-server && npm start"
timeout /t 2 /nobreak >nul

echo [2/3] Starting Sync Server (Port 5000)...
start "Sync Server" cmd /k "cd /d %~dp0sync-server && npm start"
timeout /t 2 /nobreak >nul

echo [3/3] Launching Windows Desktop POS App...
start "Desktop POS" cmd /c "cd /d %~dp0desktop-app && start-desktop.bat"

echo.
echo ====================================================
echo  System Initialized!
echo  Desktop App is launching with Silent Printing active.
echo ====================================================
echo.
pause
