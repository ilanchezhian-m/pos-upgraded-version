# 🎯 Quick Reference Card

## 📍 Access URLs

| Application | Local | LAN (Other Devices) |
|------------|-------|---------------------|
| Main POS | http://localhost:5173 | http://YOUR_PC_IP:5173 |
| Captain App | http://localhost:3001 | http://YOUR_PC_IP:3001 |
| Print Server | http://localhost:5001 | http://YOUR_PC_IP:5001 |

**Find PC IP:** `ipconfig` (Windows) or `ip addr` (Linux)

---

## 🖨️ Printer Configuration Quick Guide

### Edit File: `print-server/server.js`

**USB Printer (Windows):**
```javascript
interface: '\\\\.\\COM3'  // Check Device Manager → Ports
```

**USB Printer (Linux):**
```javascript
interface: '/dev/usb/lp0'  // Run: ls /dev/usb/lp*
```

**Network Printer:**
```javascript
interface: 'tcp://192.168.1.100'  // Printer's IP address
```

---

## ⚙️ Configuration Files to Update

### 1. Print Server URLs

**File:** `my-project/src/lib/printServer.js` (Line 2)
```javascript
const PRINT_SERVER_URL = 'http://YOUR_PC_IP:5001'
```

**File:** `captain-app/src/App.jsx` (Line 13)
```javascript
const PRINT_SERVER_URL = 'http://YOUR_PC_IP:5001'
```

---

## 🚀 Startup Commands

### Option 1: One-Click (Windows)
```
Double-click: START-ALL.bat
```

### Option 2: Manual
```bash
# Terminal 1: Print Server
cd print-server
npm start

# Terminal 2: Main POS  
cd my-project
npm run dev

# Terminal 3: Captain App
cd captain-app
npm run dev
```

---

## 📱 Install PWA on Devices

### Captain App on Tablets
1. Open: `http://PC_IP:3001`
2. Chrome: Menu → "Add to Home Screen"
3. Safari (iOS): Share → "Add to Home Screen"

### Main POS on Counter PC
1. Open in Chrome
2. Address bar → Install icon (⊕)
3. Click "Install"

---

## 🔄 Order Workflow

### Dine-in (Counter Staff)
```
1. Select Table → Add Items → "Save & KOT" (Kitchen prints)
2. Add more items → "Save & KOT" (Kitchen prints again)
3. Customer done → "Print Bill" (Counter prints)
4. Payment received → "Mark as Paid"
```

### Parcel (Counter Staff)
```
1. Select "Parcel" → Add Items → "Save & Bill" (Counter prints immediately)
```

### Waiter (Captain App)
```
1. Select Waiter Name → Select Table → Add Items
2. "Send KOT" (Kitchen prints)
3. When done: "Print Bill" (Counter prints)
```

---

## 🛠️ Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Print server offline | 1. Run `npm start` in print-server folder<br>2. Check firewall allows port 5001<br>3. Verify PC IP in config files |
| Printer not printing | 1. Check USB/network cable<br>2. Test print from Windows<br>3. Verify interface path in server.js |
| Can't access from tablet | 1. Same WiFi network?<br>2. Firewall allows ports?<br>3. Try: `http://PC_IP:5001/status` |
| Port already in use | 1. Close other apps using port<br>2. Or change port in config |

---

## 📋 Port Usage

- **5001** - Print Server API
- **5173** - Main POS
- **3001** - Captain App

**Firewall:** Allow all 3 ports for LAN access

---

## 🧪 Test Print Server

```bash
curl -X POST http://localhost:5001/print \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"KOT\",\"data\":{\"orderNumber\":\"1001\",\"table\":\"A1\",\"customer\":\"Test\",\"items\":[{\"name\":\"Chicken Biryani\",\"qty\":2}]}}"
```

**Expected:** Kitchen printer should print a KOT

---

## 🎨 Printer Types Supported

- ✅ Epson TM-series
- ✅ Star Micronics
- ✅ Generic ESC/POS
- ✅ USB thermal printers
- ✅ Network/WiFi thermal printers

**Paper Width:** 72mm (3 inch)

---

## 💾 Data Storage

- **Orders/Bills:** IndexedDB (browser storage)
- **Order Numbers:** LocalStorage counter
- **Menu Items:** `my-project/src/data/items.js`

**Backup Tip:** Export IndexedDB regularly (F12 → Application → IndexedDB)

---

## 🔐 Auto-start on Boot

### Windows
1. Create shortcut of `START-ALL.bat`
2. Press `Win + R`, type: `shell:startup`
3. Paste shortcut

### Linux
```bash
chmod +x start-all.sh
# Add to crontab: @reboot /path/to/start-all.sh
```

---

## 📞 Emergency Fallback

**If Print Server is down:**
- Main POS automatically shows "Print Center" view
- Manually print from browser (Ctrl+P)
- All orders saved in IndexedDB

**If Internet is down:**
- PWA works completely offline
- Orders saved locally
- Prints still work via LAN

---

## ✅ First-Time Setup Checklist

- [ ] Node.js installed
- [ ] All npm packages installed (`npm install` in each folder)
- [ ] Printers connected (USB or network)
- [ ] Printer paths configured in `server.js`
- [ ] PC IP updated in `printServer.js` and captain `App.jsx`
- [ ] Firewall allows ports 5001, 5173, 3001
- [ ] All apps running (`START-ALL.bat` or manual)
- [ ] Test print successful
- [ ] Captain app installed on tablet
- [ ] PC set to auto-start print server on boot

---

**Ready to serve! 🎉**
