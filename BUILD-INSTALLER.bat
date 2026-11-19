@echo off
title Topi Vappa POS - Build Single .EXE Installer
cd /d "%~dp0"

echo ========================================================
echo  Building Single .EXE Installer with Auto-Update
echo  (Client PC needs ZERO software - Just 1 .exe file!)
echo ========================================================
echo.

:: 1. Build mobile captain web app
echo [1/3] Building Captain App mobile bundle...
call npm.cmd --prefix captain-app run build

:: 2. Build desktop POS web app
echo [2/3] Building Desktop POS bundle...
call npm.cmd --prefix desktop-app run build

:: 3. Package single .exe NSIS installer
echo [3/3] Creating Windows NSIS Installer...
call npm.cmd --prefix desktop-app run dist

echo.
echo ========================================================
echo  SUCCESS!
echo  Installer created in: desktop-app\release\
echo  File: Topi Vappa POS Setup 1.0.0.exe
echo.
echo  Send ONLY this single .exe file to the shop's computer!
echo  The shop double-clicks to install.
echo  Auto-updates will run silently in the background!
echo ========================================================
echo.
pause
