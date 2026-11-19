import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const outDir = path.join(rootDir, 'release', 'Topi-Vappa-POS-Windows')
const appDir = path.join(outDir, 'resources', 'app')

console.log('========================================================')
console.log(' Packaging Standalone Windows POS (Zero Node.js Needed)')
console.log('========================================================')

// 1. Build frontend bundles
console.log('\n[1/5] Building Desktop POS bundle...')
execSync('npm.cmd --prefix desktop-app run build', { cwd: rootDir, stdio: 'inherit' })

console.log('\n[2/5] Building Captain App mobile bundle...')
execSync('npm.cmd --prefix captain-app run build', { cwd: rootDir, stdio: 'inherit' })

// 2. Prepare output directory
console.log('\n[3/5] Setting up standalone Windows directory...')
if (fs.existsSync(outDir)) {
  fs.rmSync(outDir, { recursive: true, force: true })
}
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(appDir, { recursive: true })

// 3. Copy Electron runtime binaries
console.log('\n[4/5] Copying embedded Electron & Node runtime...')
const electronDist = path.join(rootDir, 'desktop-app', 'node_modules', 'electron', 'dist')
if (!fs.existsSync(electronDist)) {
  console.error('Error: Electron binaries not found at', electronDist)
  process.exit(1)
}

// Copy everything from electron/dist into outDir
fs.cpSync(electronDist, outDir, { recursive: true })

// Rename electron.exe to 'Topi Vappa POS.exe'
const electronExe = path.join(outDir, 'electron.exe')
const brandedExe = path.join(outDir, 'Topi Vappa POS.exe')
if (fs.existsSync(electronExe)) {
  fs.renameSync(electronExe, brandedExe)
}

// 4. Copy app files into resources/app
console.log('\n[5/5] Bundling application source and Wi-Fi sync server...')

// Copy desktop-app package.json, dist, electron
fs.copyFileSync(path.join(rootDir, 'desktop-app', 'package.json'), path.join(appDir, 'package.json'))
fs.cpSync(path.join(rootDir, 'desktop-app', 'dist'), path.join(appDir, 'dist'), { recursive: true })
fs.cpSync(path.join(rootDir, 'desktop-app', 'electron'), path.join(appDir, 'electron'), { recursive: true })

// Copy sync-server (including its dependencies and vault)
const syncServerOut = path.join(appDir, 'sync-server')
fs.mkdirSync(syncServerOut, { recursive: true })
fs.copyFileSync(path.join(rootDir, 'sync-server', 'server.js'), path.join(syncServerOut, 'server.js'))
fs.copyFileSync(path.join(rootDir, 'sync-server', 'vault.js'), path.join(syncServerOut, 'vault.js'))
fs.copyFileSync(path.join(rootDir, 'sync-server', 'package.json'), path.join(syncServerOut, 'package.json'))
if (fs.existsSync(path.join(rootDir, 'sync-server', 'node_modules'))) {
  fs.cpSync(path.join(rootDir, 'sync-server', 'node_modules'), path.join(syncServerOut, 'node_modules'), { recursive: true })
}

// Copy captain-app dist
const captainDistOut = path.join(appDir, 'captain-app', 'dist')
fs.mkdirSync(path.dirname(captainDistOut), { recursive: true })
fs.cpSync(path.join(rootDir, 'captain-app', 'dist'), captainDistOut, { recursive: true })

// Create a convenient quick launcher batch in the folder
const quickLaunchBat = `@echo off
title Topi Vappa POS
cd /d "%~dp0"
start "" "Topi Vappa POS.exe"
exit
`
fs.writeFileSync(path.join(outDir, 'Launch POS.bat'), quickLaunchBat, 'utf-8')

// Copy UPDATE-APP.bat so the client can update with 1-click directly from GitHub
fs.copyFileSync(path.join(rootDir, 'UPDATE-APP.bat'), path.join(outDir, 'UPDATE-APP.bat'))

// Create a Readme inside the folder for the client
const readmeTxt = `===========================================================
Topi Vappa Restaurant POS - Standalone Windows Edition
===========================================================

ZERO INSTALLATION NEEDED:
- Node.js is NOT required.
- Git is NOT required.
- No setup or commands needed.

HOW TO RUN:
Double-click: Topi Vappa POS.exe (or Launch POS.bat)

HOW TO UPDATE DIRECTLY FROM GITHUB:
Double-click: UPDATE-APP.bat
(It automatically pulls all latest fixes and updates from the internet in 5 seconds.
Your local customer orders, bills, and secret owner vault are 100% preserved and never overwritten!)

FEATURES:
1. Counter POS: Silent direct thermal printing (no browser prompts).
2. Waiter Mobile App: Phones on same Wi-Fi can open:
   http://<YOUR_PC_IP>:5000
3. Owner Audit Vault: Press Ctrl + Alt + O anytime inside the app.
===========================================================
`
fs.writeFileSync(path.join(outDir, 'README.txt'), readmeTxt, 'utf-8')

console.log('\n========================================================')
console.log(' ✓ SUCCESS: Standalone Windows App Packaged!')
console.log(' Folder Location: release/Topi-Vappa-POS-Windows')
console.log(' To use on any other PC:')
console.log(' Just copy the "Topi-Vappa-POS-Windows" folder (or zip it) to the other PC.')
console.log(' The other PC DOES NOT NEED Node.js or Git!')
console.log(' They simply double-click "Topi Vappa POS.exe"!')
console.log('========================================================\n')
