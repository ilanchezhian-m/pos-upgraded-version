import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = 5000

// Database file path
const DB_FILE = path.join(__dirname, 'orders.json')

// Middleware
app.use(cors())
app.use(express.json())

// Helper functions
const loadOrders = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8')
      return JSON.parse(data)
    }
  } catch (error) {
    console.error('Error loading orders:', error)
  }
  return []
}

const saveOrders = (orders) => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2))
  } catch (error) {
    console.error('Error saving orders:', error)
  }
}

// GET all orders
app.get('/api/orders', (req, res) => {
  const orders = loadOrders()
  res.json(orders)
})

// GET orders for a specific table
app.get('/api/orders/table/:tableId', (req, res) => {
  const orders = loadOrders()
  const tableOrders = orders.filter(order => order.table === req.params.tableId)
  res.json(tableOrders)
})

// GET single order by ID
app.get('/api/orders/:id', (req, res) => {
  const orders = loadOrders()
  const order = orders.find(o => o.id === req.params.id)
  if (order) {
    res.json(order)
  } else {
    res.status(404).json({ error: 'Order not found' })
  }
})

// CREATE new order
app.post('/api/orders', (req, res) => {
  const orders = loadOrders()
  const newOrder = {
    id: uuidv4(),
    ...req.body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  orders.push(newOrder)
  saveOrders(orders)
  
  // Broadcast to all clients
  broadcastUpdate({ type: 'ORDER_CREATED', data: newOrder })
  
  res.json(newOrder)
})

// UPDATE order
app.put('/api/orders/:id', (req, res) => {
  const orders = loadOrders()
  const index = orders.findIndex(o => o.id === req.params.id)
  
  if (index !== -1) {
    orders[index] = {
      ...orders[index],
      ...req.body,
      updatedAt: new Date().toISOString()
    }
    saveOrders(orders)
    
    // Broadcast update
    broadcastUpdate({ type: 'ORDER_UPDATED', data: orders[index] })
    
    res.json(orders[index])
  } else {
    res.status(404).json({ error: 'Order not found' })
  }
})

// DELETE order
app.delete('/api/orders/:id', (req, res) => {
  const orders = loadOrders()
  const index = orders.findIndex(o => o.id === req.params.id)
  
  if (index !== -1) {
    const deleted = orders.splice(index, 1)[0]
    saveOrders(orders)
    
    // Broadcast deletion
    broadcastUpdate({ type: 'ORDER_DELETED', data: deleted })
    
    res.json({ success: true, data: deleted })
  } else {
    res.status(404).json({ error: 'Order not found' })
  }
})

// CLEAR all orders for a table
app.delete('/api/orders/table/:tableId/clear', (req, res) => {
  const orders = loadOrders()
  const cleared = orders.filter(o => o.table === req.params.tableId)
  const remaining = orders.filter(o => o.table !== req.params.tableId)
  
  saveOrders(remaining)
  
  // Broadcast
  broadcastUpdate({ type: 'TABLE_CLEARED', data: { table: req.params.tableId } })
  
  res.json({ success: true, cleared: cleared.length })
})

// WebSocket-like SSE support for real-time updates
const clients = new Set()

app.get('/api/sync', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  clients.add(res)
  
  res.write('data: {"type":"CONNECTED","message":"Connected to sync server"}\n\n')
  
  req.on('close', () => {
    clients.delete(res)
  })
})

// Broadcast function
const broadcastUpdate = (message) => {
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(message)}\n\n`)
  })
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Start server
app.listen(PORT, () => {
  console.log(`🔄 Sync Server running on http://localhost:${PORT}`)
  console.log(`📋 Orders API: http://localhost:${PORT}/api/orders`)
  console.log(`🔗 Real-time sync: http://localhost:${PORT}/api/sync`)
})
