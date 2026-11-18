@echo off
title Topi Vappa POS - Desktop Startup
cd /d "%~dp0"

echo ====================================================
echo  Topi Vappa Complete POS System (Desktop Edition)
echo  100%% Local Wi-Fi Synchronization (Zero Cloud)
echo ====================================================
echo.

if not exist "sync-server\node_modules\" (
  echo [Info] Installing Sync Server dependencies...
  call cmd /c "cd sync-server && npm install"
)

if not exist "print-server\node_modules\" (
  echo [Info] Installing Print Server dependencies...
  call cmd /c "cd print-server && npm install"
)

if not exist "captain-app\dist\index.html" (
  echo [Info] Building Captain App static web bundle...
  call cmd /c "cd captain-app && npm run build"
)

echo [1/3] Starting Print Server (Port 5001)...
start "Print Server" cmd /k "cd /d %~dp0print-server && npm start"
timeout /t 2 /nobreak >nul

echo [2/3] Starting Local Sync Server (Port 5000)...
start "Sync Server" cmd /k "cd /d %~dp0sync-server && npm start"
timeout /t 2 /nobreak >nul

echo [3/3] Launching Windows Desktop POS App...
start "Desktop POS" cmd /c "cd /d %~dp0desktop-app && start-desktop.bat"

echo.
echo ====================================================
echo  System Initialized!
echo.
echo  - Desktop POS: Active with Silent Direct Thermal Printing
echo  - Local Sync:  Port 5000 (No cloud required)
echo  - Captain App: Phones on same Wi-Fi can open:
echo                 http://localhost:5000 (or PC IP on phone)
echo ====================================================
echo.
pause
