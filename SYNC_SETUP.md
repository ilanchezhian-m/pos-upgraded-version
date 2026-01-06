# Order Synchronization System - Setup Guide

## Overview
The system now includes **real-time order synchronization** between PC (Main POS) and Mobile (Captain App). Both apps connect to a central **Sync Server** that manages all orders.

## Architecture

```
┌─────────────────────────────────────────┐
│          SYNC SERVER (Port 5000)        │
│   - Central Order Database (JSON)       │
│   - Real-time WebSocket Updates         │
│   - REST API for CRUD Operations        │
└─────────────────────────────────────────┘
         ↑                    ↑
         │                    │
    REST API             WebSocket/SSE
    + WebSocket          (Live Updates)
         │                    │
    ┌────┴──────┐      ┌──────┴────┐
    │            │      │            │
  PC POS       Captain  PC POS      Captain
(Port 5173)  App        (Orders       (Orders
            (Port 3001) updates)      updates)
```

## Running the System

### 1. Start Sync Server
```bash
cd d:\Petpooja\sync-server
npm start
# Server runs on http://localhost:5000
```

### 2. Start Main POS (PC)
```bash
cd d:\Petpooja\my-project
npm run dev
# Runs on http://localhost:5173
```

### 3. Start Captain App (Mobile/Tablet)
```bash
cd d:\Petpooja\captain-app
npm run dev
# Runs on http://localhost:3001
```

## How Synchronization Works

### When Order is Created (Mobile):
1. **Captain App** creates order in cart
2. Click "Save & KOT" → Confirmation modal
3. Order is **saved to Sync Server** (`POST /api/orders`)
4. KOT is sent to print server
5. **All other devices** receive live update via WebSocket
6. **PC POS** automatically displays new order

### When Order is Created (PC):
1. **PC POS** creates order
2. Click "Save & KOT" → Order saved to Sync Server
3. **All other devices** receive live update
4. **Captain App(s)** see the order in real-time

### When Bill is Printed:
1. Device marks orders as `billed: true`
2. Updates sent to Sync Server
3. Red notification dot appears on other devices
4. "Mark as Paid" button only available on PC

## Sync Server API Endpoints

### GET `/api/orders`
Get all orders across all tables
```bash
curl http://localhost:5000/api/orders
```

### GET `/api/orders/table/:tableId`
Get orders for specific table
```bash
curl http://localhost:5000/api/orders/table/A1
```

### POST `/api/orders`
Create new order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "table": "A1",
    "waiter": "Waiter 1",
    "items": [...],
    "total": 500,
    "billed": false
  }'
```

### PUT `/api/orders/:id`
Update order (mark as billed, etc)
```bash
curl -X PUT http://localhost:5000/api/orders/order-id \
  -H "Content-Type: application/json" \
  -d '{"billed": true}'
```

### DELETE `/api/orders/:tableId/clear`
Clear all orders for a table
```bash
curl -X DELETE http://localhost:5000/api/orders/table/A1/clear
```

### GET `/api/sync` (WebSocket/SSE)
Subscribe to real-time order updates

## Real-Time Updates via WebSocket (Server-Sent Events)

The Captain App automatically subscribes to updates:

```javascript
const eventSource = new EventSource(`http://localhost:5000/api/sync`)

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data)
  
  switch(data.type) {
    case 'ORDER_CREATED':
      // Handle new order
      break
    case 'ORDER_UPDATED':
      // Handle order update
      break
    case 'ORDER_DELETED':
      // Handle order deletion
      break
    case 'TABLE_CLEARED':
      // Handle table cleared
      break
  }
})
```

## Data Storage

Orders are stored in JSON format at:
```
d:\Petpooja\sync-server\orders.json
```

Each order contains:
```json
{
  "id": "uuid-generated",
  "orderNumber": "CAP-123456",
  "table": "A1",
  "waiter": "Waiter 1",
  "items": [
    { "id": 1, "name": "Chicken Biryani", "price": 200, "qty": 2 }
  ],
  "total": 400,
  "isRunningOrder": false,
  "billed": false,
  "source": "captain-app",
  "createdAt": "2026-01-03T...",
  "updatedAt": "2026-01-03T..."
}
```

## Features

### ✅ Implemented
- [x] Real-time order sync across all devices
- [x] Central order database (JSON file)
- [x] WebSocket/SSE for live updates
- [x] Order status tracking
- [x] Table occupancy display
- [x] Running orders support
- [x] Delta printing (only new items)
- [x] Combined billing
- [x] Red notification badges for billed orders
- [x] "Mark as Paid" only on PC

### 🔄 Live Updates
- New order created → All devices see it instantly
- Order status changes → All devices update immediately
- Table cleared → All devices refresh

## Network Setup

### Local Network (Same WiFi):
Both devices can access via:
- PC Local IP: `http://[PC-IP]:5173`
- Sync Server: `http://localhost:5000`
- Captain App: `http://localhost:3001` (on mobile device)

### To find your PC's IP:
```bash
ipconfig
# Look for IPv4 Address (e.g., 192.168.1.100)
```

## Troubleshooting

### Orders not syncing?
1. Ensure Sync Server is running (`npm start`)
2. Check if port 5000 is accessible
3. Verify both apps can reach `http://localhost:5000`

### WebSocket not connecting?
1. Check browser console for errors
2. Verify firewall allows port 5000
3. Restart the sync server

### Orders not persisting?
1. Check if `orders.json` is writable
2. Ensure sync server has file system access

## Security Notes
- ⚠️ No authentication - for local network only
- ⚠️ No encryption - use only on trusted networks
- ⚠️ Data stored in plain JSON - not for production use
- Consider adding authentication for production

## Next Steps
For production deployment:
1. Add database (PostgreSQL/MongoDB instead of JSON)
2. Implement user authentication
3. Add data encryption
4. Deploy on secure server
5. Use WebSocket (Socket.io) instead of SSE
