const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  getLocalIP: () => ipcRenderer.invoke('get-local-ip'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printSilent: (options) => ipcRenderer.invoke('print-silent', options),
  printReceipt: (data) => ipcRenderer.invoke('print-receipt', data),
});
