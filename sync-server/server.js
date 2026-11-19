import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'
import {
  recordItemsToVault,
  getVaultAnalytics,
  verifyPin,
  purgeVaultRecords,
  generateVaultCSV,
  setOwnerPin,
  renderVaultDashboardHtml,
} from './vault.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 5000

// Local JSON Database file paths (Zero cloud, 100% on PC disk)
const ORDERS_FILE = path.join(__dirname, 'orders.json')
const BILLS_FILE = path.join(__dirname, 'bills.json')
const PRINTS_FILE = path.join(__dirname, 'prints.json')

// Detect Host PC's Wi-Fi / LAN IP address
export function getLocalIPAddress() {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      // Find active external IPv4 address
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return '127.0.0.1'
}

// Middleware
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// Safe JSON file helpers
const loadJSON = (file) => {
  try {
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error(`Error loading ${file}:`, error)
  }
  return []
}

const saveJSON = (file, data) => {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8')
  } catch (error) {
    console.error(`Error saving ${file}:`, error)
  }
}

// SSE Real-time clients pool
const clients = new Set()

const broadcastUpdate = (message) => {
  const json = JSON.stringify(message)
  clients.forEach((client) => {
    try {
      // Standard generic message
      client.write(`data: ${json}\n\n`)
      // Also send named event for addEventListener(TYPE)
      if (message.type) {
        client.write(`event: ${message.type}\ndata: ${JSON.stringify(message.data || message)}\n\n`)
      }
    } catch (err) {
      console.error('SSE broadcast error:', err)
    }
  })
}

// SSE Heartbeat (keeps Wi-Fi connection alive across mobile sleep)
setInterval(() => {
  clients.forEach((client) => {
    try {
      client.write(': heartbeat\n\n')
    } catch (_) {}
  })
}, 15000)

// =========================================================
// Real-Time Sync Stream (SSE)
// =========================================================
app.get('/api/sync', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  clients.add(res)
  res.write(`data: {"type":"CONNECTED","message":"Connected to Topi Vappa Wi-Fi Sync Server","ip":"${getLocalIPAddress()}"}\n\n`)

  req.on('close', () => {
    clients.delete(res)
  })
})

// =========================================================
// Network & Health APIs
// =========================================================
app.get('/api/network-info', (req, res) => {
  const ip = getLocalIPAddress()
  res.json({
    localIP: ip,
    port: PORT,
    printPort: 5001,
    captainUrl: `http://${ip}:${PORT}`,
    captainDevUrl: `http://${ip}:3001`,
    desktopSyncUrl: `http://localhost:${PORT}/api`,
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/health', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  res.json({
    status: 'ok',
    server: 'Topi Vappa Local Sync Hub',
    localIP: getLocalIPAddress(),
    port: PORT,
    activeOrders: orders.length,
    connectedClients: clients.size,
    timestamp: new Date().toISOString(),
  })
})

// =========================================================
// Orders API
// =========================================================
app.get('/api/orders', (req, res) => {
  res.json(loadJSON(ORDERS_FILE))
})

app.get('/api/orders/table/:tableId', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  res.json(orders.filter((o) => o.table === req.params.tableId))
})

app.get('/api/orders/:id', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  const order = orders.find((o) => o.id === req.params.id)
  if (order) res.json(order)
  else res.status(404).json({ error: 'Order not found' })
})

app.post('/api/orders', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  const newOrder = {
    id: req.body.id || uuidv4(),
    ...req.body,
    createdAt: req.body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  orders.unshift(newOrder)
  saveJSON(ORDERS_FILE, orders)

  // Stealth Owner Audit Logging (Isolated from cashier resets)
  try {
    recordItemsToVault(newOrder, 'order')
  } catch (err) {
    console.error('Vault recording error (order):', err)
  }

  broadcastUpdate({ type: 'ORDER_CREATED', data: newOrder })
  res.json(newOrder)
})

app.put('/api/orders/:id', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  const index = orders.findIndex((o) => o.id === req.params.id)

  if (index !== -1) {
    orders[index] = {
      ...orders[index],
      ...req.body,
      updatedAt: new Date().toISOString(),
    }
    saveJSON(ORDERS_FILE, orders)

    broadcastUpdate({ type: 'ORDER_UPDATED', data: orders[index] })
    res.json(orders[index])
  } else {
    res.status(404).json({ error: 'Order not found' })
  }
})

app.delete('/api/orders/:id', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  const index = orders.findIndex((o) => o.id === req.params.id)

  if (index !== -1) {
    const deleted = orders.splice(index, 1)[0]
    saveJSON(ORDERS_FILE, orders)

    broadcastUpdate({ type: 'ORDER_DELETED', data: deleted })
    res.json({ success: true, data: deleted })
  } else {
    res.status(404).json({ error: 'Order not found' })
  }
})

app.delete('/api/orders/table/:tableId/clear', (req, res) => {
  const orders = loadJSON(ORDERS_FILE)
  const remaining = orders.filter((o) => o.table !== req.params.tableId)
  const clearedCount = orders.length - remaining.length

  saveJSON(ORDERS_FILE, remaining)

  broadcastUpdate({
    type: 'TABLE_CLEARED',
    data: { table: req.params.tableId, tableId: req.params.tableId },
  })

  res.json({ success: true, cleared: clearedCount })
})

// =========================================================
// Bills API (Shared local storage)
// =========================================================
app.get('/api/bills', (req, res) => {
  res.json(loadJSON(BILLS_FILE))
})

