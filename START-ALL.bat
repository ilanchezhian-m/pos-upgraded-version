@echo off
echo ================================
echo PetPooja Complete System Startup
echo ================================
echo.

echo [1/3] Starting Print Server...
start "Print Server" cmd /k "cd /d %~dp0print-server && npm start"
timeout /t 3 /nobreak >nul

echo [2/3] Starting Main POS...
start "Main POS" cmd /k "cd /d %~dp0my-project && npm run dev"
timeout /t 3 /nobreak >nul

echo [3/3] Starting Captain App...
start "Captain App" cmd /k "cd /d %~dp0captain-app && npm run dev"

echo.
echo ================================
echo All systems started!
echo ================================
echo.
echo Main POS:      http://localhost:5173
echo Captain App:   http://localhost:3001
echo Print Server:  http://localhost:5001
echo.
echo Find your PC IP with: ipconfig
echo Access from other devices: http://YOUR_PC_IP:PORT
echo.
pause
