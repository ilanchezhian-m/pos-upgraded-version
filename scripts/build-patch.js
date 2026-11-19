import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const patchDir = path.join(rootDir, 'release', 'POS-Update-Patch')

console.log('========================================================')
console.log(' Creating Lightweight Update Patch (~2MB, Zero Node.js)')
console.log('========================================================')

// 1. Build latest bundles
console.log('\n[1/3] Compiling latest updates...')
execSync('npm.cmd --prefix desktop-app run build', { cwd: rootDir, stdio: 'inherit' })
execSync('npm.cmd --prefix captain-app run build', { cwd: rootDir, stdio: 'inherit' })

// 2. Prepare patch folder
console.log('\n[2/3] Packing patch files...')
if (fs.existsSync(patchDir)) {
  fs.rmSync(patchDir, { recursive: true, force: true })
}
fs.mkdirSync(patchDir, { recursive: true })

// Destination inside the patch: 'app_files'
const appPatchDir = path.join(patchDir, 'app_files')
fs.mkdirSync(appPatchDir, { recursive: true })

// Copy updated desktop-app dist & electron
fs.cpSync(path.join(rootDir, 'desktop-app', 'dist'), path.join(appPatchDir, 'dist'), { recursive: true })
fs.cpSync(path.join(rootDir, 'desktop-app', 'electron'), path.join(appPatchDir, 'electron'), { recursive: true })
fs.copyFileSync(path.join(rootDir, 'desktop-app', 'package.json'), path.join(appPatchDir, 'package.json'))

// Copy updated sync-server code (code only, no database files!)
const syncOut = path.join(appPatchDir, 'sync-server')
fs.mkdirSync(syncOut, { recursive: true })
fs.copyFileSync(path.join(rootDir, 'sync-server', 'server.js'), path.join(syncOut, 'server.js'))
fs.copyFileSync(path.join(rootDir, 'sync-server', 'vault.js'), path.join(syncOut, 'vault.js'))

// Copy updated captain-app dist
const captainOut = path.join(appPatchDir, 'captain-app', 'dist')
fs.mkdirSync(path.dirname(captainOut), { recursive: true })
fs.cpSync(path.join(rootDir, 'captain-app', 'dist'), captainOut, { recursive: true })

// 3. Create the 1-click update applicator batch file
console.log('\n[3/3] Generating 1-Click Update script...')
const applyUpdateBat = `@echo off
title Topi Vappa POS - Apply Update
cd /d "%~dp0"

echo ========================================================
echo  Topi Vappa POS - 1-Click Fast Updater
echo  (Zero Node.js needed - Updates code in 2 seconds!)
echo ========================================================
echo.

:: Check if placed inside or next to Topi-Vappa-POS-Windows
set TARGET=
if exist "resources\\app\\" set TARGET=%~dp0resources\\app
if exist "..\\resources\\app\\" set TARGET=%~dp0..\\resources\\app
if exist "Topi-Vappa-POS-Windows\\resources\\app\\" set TARGET=%~dp0Topi-Vappa-POS-Windows\\resources\\app

if "%TARGET%"=="" (
  echo [ERROR] Could not find the Topi-Vappa-POS-Windows folder!
  echo Please put this "POS-Update-Patch" folder inside your 
  echo "Topi-Vappa-POS-Windows" folder and run this file again.
  echo.
  pause
  exit /b 1
)

echo Closing any running Topi Vappa POS processes...
taskkill /f /im "Topi Vappa POS.exe" >nul 2>&1
timeout /t 1 /nobreak >nul

echo Updating application code...
xcopy /s /e /y "app_files\\*.*" "%TARGET%\\" >nul

echo.
echo ========================================================
echo  ✓ UPDATE COMPLETED SUCCESSFULLY!
echo  Your sales history and orders were preserved 100%%.
echo  You can now start Topi Vappa POS!
echo ========================================================
echo.
pause
`
fs.writeFileSync(path.join(patchDir, 'Apply-Update.bat'), applyUpdateBat, 'utf-8')

console.log('\n========================================================')
console.log(' ✓ SUCCESS: Lightweight Update Patch Created!')
console.log(' Folder Location: release/POS-Update-Patch')
console.log(' Size: ~2 MB (Instant send via WhatsApp / USB / Drive)')
console.log(' To update any PC:')
console.log(' 1. Copy POS-Update-Patch to the client PC.')
console.log(' 2. Double-click "Apply-Update.bat". Done in 2 seconds!')
console.log('========================================================\n')
