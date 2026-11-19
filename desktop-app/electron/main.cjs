const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let isUpdating = false;
let syncProcess = null;

function getAppRoot() {
  const candidates = [
    path.join(__dirname, '../..'),
    path.join(__dirname, '..'),
    path.dirname(process.execPath),
    process.cwd(),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'sync-server', 'server.js'))) {
      return c;
    }
  }
  return path.join(__dirname, '../..');
}

function ensureSyncServerRunning() {
  const req = http.get('http://127.0.0.1:5000/api/orders', (res) => {
    console.log('[Sync-Server] Local Wi-Fi sync server is already active on port 5000.');
  });

  req.on('error', () => {
    console.log('[Sync-Server] Port 5000 inactive. Starting embedded sync server...');
    const projectRoot = getAppRoot();
    const serverScript = path.join(projectRoot, 'sync-server', 'server.js');
    if (fs.existsSync(serverScript)) {
      try {
        // Use Electron's built-in Node runner - works on any PC with ZERO Node.js install needed!
        const nodeRunner = process.execPath;
        const env = { ...process.env, ELECTRON_RUN_AS_NODE: '1' };
        syncProcess = spawn(nodeRunner, [serverScript], {
          cwd: path.join(projectRoot, 'sync-server'),
          windowsHide: true,
          stdio: 'ignore',
          env: env,
        });
        syncProcess.on('error', (err) => {
          console.error('[Sync-Server] Error launching sync server:', err);
        });
        console.log('[Sync-Server] Embedded Wi-Fi sync server launched successfully via internal engine.');
      } catch (e) {
        console.error('[Sync-Server] Exception launching sync server:', e);
      }
    }
  });
}

function checkForUpdates(manual = false) {
  if (isUpdating) return;
  const projectRoot = getAppRoot();

  // If Git repository is NOT found (Standalone distribution mode)
  if (!fs.existsSync(path.join(projectRoot, '.git'))) {
    if (manual) {
      updateStandaloneApp(projectRoot, manual);
    }
    return;
  }

  // Fetch latest commits from GitHub
  exec('git fetch origin main', { cwd: projectRoot }, (fetchErr) => {
    if (fetchErr) {
      if (manual && mainWindow && !mainWindow.isDestroyed()) {
        const { dialog } = require('electron');
        dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Update Check Failed',
          message: 'Could not connect to GitHub. Please check your internet connection.',
        });
      }
      return;
    }

    exec('git rev-parse HEAD', { cwd: projectRoot }, (err1, localSha) => {
      if (err1 || !localSha) return;

      exec('git rev-parse origin/main', { cwd: projectRoot }, (err2, remoteSha) => {
        if (err2 || !remoteSha) return;

        const local = localSha.trim();
        const remote = remoteSha.trim();

        if (local !== remote) {
          console.log('[Auto-Updater] New commit detected on GitHub:', remote);
          isUpdating = true;

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-status', { status: 'updating', commit: remote.slice(0, 7) });
          }

          // Pull pre-compiled changes (dist is tracked in git - ZERO Node.js required!)
          exec('git pull origin main', { cwd: projectRoot }, (buildErr) => {
            isUpdating = false;
            if (!buildErr) {
              console.log('[Auto-Updater] App updated successfully! Reloading...');
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-status', { status: 'updated', commit: remote.slice(0, 7) });
                // Silently reload window to activate new build immediately
                setTimeout(() => {
                  if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.reload();
                  }
                }, 1500);
              }
            } else {
              console.error('[Auto-Updater] Git pull failed:', buildErr);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('update-status', { status: 'failed' });
              }
            }
          });
        } else {
          console.log('[Auto-Updater] App is up to date.');
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('update-status', { status: 'latest', commit: local.slice(0, 7) });
            if (manual) {
              const { dialog } = require('electron');
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Topi Vappa POS',
                message: `Your app is already up to date!\n\nCurrent Version: ${local.slice(0, 7)}`,
              });
            }
          }
        }
      });
    });
  });
}

