@echo off
title Topi Vappa POS - 1-Click Online Updater
cd /d "%~dp0"

echo ========================================================
echo   Topi Vappa POS - Direct Online Updater
echo ========================================================
echo.
echo Checking for updates from GitHub...
echo (No Node.js or Git required!)
echo.

:: 1. If Git is present, try git pull first
where git >nul 2>&1
if %ERRORLEVEL% equ 0 (
  if exist ".git\" (
    echo [1/2] Updating via Git repository...
    git pull origin main
    echo.
    echo [2/2] Update complete! Running latest version.
    if exist "Topi Vappa POS.exe" (
      start "" "Topi Vappa POS.exe"
    )
    exit /b 0
  )
)

:: 2. Standalone update using Windows PowerShell (built into every Windows PC)
echo [1/2] Downloading latest pre-compiled files from GitHub...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference = 'Stop';" ^
  "$tempZip = Join-Path $env:TEMP 'tv-pos-update.zip';" ^
  "$tempDir = Join-Path $env:TEMP 'tv-pos-extract';" ^
  "if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir };" ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;" ^
  "Invoke-WebRequest -Uri 'https://github.com/ilanchezhian-m/pos-upgraded-version/archive/refs/heads/main.zip' -OutFile $tempZip -UseBasicParsing;" ^
  "Write-Host 'Extracting update archive...';" ^
  "Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force;" ^
  "$extracted = Join-Path $tempDir 'pos-upgraded-version-main';" ^
  "$app = Join-Path (Get-Location) 'resources\app';" ^
  "if (Test-Path $app) {" ^
  "  Copy-Item -Path (Join-Path $extracted 'desktop-app\dist\*') -Destination (Join-Path $app 'dist') -Recurse -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'captain-app\dist\*') -Destination (Join-Path $app 'captain-app\dist') -Recurse -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'sync-server\server.js') -Destination (Join-Path $app 'sync-server\server.js') -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'sync-server\vault.js') -Destination (Join-Path $app 'sync-server\vault.js') -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'desktop-app\electron\*') -Destination (Join-Path $app 'electron') -Recurse -Force;" ^
  "  Write-Host 'App files updated successfully!';" ^
  "} else {" ^
  "  Copy-Item -Path (Join-Path $extracted 'desktop-app\dist\*') -Destination 'desktop-app\dist' -Recurse -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'captain-app\dist\*') -Destination 'captain-app\dist' -Recurse -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'sync-server\server.js') -Destination 'sync-server\server.js' -Force;" ^
  "  Copy-Item -Path (Join-Path $extracted 'sync-server\vault.js') -Destination 'sync-server\vault.js' -Force;" ^
  "};" ^
  "Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue;" ^
  "Remove-Item -Force $tempZip -ErrorAction SilentlyContinue;"

if %ERRORLEVEL% equ 0 (
  echo.
  echo ========================================================
  echo  [2/2] Update Complete! All fixes are now live!
  echo ========================================================
  echo.
  if exist "Topi Vappa POS.exe" (
    echo Starting Topi Vappa POS...
    start "" "Topi Vappa POS.exe"
  )
) else (
  echo.
  echo [ERROR] Update failed. Please check your internet connection and try again.
  pause
)
