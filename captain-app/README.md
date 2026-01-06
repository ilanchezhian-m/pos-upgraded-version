# Captain App - Waiter Order System

PWA for waiters to take orders and print KOT/bills directly from tablets.

## Setup

1. **Install dependencies:**
```bash
cd captain-app
npm install
```

2. **Configure Print Server URL:**
Edit `src/App.jsx` and update:
```javascript
const PRINT_SERVER_URL = 'http://YOUR_PC_IP:5001'
```

3. **Add your menu items:**
Copy items from main POS `src/data/items.js` or fetch via API.

4. **Start dev server:**
```bash
npm run dev
# Accessible on LAN at http://YOUR_TABLET_IP:3001
```

5. **Build for production:**
```bash
npm run build
npm run preview
```

## Usage

1. Waiter opens app on tablet
2. Selects their name
3. Selects table
4. Adds items to cart
5. Clicks "Send KOT to Kitchen" (prints to kitchen printer)
6. When customer done, click "Print Bill" (prints to counter)

## Features

- ✅ Offline PWA (works without internet)
- ✅ Search items
- ✅ Quick +/- quantity controls
- ✅ Auto-print to kitchen/counter printers
- ✅ Real-time print server status
- ✅ Mobile-optimized touch interface

## LAN Access

Access from any device on same network:
- Main POS: `http://PC_IP:5173`
- Captain App: `http://PC_IP:3001`
- Print Server: `http://PC_IP:5001`