function updateStandaloneApp(projectRoot, manual) {
  isUpdating = true;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status: 'updating' });
  }

  const psScript = `
    $ErrorActionPreference = 'Stop'
    $tempZip = Join-Path $env:TEMP 'tv-pos-update.zip'
    $tempDir = Join-Path $env:TEMP 'tv-pos-extract'
    if (Test-Path $tempDir) { Remove-Item -Recurse -Force $tempDir }
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri 'https://github.com/ilanchezhian-m/pos-upgraded-version/archive/refs/heads/main.zip' -OutFile $tempZip -UseBasicParsing
    Expand-Archive -Path $tempZip -DestinationPath $tempDir -Force
    $extracted = Join-Path $tempDir 'pos-upgraded-version-main'
    $app = '${projectRoot.replace(/\\/g, '\\\\')}'
    
    Copy-Item -Path (Join-Path $extracted 'desktop-app\\dist\\*') -Destination (Join-Path $app 'dist') -Recurse -Force
    Copy-Item -Path (Join-Path $extracted 'captain-app\\dist\\*') -Destination (Join-Path $app 'captain-app\\dist') -Recurse -Force
    Copy-Item -Path (Join-Path $extracted 'sync-server\\server.js') -Destination (Join-Path $app 'sync-server\\server.js') -Force
    Copy-Item -Path (Join-Path $extracted 'sync-server\\vault.js') -Destination (Join-Path $app 'sync-server\\vault.js') -Force
    Copy-Item -Path (Join-Path $extracted 'desktop-app\\electron\\*') -Destination (Join-Path $app 'electron') -Recurse -Force
    
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
    Remove-Item -Force $tempZip -ErrorAction SilentlyContinue
  `;

  exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, (err) => {
    isUpdating = false;
    if (!err) {
      console.log('[Auto-Updater] Standalone POS updated successfully! Reloading...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', { status: 'updated' });
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reload();
          }
        }, 1200);
      }
    } else {
      console.error('[Auto-Updater] Standalone update error:', err);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', { status: 'failed' });
        if (manual) {
          const { dialog } = require('electron');
          dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Update Check Failed',
            message: 'Could not download updates. Please verify internet connection and try again.',
          });
        }
      }
    }
  });
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Topi Vappa POS - Desktop Edition',
    icon: path.join(__dirname, '../public/favicon.svg'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  // Check if running in dev mode
  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    mainWindow.loadURL(devUrl);
    // mainWindow.webContents.openDevTools();
  } else {
    // Production: load dist/index.html
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    } else {
      // Fallback to dev server if dist not yet built
      mainWindow.loadURL('http://localhost:5173');
    }
  }

  // Hook window.print() to optionally execute silently
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.setTitle('Topi Vappa POS - Desktop Edition');
  });

  // Self-heal on any load failure
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn('Page failed to load:', errorCode, errorDescription);
    const indexPath = path.join(__dirname, '../dist/index.html');
    if (fs.existsSync(indexPath)) {
      mainWindow.loadFile(indexPath);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  setupMenu();

  // Background Auto-Update: Check 10s after startup, then every 5 minutes silently
  setTimeout(() => checkForUpdates(false), 10000);
  setInterval(() => checkForUpdates(false), 5 * 60 * 1000);
}

function setupMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Check for Updates from GitHub',
          accelerator: 'CmdOrCtrl+U',
          click: () => checkForUpdates(true),
        },
        {
          label: 'Reload App',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) {
              const indexPath = path.join(__dirname, '../dist/index.html');
              const curUrl = mainWindow.webContents.getURL() || '';
              if (curUrl.startsWith('file:') && !curUrl.includes('index.html')) {
                mainWindow.loadFile(indexPath);
              } else {
                mainWindow.webContents.reload();
              }
            }
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow && mainWindow.webContents.toggleDevTools(),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Printers',
      submenu: [
        {
          label: 'List Installed Printers',
          click: async () => {
            if (mainWindow) {
              const printers = await mainWindow.webContents.getPrintersAsync();
              const printerList = printers.map(p => `${p.name} (${p.isDefault ? 'Default' : 'Active'})`).join('\n');
              const { dialog } = require('electron');
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Installed Windows Printers',
                message: `Found ${printers.length} printer(s):\n\n${printerList}`,
              });
            }
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Topi Vappa POS',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About',
              message: 'Topi Vappa POS Desktop Edition v1.0.0\nSupports Silent Direct Thermal Printing for Windows.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// =========================================================
// Silent Printing IPC Handlers
// =========================================================

// 0. Auto-Update from GitHub
ipcMain.handle('check-for-updates', async () => {
  checkForUpdates(true);
  return { status: 'checking' };
});

// 0.1. Get Host Wi-Fi IP address
ipcMain.handle('get-local-ip', async () => {
  return getLocalIP();
});

// 1. Get all installed Windows printers
ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  try {
    const printers = await mainWindow.webContents.getPrintersAsync();
    return printers.map(p => ({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      isDefault: p.isDefault,
      status: p.status,
    }));
  } catch (error) {
    console.error('Failed to get printers:', error);
    return [];
  }
});

// 2. Direct Silent Print of Current Active Window
ipcMain.handle('print-silent', async (event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };

  return new Promise((resolve) => {
    const printOptions = {
      silent: true,
      printBackground: true,
      deviceName: options.deviceName || '',
      color: false,
      margins: {
        marginType: 'none',
      },
      ...options,
    };

    mainWindow.webContents.print(printOptions, (success, errorType) => {
      if (!success) {
        console.error('Print failed:', errorType);
        resolve({ success: false, error: errorType });
      } else {
        console.log('Silent print completed successfully.');
        resolve({ success: true });
      }
    });
  });
});

// 3. Silent Print of Thermal Receipt HTML via Background Worker Window
// This prints clean 80mm/58mm thermal receipts without disturbing the cashier screen!
ipcMain.handle('print-receipt', async (event, { html, deviceName = '', widthMm = 80 }) => {
  return new Promise((resolve) => {
    let worker = new BrowserWindow({
      show: false,
      width: 380,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const receiptHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            margin: 0;
            size: ${widthMm}mm auto;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Courier New', Courier, monospace, sans-serif;
            font-size: 12px;
            font-weight: 500;
            line-height: 1.25;
            width: ${widthMm === 58 ? '48mm' : '72mm'};
            margin: 0 auto;
            padding: 4px;
            color: #000;
            background: #fff;
          }
          .center { text-align: center; }
          .right { text-align: right; }
          .bold { font-weight: bold; }
          .divider {
            border-bottom: 1px dashed #000;
            margin: 5px 0;
          }
          table { width: 100%; border-collapse: collapse; }
          td, th { padding: 2px 0; font-size: 11px; }
          img { max-width: 100%; height: auto; }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;

    worker.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(receiptHtml)}`);

    worker.webContents.on('did-finish-load', () => {
      setTimeout(() => {
        worker.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: deviceName || '',
            margins: { marginType: 'none' },
          },
          (success, errorType) => {
            if (worker) {
              worker.close();
              worker = null;
            }
            if (!success) {
              console.error('Receipt print failed:', errorType);
              resolve({ success: false, error: errorType });
            } else {
              console.log('Receipt printed silently to:', deviceName || 'Default printer');
              resolve({ success: true });
            }
          }
        );
      }, 300);
    });

    worker.webContents.on('did-fail-load', () => {
      if (worker) {
        worker.close();
        worker = null;
      }
      resolve({ success: false, error: 'Failed to load receipt template' });
    });
  });
});

// App Lifecycle
app.whenReady().then(() => {
  ensureSyncServerRunning();
  createWindow();
});

app.on('before-quit', () => {
  if (syncProcess) {
    try {
      syncProcess.kill();
    } catch (e) {}
    syncProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
