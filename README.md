# 🍽️ PetPooja Restaurant System

Complete restaurant management system with **automated dual-printer setup** and **waiter app**.

## 🎯 Features

### Main POS (Counter)
- ✅ Multi-item ordering with running tabs per table
- ✅ **Auto-print KOT** to kitchen printer
- ✅ **Auto-print Bills** to counter printer
- ✅ Offline-first PWA (works without internet)
- ✅ Table management with "Mark as Paid"
- ✅ Sequential order numbers
- ✅ Thermal printer optimized (72mm)
- ✅ Parcel/dine-in dual workflow

### Captain App (Waiter Tablets)
- ✅ Quick order entry on tablets
- ✅ Search menu items
- ✅ Send KOT directly to kitchen
- ✅ Print bills from anywhere
- ✅ Offline PWA (installable)
- ✅ Real-time print server status

### Print Server (Background PC)
- ✅ Auto-routes KOT → Kitchen printer
- ✅ Auto-routes BILL → Counter printer
- ✅ Supports USB and Network thermal printers
- ✅ WebSocket for real-time sync
- ✅ REST API for all devices

---

## 📁 Project Structure

```
Petpooja/
├── my-project/          # Main POS (counter staff)
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/PrintPage.jsx
│   │   ├── lib/printServer.js   # Auto-print API
│   │   └── data/items.js
│   └── public/manifest.webmanifest
│
├── print-server/        # Auto-print server (runs on PC)
│   ├── server.js        # Configure your printers here
│   └── package.json
│
├── captain-app/         # Waiter app (tablets)
│   ├── src/App.jsx
│   └── public/manifest.webmanifest
│
├── SETUP-GUIDE.md       # Complete setup instructions
└── START-ALL.bat        # One-click startup script
```

---

## 🚀 Quick Start

### 1. Install All Dependencies
```bash
# Print Server
cd print-server
npm install

# Main POS
cd ../my-project
npm install

# Captain App
cd ../captain-app
npm install
```

### 2. Configure Printers
Edit `print-server/server.js` lines 12-24:

**USB Printer:**
```javascript
interface: '\\\\.\\COM3'  // Windows (check Device Manager)
```

**Network Printer:**
```javascript
interface: 'tcp://192.168.1.100'  // Printer IP
```

### 3. Start Everything
**Windows:** Double-click `START-ALL.bat`

**Or manually:**
```bash
# Terminal 1
cd print-server
npm start

# Terminal 2
cd my-project
npm run dev

# Terminal 3
cd captain-app
npm run dev
```

### 4. Access Apps
- **Main POS:** http://localhost:5173
- **Captain App:** http://localhost:3001
- **Print Server API:** http://localhost:5001

---

## 🌐 LAN Access (Multi-Device)

### Find Your PC IP
```bash
# Windows
ipconfig

# Linux/Mac
ip addr show
```

### Access from Tablets/Other PCs
Replace `localhost` with your PC IP:
- Main POS: `http://192.168.1.100:5173`
- Captain App: `http://192.168.1.100:3001`

### Update Print Server URL
**Main POS:** Edit `my-project/src/lib/printServer.js`:
```javascript
const PRINT_SERVER_URL = 'http://192.168.1.100:5001'
```

**Captain App:** Edit `captain-app/src/App.jsx`:
```javascript
const PRINT_SERVER_URL = 'http://192.168.1.100:5001'
```

---

## 🖨️ Printer Setup

### Supported Printers
- Epson thermal printers (USB/Network)
- Star Micronics
- Generic ESC/POS printers

### USB Printer Setup (Windows)
1. Device Manager → Ports (COM & LPT)
2. Find your printer's COM port (e.g., COM3)
3. In `server.js`:
```javascript
interface: '\\\\.\\COM3'
```

### Network Printer Setup
1. Print test page to get printer IP
2. In `server.js`:
```javascript
interface: 'tcp://192.168.1.100'
```

### Test Print
```bash
curl -X POST http://localhost:5001/print \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"KOT\",\"data\":{\"orderNumber\":\"TEST\",\"table\":\"A1\",\"items\":[{\"name\":\"Test Item\",\"qty\":1}]}}"
```

---

## 📱 Install as PWA

### On Android/iOS Tablets (Captain App)
1. Open `http://PC_IP:3001` in Chrome/Safari
2. Tap menu → "Add to Home Screen"
3. App works offline!

### On Counter PC (Main POS)
1. Open in Chrome
2. Address bar → Install icon
3. Launches as standalone app

---

## 🔄 Workflow

### Dine-in Order
1. Counter staff selects table
2. Adds items
3. Clicks **"Save & KOT"** → Kitchen printer auto-prints
4. When customer ready, click **"Print Bill"** → Counter printer auto-prints
5. Click **"Mark as Paid"** to clear table

### Parcel Order
1. Select "Parcel" table
2. Add items
3. Clicks **"Save & Bill"** → Counter printer auto-prints immediately

### Waiter Taking Order
1. Waiter opens Captain App on tablet
2. Selects table
3. Adds items
4. Clicks **"Send KOT"** → Kitchen printer prints
5. When done, clicks **"Print Bill"** → Counter printer prints

---

## 🛠️ Troubleshooting

### Print Server Won't Start
```bash
# Check Node.js installed
node --version

# Reinstall dependencies
cd print-server
npm install
```

### Printers Not Printing
- ✅ Check printer USB/network connection
- ✅ Verify driver installed
- ✅ Test print from Windows
- ✅ Check `server.js` interface path matches

### Can't Access from Tablet
- ✅ PC and tablet on same WiFi
- ✅ Windows Firewall allows ports 5001, 5173, 3001
- ✅ Try `http://PC_IP:5001/status` in tablet browser

### Print Server Shows "Offline"
- ✅ Ensure `npm start` running in print-server folder
- ✅ Check URL in apps matches PC IP
- ✅ Firewall blocking port 5001

---

## 🏗️ Auto-start on PC Boot

### Windows
1. Right-click `START-ALL.bat` → Create Shortcut
2. Press `Win + R`, type `shell:startup`
3. Paste shortcut there

### Linux (systemd)
```bash
sudo nano /etc/systemd/system/petpooja.service
# Add service config
sudo systemctl enable petpooja
```

---

## 📊 System Requirements

- **PC:** Windows 10+, 8GB RAM, Node.js 18+
- **Tablets:** Android 8+ or iOS 12+ (for Captain App)
- **Printers:** 2× Thermal printers (3-inch/72mm) USB or Network
- **Network:** All devices on same WiFi/LAN

---

## 🔐 Production Tips

1. **Static IP for PC:** Prevent IP changes
2. **Build for Production:**
```bash
npm run build
serve -s dist
```
3. **Firewall Rules:** Allow ports permanently
4. **Backup:** Orders saved in IndexedDB (export regularly)

---

## 📞 Support

For detailed setup: See [SETUP-GUIDE.md](./SETUP-GUIDE.md)

---

## 🎉 You're All Set!

Your restaurant now has:
- ✅ **Automated printing** to 2 printers
- ✅ **Captain app** for waiters
- ✅ **Offline-capable** PWA
- ✅ **Running tabs** per table
- ✅ **Real-time sync** across devices

**Happy serving! 🍽️**
