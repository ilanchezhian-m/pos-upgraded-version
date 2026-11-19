@echo off
title Topi Vappa POS - Publish Update to GitHub Releases
cd /d "%~dp0"

echo ========================================================
echo  Topi Vappa POS - 1-Click Update Publisher
echo ========================================================
echo.
echo This command compiles the new version and uploads the
echo update (.exe and latest.yml) to GitHub Releases.
echo.
echo Make sure you have:
echo 1. Bumped the version in desktop-app\package.json (e.g. 1.0.1)
echo 2. A GitHub Personal Access Token (with repo / release permissions)
echo.

if "%GH_TOKEN%"=="" (
  set /p GH_TOKEN="Enter your GitHub Personal Access Token: "
)

echo.
echo [1/3] Building Captain App mobile bundle...
call npm.cmd --prefix captain-app run build

echo [2/3] Building Desktop POS bundle...
call npm.cmd --prefix desktop-app run build

echo [3/3] Packaging and publishing release to GitHub...
call npm.cmd --prefix desktop-app run publish

echo.
echo ========================================================
echo  Update Process Finished!
echo  Client PCs running the installed POS will automatically
echo  detect and download the new version in the background.
echo ========================================================
echo.
pause