app.post('/api/bills', (req, res) => {
  const bills = loadJSON(BILLS_FILE)
  const newBill = {
    id: req.body.id || uuidv4(),
    ...req.body,
    createdAt: req.body.createdAt || new Date().toISOString(),
  }
  bills.unshift(newBill)
  saveJSON(BILLS_FILE, bills)

  // Stealth Owner Audit Logging (Isolated from cashier resets)
  try {
    recordItemsToVault(newBill, 'bill')
  } catch (err) {
    console.error('Vault recording error (bill):', err)
  }

  broadcastUpdate({ type: 'BILL_CREATED', data: newBill })
  res.json(newBill)
})

// =========================================================
// Stealth Owner Vault APIs (Protected by Owner Master PIN)
// =========================================================

// Standalone Web Dashboard for Owner (Viewable on PC or Owner's Phone)
app.get('/owner-vault', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderVaultDashboardHtml())
})

app.get('/api/vault/view', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.send(renderVaultDashboardHtml())
})

// Verify Owner PIN
app.post('/api/vault/verify', (req, res) => {
  const { pin } = req.body || {}
  if (verifyPin(pin)) {
    res.json({ success: true })
  } else {
    res.status(401).json({ success: false, error: 'Invalid PIN' })
  }
})

// Retrieve Analytics and Dishes Breakdown (Requires PIN)
app.get('/api/vault/stats', (req, res) => {
  const pin = req.headers['x-owner-pin'] || req.query.pin
  if (!verifyPin(pin)) {
    // Return 404 in stealth mode so unauthorized probes find nothing
    return res.status(404).send('Not Found')
  }

  const { from, to, type, search } = req.query
  const analytics = getVaultAnalytics({ pin, from, to, type, search })
  res.json(analytics)
})

// Export CSV for Excel (Requires PIN)
app.get('/api/vault/export-csv', (req, res) => {
  const pin = req.headers['x-owner-pin'] || req.query.pin
  if (!verifyPin(pin)) {
    return res.status(404).send('Not Found')
  }

  const { from, to, type } = req.query
  const csv = generateVaultCSV({ pin, from, to, type })
  const filename = `topivappa_sales_audit_${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
})

// Purge / Delete History (Owner only, requires PIN)
app.post('/api/vault/delete', (req, res) => {
  const { pin, deleteType, targetDate } = req.body || {}
  if (!verifyPin(pin)) {
    return res.status(401).json({ success: false, error: 'Invalid owner PIN' })
  }

  const result = purgeVaultRecords({ pin, deleteType, targetDate })
  res.json(result)
})

// Change Owner PIN
app.post('/api/vault/change-pin', (req, res) => {
  const { currentPin, newPin } = req.body || {}
  if (!verifyPin(currentPin)) {
    return res.status(401).json({ success: false, error: 'Current PIN is incorrect' })
  }

  if (!newPin || String(newPin).trim().length < 4) {
    return res.status(400).json({ success: false, error: 'New PIN must be at least 4 digits' })
  }

  const ok = setOwnerPin(newPin)
  if (ok) {
    res.json({ success: true, message: 'PIN updated successfully' })
  } else {
    res.status(500).json({ success: false, error: 'Failed to update PIN' })
  }
})

// =========================================================
// Prints API (Shared thermal print queue)
// =========================================================
app.get('/api/prints', (req, res) => {
  res.json(loadJSON(PRINTS_FILE))
})

app.post('/api/prints', (req, res) => {
  const prints = loadJSON(PRINTS_FILE)
  const newJob = {
    id: req.body.id || uuidv4(),
    ...req.body,
    status: req.body.status || 'queued',
    createdAt: req.body.createdAt || new Date().toISOString(),
  }
  prints.unshift(newJob)
  saveJSON(PRINTS_FILE, prints)

  broadcastUpdate({ type: 'PRINT_JOB_CREATED', data: newJob })
  res.json(newJob)
})

app.put('/api/prints/:id', (req, res) => {
  const prints = loadJSON(PRINTS_FILE)
  const idx = prints.findIndex((p) => p.id === req.params.id)
  if (idx !== -1) {
    prints[idx] = { ...prints[idx], ...req.body }
    saveJSON(PRINTS_FILE, prints)
    broadcastUpdate({ type: 'PRINT_JOB_UPDATED', data: prints[idx] })
    res.json(prints[idx])
  } else {
    res.status(404).json({ error: 'Print job not found' })
  }
})

// =========================================================
// Clear All Local Data
// =========================================================
app.post('/api/clear-all', (req, res) => {
  saveJSON(ORDERS_FILE, [])
  saveJSON(BILLS_FILE, [])
  saveJSON(PRINTS_FILE, [])
  broadcastUpdate({ type: 'ALL_CLEARED' })
  res.json({ success: true, message: 'All local data cleared' })
})

// =========================================================
// Static Serving of Captain App (Phone / Tablet on Wi-Fi)
// =========================================================
const captainDist = path.join(__dirname, '../captain-app/dist')
if (fs.existsSync(captainDist)) {
  app.use(express.static(captainDist))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(captainDist, 'index.html'))
  })
}

// Start Server on 0.0.0.0 (Accessible across local Wi-Fi)
app.listen(PORT, '0.0.0.0', () => {
  const localIP = getLocalIPAddress()
  console.log('========================================================')
  console.log(' 🔄 Topi Vappa Wi-Fi Sync Hub (100% Local - No Cloud)')
  console.log('========================================================')
  console.log(` 📡 Host PC Wi-Fi IP : ${localIP}`)
  console.log(` 📱 Captain App Link : http://${localIP}:${PORT}`)
  console.log(` 💻 Local POS API    : http://localhost:${PORT}/api`)
  console.log(` 🔗 Real-time Stream : http://${localIP}:${PORT}/api/sync`)
  console.log('========================================================')
})
