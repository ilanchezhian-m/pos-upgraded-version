# 🖨️ Auto-Print Setup Guide

Complete system with **Main POS**, **Print Server**, and **Captain App**.

---

## System Architecture

```
┌─────────────────┐         ┌──────────────────┐
│   Main POS      │────────▶│  Print Server    │
│   (Counter PC)  │         │  (Background PC) │
└─────────────────┘         └──────────────────┘
                                   │
                            ┌──────┴───────┐
                            ▼              ▼
                     Kitchen Printer   Counter Printer
                        (Thermal)       (Thermal)

┌─────────────────┐
│  Captain App    │────────▶ Print Server
│  (Waiter Tablet)│
└─────────────────┘
```

---

## Step 1: Setup Print Server (PC)

### Install Node.js
Download from https://nodejs.org (LTS version)

### Setup Print Server
```bash
cd D:\Petpooja\print-server
npm install
```

### Configure Printers
Edit `server.js` lines 12-24:

**For USB Printers:**
```javascript
// Windows
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM3', // Check Device Manager → Ports
  characterSet: 'PC437_USA',
  width: 48,
});
```

**For Network Printers:**
```javascript
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100', // Printer IP
  characterSet: 'PC437_USA',
  width: 48,
});
```

### Start Print Server
```bash
npm start
```

Server runs on `http://localhost:5001`

### Auto-start on Boot (Windows)
1. Create `start-server.bat` shortcut
2. Press `Win + R`, type `shell:startup`
3. Paste shortcut there

---

## Step 2: Setup Main POS

### Install Dependencies
```bash
cd D:\Petpooja\my-project
npm install
```

### Configure Print Server IP
Edit `src/lib/printServer.js` line 2:
```javascript
const PRINT_SERVER_URL = 'http://192.168.1.100:5001'; // Your PC IP
```

### Start Main POS
```bash
npm run dev
```

Access at `http://localhost:5173`

For LAN access (from other devices):
```
http://YOUR_PC_IP:5173
```

---

## Step 3: Setup Captain App (Waiter Tablets)

### Install Dependencies
```bash
cd D:\Petpooja\captain-app
npm install
```

### Configure Print Server
Edit `src/App.jsx` line 13:
```javascript
const PRINT_SERVER_URL = 'http://192.168.1.100:5001'; // PC IP
```

### Start Captain App
```bash
npm run dev
```

Access from tablet: `http://PC_IP:3001`

### Install as PWA on Tablet
1. Open in Chrome/Safari
2. Click "Add to Home Screen"
3. App works offline!

---

## Step 4: Find Your PC IP Address

### Windows
```bash
ipconfig
# Look for "IPv4 Address" like 192.168.1.100
```

### Ensure Firewall Allows Ports
```bash
# Windows Firewall: Allow ports 5001, 5173, 3001
```

---

## How It Works

### Main POS Workflow
1. Counter staff creates order
2. Clicks "Save & KOT" → Auto-prints to **kitchen printer**
3. Clicks "Print Bill" → Auto-prints to **counter printer**
4. If print server offline → Falls back to Print Center view

### Captain App Workflow
1. Waiter selects their name
2. Selects table number
3. Adds items to cart
4. Clicks "Send KOT" → Prints to **kitchen**
5. Clicks "Print Bill" → Prints to **counter**

---

## Printer Configuration Guide

### Find USB Printer
**Windows:**
1. Device Manager → Ports (COM & LPT)
2. Look for USB Serial Port (COM3, COM4, etc.)
3. Use: `interface: '\\\\.\\COM3'`

**Linux:**
```bash
ls /dev/usb/lp*
# or
lsusb
# Use: interface: '/dev/usb/lp0'
```

### Network Printer Setup
1. Printer settings → Print test page
2. Note IP address (e.g., 192.168.1.100)
3. Use: `interface: 'tcp://192.168.1.100'`

---

## Testing

### Test Print Server
```bash
curl -X POST http://localhost:5001/print \
  -H "Content-Type: application/json" \
  -d '{"type":"KOT","data":{"orderNumber":"TEST","table":"A1","items":[{"name":"Test Item","qty":1}]}}'
```

### Test from Main POS
1. Create an order
2. Check browser console for "KOT auto-printed to kitchen"
3. Physical printer should print

---

## Troubleshooting

### Print Server Won't Start
- Check Node.js installed: `node --version`
- Run `npm install` again
- Check port 5001 not in use: `netstat -ano | findstr :5001`

### Printers Not Printing
- Verify printer connection (USB/Network)
- Check printer driver installed
- Try test print from Windows
- Verify interface path in `server.js`

### Can't Access from Tablet
- Check PC and tablet on same WiFi network
- Verify PC IP: `ipconfig`
- Check Windows Firewall allows ports
- Try accessing `http://PC_IP:5001/status` from tablet browser

### Print Server Shows "Offline"
- Ensure print server running: `npm start` in print-server folder
- Check firewall blocking port 5001
- Verify URL in main POS and captain app

---

## Production Deployment

### Build Apps
```bash
# Main POS
cd my-project
npm run build

# Captain App
cd captain-app
npm run build
```

### Serve with Static Server
```bash
npm install -g serve
serve -s dist -l 5173
```

### Or use IIS/Apache/Nginx
Point to `dist` folder for each app.

---

## Quick Start Commands

```bash
# Terminal 1: Print Server
cd D:\Petpooja\print-server
npm start

# Terminal 2: Main POS
cd D:\Petpooja\my-project
npm run dev

# Terminal 3: Captain App
cd D:\Petpooja\captain-app
npm run dev
```

Now you have:
- Main POS: http://localhost:5173
- Captain App: http://localhost:3001
- Print Server: http://localhost:5001

Access from any device: Replace `localhost` with your PC IP!
