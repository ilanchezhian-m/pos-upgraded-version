@echo off
title Topi Vappa POS - Package Standalone App for Client
cd /d "%~dp0"

echo ========================================================
echo  Topi Vappa POS - Client Packaging Center
echo ========================================================
echo.
echo Choose how you want to package the app for the client:
echo.
echo [1] Single .EXE Installer (Recommended)
echo     - Produces: desktop-app\release\Topi Vappa POS Setup 1.0.0.exe
echo     - Client double-clicks to install (like any Windows app).
echo     - Automatic silent updates via electron-updater!
echo     - Stores orders & bills in AppData (immune to updates).
echo.
echo [2] Standalone Portable Folder
echo     - Produces: release\Topi-Vappa-POS-Windows\
echo     - No installation required; run directly from folder.
echo.
set /p CHOICE="Enter choice (1 or 2, default is 1): "
if "%CHOICE%"=="2" goto PORTABLE

:INSTALLER
call "%~dp0BUILD-INSTALLER.bat"
goto END

:PORTABLE
echo.
echo Creating standalone portable folder...
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

:END

