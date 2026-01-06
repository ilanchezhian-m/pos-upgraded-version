import { useCallback, useEffect, useMemo, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import './App.css'
import { items } from './data/items'
import {
  listBills,
  listOrders,
  listPrintJobs,
  markSynced,
  saveBill,
  saveOrder,
  savePrintJob,
  updatePrintStatus,
  clearAll,
  getBillsByCycle,
} from './lib/db'
import { getUniqueCycles, filterBillsByCycle } from './lib/cycleUtils'
import Layout from './components/Layout'
import PrintPage from './pages/PrintPage'
import OrdersPage from './pages/OrdersPage'
import BillsPage from './pages/BillsPage'
import PrintQueuePage from './pages/PrintQueuePage'


const SYNC_SERVER_URL = 'http://localhost:5000/api'

const tableGroups = [
  { label: 'Parcel', slots: ['Parcel'] },
  { label: 'A', slots: ['A1', 'A2', 'A3'] },
  { label: 'B', slots: ['B1', 'B2', 'B3'] },
  { label: 'C', slots: ['C1', 'C2', 'C3', 'C4'] },
  { label: 'F', slots: ['F1', 'F2', 'F4'] },
]

function App() {
  const [orderForm, setOrderForm] = useState({ customer: '', table: 'A1', payment: 'UPI' })
  const [orders, setOrders] = useState([])
  const [bills, setBills] = useState([])
  const [prints, setPrints] = useState([])
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [flowStarted, setFlowStarted] = useState(false)
  const [orderLines, setOrderLines] = useState([])
  const [searchTerm, setSearchTerm] = useState('')

  const [syncStatus, setSyncStatus] = useState('unknown')
  const [pendingPaymentTable, setPendingPaymentTable] = useState(null)
  const [pendingKOT, setPendingKOT] = useState(null) // {mode, items}
  const [tablePrintedItems, setTablePrintedItems] = useState({}) // Track what's been printed per table
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selectedCycle, setSelectedCycle] = useState(null) // Selected cycle date for filtering
  const [showCycleView, setShowCycleView] = useState(false) // Toggle cycle view
  const [showMarkAsPaid, setShowMarkAsPaid] = useState({}) // Track which tables can show "Mark as Paid" after delay

  const getNextOrderNumber = useCallback(() => {
    try {
      const raw = localStorage.getItem('orderNumberCounter')
      const current = raw ? parseInt(raw, 10) : 36650
      const next = current + 1
      localStorage.setItem('orderNumberCounter', String(next))
      return current
    } catch (err) {
      console.error('order number failed', err)
      return Math.floor(Date.now() / 1000)
    }
  }, [])

  const categories = useMemo(() => ['All', ...new Set(items.map((i) => i.category || 'Other'))], [])
  const categoryTone = useCallback((cat) => {
    const name = (cat || '').toUpperCase()
    if (name.includes('VEG')) return 'veg'
    if (
      name.includes('NON VEG') ||
      name.includes('SEA FOOD') ||
      name.includes('EGG') ||
      name.includes('BIRI') ||
      name.includes('TANDOORI') ||
      name.includes('BBQ') ||
      name.includes('GRILL') ||
      name.includes('SHAWARMA')
    ) return 'non-veg'
    return ''
  }, [])
  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return items
      .filter((it) => selectedCategory === 'All' || it.category === selectedCategory)
      .filter((it) => (term ? it.name.toLowerCase().includes(term) : true))
  }, [selectedCategory, searchTerm])

  function addLine(item) {
    setOrderLines((lines) => {
      const existing = lines.find((l) => l.id === item.id)
      if (existing) {
        return lines.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l))
      }
      return [{ id: item.id, name: item.name, price: item.price, qty: 1 }, ...lines]
    })
    setFlowStarted(true)
  }

  function changeLineQty(itemId, delta) {
    setOrderLines((lines) => {
      const next = lines
        .map((l) => (l.id === itemId ? { ...l, qty: Math.max(0, l.qty + delta) } : l))
        .filter((l) => l.qty > 0)
      return next
    })
  }

  const paymentMethods = ['UPI', 'Cash', 'Card']
  
  // Get unpaid/billed orders for a table (for payment notification)
  const getTableStatus = (slot) => {
    const tableOrders = orders.filter(o => o.table === slot && o.status === 'billed')
    return tableOrders.length > 0
  }
  
  // Check if table is occupied (has active KOT orders)
  const isTableOccupied = (slot) => {
    const activeOrders = orders.filter(o => o.table === slot && (o.status === 'new' || o.status === 'billed'))
    return activeOrders.length > 0
  }
  
  const selectTable = (slot) => {
    setOrderForm((f) => ({ ...f, table: slot }))
    // Start fresh - don't merge previous orders
    setOrderLines([])
    setFlowStarted(true)
  }
  const changeTable = () => {
    setFlowStarted(false)
    setOrderLines([])
  }
  const goHome = useCallback(() => {
    setFlowStarted(false)
    setOrderLines([])
    setPendingKOT(null)
    setPendingPaymentTable(null)
  }, [])

  const fakePostToLocalServer = useCallback((payload) => {
    void payload
    return new Promise((resolve) => {
      // Simulated LAN call; replace with fetch('http://pc-local:5001/sync', { method: 'POST', body: JSON.stringify(payload) })
      setTimeout(resolve, 800)
    })
  }, [])

  const trySync = useCallback(async () => {
    if (!isOnline) return
    const [latestOrders, latestBills, latestPrints] = await Promise.all([
      listOrders(),
      listBills(),
      listPrintJobs(),
    ])

    const unsyncedOrders = latestOrders.filter((o) => !o.synced)
    const unsyncedBills = latestBills.filter((b) => !b.synced)
    const unsyncedPrints = latestPrints.filter((p) => !p.synced)

    const payload = { orders: unsyncedOrders, bills: unsyncedBills, prints: unsyncedPrints }
    if (!payload.orders.length && !payload.bills.length && !payload.prints.length) return

    try {
      await fakePostToLocalServer(payload)
      await Promise.all([
        ...unsyncedOrders.map((o) => markSynced('orders', o.id)),
        ...unsyncedBills.map((b) => markSynced('bills', b.id)),
        ...unsyncedPrints.map((p) => markSynced('prints', p.id)),
      ])
      setOrders(latestOrders.map((o) => ({ ...o, synced: true })))
      setBills(latestBills.map((b) => ({ ...b, synced: true })))
      setPrints(latestPrints.map((p) => ({ ...p, synced: true })))
    } catch (err) {
      console.error('Sync failed', err)
    }
  }, [fakePostToLocalServer, isOnline])

  useEffect(() => {
    let active = true
    ;(async () => {
      const [o, b, p] = await Promise.all([listOrders(), listBills(), listPrintJobs()])
      if (!active) return
      setOrders(o)
      setBills(b)
      setPrints(p)
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    const handleResize = () => {
      // Track window resize but don't use for now
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      trySync()
    }, 7000)
    return () => clearInterval(id)
  }, [trySync])

  useEffect(() => {
    // Check print server status on mount and periodically
    const checkStatus = async () => {

    }
    checkStatus()
    const id = setInterval(checkStatus, 10000)
    return () => clearInterval(id)
  }, [])

  const orderTotal = useMemo(() => orderLines.reduce((sum, line) => sum + line.price * line.qty, 0), [orderLines])

  async function handleCreateOrder(e, mode = 'kot') {
    if (e?.preventDefault) e.preventDefault()
    
    const isDelivery = (orderForm.table || '').toLowerCase() === 'parcel'
    
    // For billing: collect all unbilled orders for this table
    if (mode === 'bill') {
      const tableOrders = orders.filter(o => o.table === orderForm.table && o.status !== 'paid')
      
      // Combine all items from existing orders + current cart
      const allItems = []
      tableOrders.forEach(order => {
        if (order.items && order.items.length) {
          order.items.forEach(item => {
            const existing = allItems.find(i => i.id === item.id)
            if (existing) {
              existing.qty += item.qty
            } else {
              allItems.push({ ...item })
            }
          })
        }
      })
      
      // Add current cart items
      orderLines.forEach(item => {
        const existing = allItems.find(i => i.id === item.id)
        if (existing) {
          existing.qty += item.qty
        } else {
          allItems.push({ ...item })
        }
      })
      
      if (allItems.length === 0) return
      
      const totalAmount = allItems.reduce((sum, item) => sum + item.price * item.qty, 0)
      const existingOrderNumber = tableOrders[0]?.orderNumber || tableOrders[0]?.id?.slice(0, 6)
      const orderNumber = existingOrderNumber || getNextOrderNumber()
      
      const bill = {
        orderId: tableOrders[0]?.id || 'new',
        customer: orderForm.customer || 'Walk-in',
        table: orderForm.table,
        total: totalAmount,
        items: allItems,
        status: 'ready',
        paymentMethod: orderForm.payment,
        orderNumber: orderNumber,
      }
      
      const savedBill = await saveBill(bill)
      const billJob = await savePrintJob({ type: 'BILL', refId: savedBill.id, status: 'queued' })
      setBills((prev) => [savedBill, ...prev])
      setPrints((prev) => [billJob, ...prev])
      
      // Mark all table orders as billed in sync server
      for (const order of tableOrders) {
        await updateOrderInSync(order.id, { ...order, status: 'billed' })
      }
      
      // Printing handled automatically by Sync Server
      // Sync Server will trigger counter printer after bill creation
      
      setOrderLines([])
      return
    }
    
    if (!orderLines.length) return
    
    // For KOT: Show confirmation modal
    if (!isDelivery && mode === 'kot') {
      setPendingKOT({ mode: 'kot', items: orderLines, table: orderForm.table })
      return
    }
    
    const summary = orderLines.map((l) => `${l.name} x${l.qty}`).join(', ')
    const status = mode === 'bill' || isDelivery ? 'billed' : 'new'
    const orderNumber = getNextOrderNumber()

    const order = {
      customer: orderForm.customer || 'Walk-in',
      table: orderForm.table || 'Parcel',
      items: orderLines,
      total: orderTotal,
      payment: orderForm.payment,
      status,
      summary,
      orderNumber,
    }

    const savedOrder = await createOrderInSync(order)

    // Create bill + print when delivery
    if (isDelivery) {
      const bill = {
        orderId: savedOrder.id,
        customer: order.customer,
        table: order.table,
        total: order.total,
        items: orderLines,
        status: 'ready',
        paymentMethod: order.payment,
        orderNumber: order.orderNumber,
      }
      const savedBill = await saveBill(bill)
      const billJob = await savePrintJob({ type: 'BILL', refId: savedBill.id, status: 'queued' })
      setBills((prev) => [savedBill, ...prev])
      setPrints((prev) => [billJob, ...prev])
      
      // Printing handled automatically by Sync Server
      // Sync Server will trigger counter printer after bill creation
      
      setOrderLines([])
    }

    setOrderForm((f) => ({ ...f }))
  }

  async function handleCreateBill(order) {
    const billItems = order.items && order.items.length
      ? order.items
      : [{ name: order.item, qty: order.qty, price: order.price }]
    const orderNumber = order.orderNumber || order.id?.slice(0, 6) || 'N/A'
    const bill = {
      orderId: order.id,
      customer: order.customer,
      table: order.table,
      total: order.total,
      items: billItems,
      status: 'ready',
      paymentMethod: order.payment,
      orderNumber,
    }
    const savedBill = await saveBill(bill)
    setBills((prev) => [savedBill, ...prev])
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'billed' } : o)))
    const printJob = await savePrintJob({ type: 'BILL', refId: savedBill.id, status: 'queued' })
    setPrints((prev) => [printJob, ...prev])
  }

  async function handlePrintBill(bill) {
    const existing = prints.find((p) => p.type === 'BILL' && p.refId === bill.id && p.status !== 'done')
    if (existing) return
    const job = await savePrintJob({ type: 'BILL', refId: bill.id, status: 'queued' })
    setPrints((prev) => [job, ...prev])
  }

  async function handleMarkPrinted(jobId) {
    await updatePrintStatus(jobId, 'done')
    setPrints((prev) => prev.map((p) => (p.id === jobId ? { ...p, status: 'done' } : p)))
  }

  // Sync server functions
  const fetchOrdersFromServer = useCallback(async () => {
    try {
      const res = await fetch(`${SYNC_SERVER_URL}/orders`)
      if (!res.ok) throw new Error('Failed to fetch orders')
      const serverOrders = await res.json()
      setOrders(serverOrders)
      setSyncStatus('online')
      return serverOrders
    } catch (err) {
      console.error('Failed to fetch from sync server:', err)
      setSyncStatus('offline')
      // Fall back to local IndexedDB
      const localOrders = await listOrders()
      setOrders(localOrders)
      return localOrders
    }
  }, [])

  const createOrderInSync = useCallback(async (orderData) => {
    try {
      const res = await fetch(`${SYNC_SERVER_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      if (!res.ok) throw new Error('Failed to create order')
      const newOrder = await res.json()
      setSyncStatus('online')
      return newOrder
    } catch (err) {
      console.error('Failed to create order in sync server:', err)
      setSyncStatus('offline')
      // Fall back to local IndexedDB
      const localOrder = await saveOrder(orderData)
      return localOrder
    }
  }, [])

  const updateOrderInSync = useCallback(async (orderId, updates) => {
    try {
      const res = await fetch(`${SYNC_SERVER_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update order')
      const updatedOrder = await res.json()
      setSyncStatus('online')
      return updatedOrder
    } catch (err) {
      console.error('Failed to update order in sync server:', err)
      setSyncStatus('offline')
      // Fall back to local IndexedDB
      const localOrder = await saveOrder({ id: orderId, ...updates })
      return localOrder
    }
  }, [])

  // Subscribe to real-time updates from sync server
  useEffect(() => {
    let eventSource = null
    const subscribeToUpdates = () => {
      try {
        eventSource = new EventSource(`${SYNC_SERVER_URL.replace('/api', '')}/api/sync`)
        eventSource.addEventListener('ORDER_CREATED', (event) => {
          const newOrder = JSON.parse(event.data)
          setOrders((prev) => [newOrder, ...prev])
        })
        eventSource.addEventListener('ORDER_UPDATED', (event) => {
          const updatedOrder = JSON.parse(event.data)
          setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)))
        })
        eventSource.addEventListener('ORDER_DELETED', (event) => {
          const { id } = JSON.parse(event.data)
          setOrders((prev) => prev.filter((o) => o.id !== id))
        })
        eventSource.addEventListener('TABLE_CLEARED', (event) => {
          const { tableId } = JSON.parse(event.data)
          setOrders((prev) => prev.filter((o) => o.table !== tableId))
        })
        setSyncStatus('online')
      } catch (err) {
        console.error('Failed to subscribe to updates:', err)
        setSyncStatus('offline')
      }
    }
    subscribeToUpdates()
    return () => {
      if (eventSource) eventSource.close()
    }
  }, [])

  // Fetch orders on mount
  useEffect(() => {
    fetchOrdersFromServer()
  }, [fetchOrdersFromServer])

  async function markTableAsPaid(table) {
    // Mark all orders for this table as paid in sync server
    const tableOrders = orders.filter(o => o.table === table && o.status !== 'paid')
    for (const order of tableOrders) {
      await updateOrderInSync(order.id, { ...order, status: 'paid' })
    }
  }

  async function handleClearAllData() {
    try {
      // Clear IndexedDB
      await clearAll()
      // Clear localStorage
      localStorage.removeItem('orderNumberCounter')
      // Reset state
      setOrders([])
      setBills([])
      setPrints([])
      setTablePrintedItems({})
      setShowClearConfirm(false)
      alert('All data has been cleared successfully!')
    } catch (err) {
      console.error('Failed to clear data:', err)
      alert('Failed to clear data. Please try again.')
    }
  }

  async function confirmKOT() {
    if (!pendingKOT) return
    
    const { items, table } = pendingKOT
    const orderNumber = getNextOrderNumber()
    
    // Get previously printed items for this table
    const previousPrinted = tablePrintedItems[table] || []
    
    // Calculate delta (new items or quantity increases)
    const newItems = items.filter(item => {
      const prevItem = previousPrinted.find(p => p.id === item.id)
      return !prevItem || item.qty > prevItem.qty
    }).map(item => {
      const prevItem = previousPrinted.find(p => p.id === item.id)
      // If item was partially printed before, only print the new quantity
      return {
        ...item,
        qty: prevItem ? item.qty - prevItem.qty : item.qty
      }
    })
    
    if (newItems.length === 0) {
      // No new items to print
      setPendingKOT(null)
      return
    }
    
    // Calculate total for ONLY new items being printed
    const newItemsTotal = newItems.reduce((sum, item) => sum + item.price * item.qty, 0)
    const isFirstKOT = previousPrinted.length === 0
    
    // Save order with ONLY new items (for this KOT set) to sync server
    const order = {
      customer: orderForm.customer || 'Walk-in',
      table: table,
      items: newItems, // ONLY new items in this order
      total: newItemsTotal, // Total for this KOT only
      payment: orderForm.payment,
      status: 'new',
      summary: newItems.map((l) => `${l.name} x${l.qty}`).join(', '),
      orderNumber,
      isRunningOrder: !isFirstKOT, // Mark as running order if not first
    }
    
    const savedOrder = await createOrderInSync(order)
    const kotJob = await savePrintJob({ type: 'KOT', refId: savedOrder.id, status: 'queued' })
    setPrints((prev) => [kotJob, ...prev])
    
    // Printing handled automatically by Sync Server
    // Sync Server will trigger kitchen printer after order creation for new items
    
    // Update tracking for this table
    setTablePrintedItems(prev => ({
      ...prev,
      [table]: items
    }))
    
    // Clear order lines and modal
    setOrderLines([])
    setFlowStarted(false)
    setPendingKOT(null)
  }

  const isDelivery = orderForm.table === 'Parcel'

  const handleClearData = () => {
    setShowClearConfirm(true)
  }

  // Order Entry Component
  const OrderEntry = () => (
    <>
      {!flowStarted ? (
        <div className="start-screen">
          <div className="start-card">
            <h2>Choose Table or Parcel</h2>
            <p className="panel-subtitle">Pick a table row or Parcel to start taking the order.</p>
            <div className="table-group-wrapper">
              {tableGroups.map((group) => (
                <div key={group.label} className="table-group">
                  <div className="table-group-label">{group.label}</div>
                  <div className="table-row">
                    {group.slots.map((slot) => {
                      const hasBilledOrders = getTableStatus(slot)
                      const isOccupied = isTableOccupied(slot)
                      return (
                        <div key={slot} className="table-tile-wrapper">
                          <button
                            type="button"
                            className={`table-tile ${hasBilledOrders ? 'has-pending' : ''} ${isOccupied ? 'occupied' : ''}`}
                            onClick={() => selectTable(slot)}
                          >
                            {slot}
                            {isOccupied && <span className="occupied-icon">👥</span>}
                            {hasBilledOrders && <span className="pending-badge">●</span>}
                          </button>
                          {hasBilledOrders && (
                            <button
                              type="button"
                              className="mark-paid-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setPendingPaymentTable(slot)
                              }}
                              title="Mark as Paid"
                            >
                              ✓
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <>
      <div className="board">
        <aside className="panel sidebar">
          <h3 className="panel-title">Categories</h3>
          <div className="category-list">
            {categories.map((cat) => {
              const active = selectedCategory === cat
              return (
                <button
                  key={cat}
                  type="button"
                  className={`pill-btn block ${active ? 'active' : ''} ${categoryTone(cat)}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </aside>

        <section className="panel items-panel">
          <div className="panel-header">
            <div className="panel-title">Items</div>
            <div className="muted small">{filteredItems.length} items • Click to add, double-click to add +1</div>
          </div>
          <div className="items-search">
            <input
              className="input"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button type="button" className="pill subtle" onClick={() => setSearchTerm('')}>
                Clear
              </button>
            )}
          </div>
          <div className="items-grid">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="item-card"
                onClick={() => addLine(item)}
                onDoubleClick={() => addLine(item)}
              >
                <div className="item-name">{item.name}</div>
                <div className="item-meta">
                  <span className="item-price">₹{item.price}</span>
                </div>
              </button>
            ))}
          </div>
        </section>


{/* order summary */}
        <section className="panel order-panel">
          <div className="panel-title">Order Summary</div>
          <p className="panel-subtitle">Add items, adjust qty per line, choose payment, then save.</p>
          <form className="order-form" onSubmit={handleCreateOrder}>
            <label className="muted">Customer</label>
            <input
              className="input"
              placeholder="Walk-in"
              value={orderForm.customer}
              onChange={(e) => setOrderForm((f) => ({ ...f, customer: e.target.value }))}
            />

            <div className="order-tags">
              <span className="pill dark">{orderForm.table || 'Parcel'}</span>
              <span className="pill subtle">{orderForm.payment}</span>
              <button type="button" className="pill subtle" onClick={changeTable}>Change</button>
            </div>

            {/* Show previous running orders for this table */}
            {orders.filter(o => o.table === orderForm.table && o.status !== 'paid').length > 0 && (
              <div className="running-orders">
                <div className="running-orders-title">📋 Running Orders</div>
                {orders.filter(o => o.table === orderForm.table && o.status !== 'paid').map(order => (
                  <div key={order.id} className="running-order-item">
                    <div className="order-badge">
                      <span className="order-num">#{order.orderNumber}</span>
                      {order.isRunningOrder && <span className="running-label">Running</span>}
                    </div>
                    <div className="order-items-list">
                      {order.items?.map((item, idx) => (
                        <div key={idx} className="mini-item">
                          {item.name} ×{item.qty}
                        </div>
                      ))}
                    </div>
                    <div className="order-subtotal">₹{order.total}</div>
                  </div>
                ))}
                <div className="running-total">
                  <strong>Total (All Orders):</strong>
                  <strong className="total-amount">
                    ₹{orders.filter(o => o.table === orderForm.table && o.status !== 'paid').reduce((sum, o) => sum + o.total, 0) + orderTotal}
                  </strong>
                </div>
              </div>
            )}

            <div className="panel-subtitle small">New Items</div>

            <div className="order-lines">
              {orderLines.length === 0 && <div className="muted">No items yet. Click items to add.</div>}
              {orderLines.map((line) => (
                <div key={line.id} className="order-line">
                  <div className="order-item-name">{line.name}</div>
                  <div className="order-line-right">
                    <div className="qty-control">
                      <button type="button" className="qty-btn" onClick={() => changeLineQty(line.id, -1)}>
                        −
                      </button>
                      <span className="pill subtle qty-pill">{line.qty}</span>
                      <button type="button" className="qty-btn" onClick={() => changeLineQty(line.id, +1)}>
                        +
                      </button>
                    </div>
                    <div className="order-line-price">₹{line.price * line.qty}</div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="muted">Payment</label>
              <div className="payment-row">
                {paymentMethods.map((method) => {
                  const active = orderForm.payment === method
                  return (
                    <button
                      key={method}
                      type="button"
                      className={`pay-btn ${active ? 'active' : ''}`}
                      onClick={() => setOrderForm((f) => ({ ...f, payment: method }))}
                    >
                      {method}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="order-total">
              <div>
                <div className="muted small">Total</div>
                <div className="order-total-value">₹{orderTotal}</div>
              </div>
              <div className="order-total-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={orderLines.length === 0}
                  onClick={(e) => handleCreateOrder(e, isDelivery ? 'bill' : 'kot')}
                >
                  {isDelivery ? 'Save & Print Bill' : 'Save & KOT'}
                </button>
                {!isDelivery && (
                  <button
                    className="button"
                    type="button"
                    disabled={orderLines.length === 0 && orders.filter(o => o.table === orderForm.table && o.status !== 'paid').length === 0}
                    onClick={(e) => handleCreateOrder(e, 'bill')}
                  >
                    Print Bill
                  </button>
                )}
                {!isDelivery && 
                 orders.some(o => o.table === orderForm.table && o.status === 'billed') && 
                 showMarkAsPaid[orderForm.table] && (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => markTableAsPaid(orderForm.table)}
                    style={{
                      transition: 'all 0.3s ease',
                      animation: 'fadeIn 0.3s ease-in'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.05)'
                      e.target.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)'
                      e.target.style.backgroundColor = '#10b981'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)'
                      e.target.style.boxShadow = 'none'
                    }}
                  >
                    ✓ Mark as Paid
                  </button>
                )}
              </div>
            </div>
          </form>
        </section>
      </div>
      </>
      )}
      {pendingKOT && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Send KOT to Kitchen?</h3>
            <p>Table <strong>{pendingKOT.table}</strong> • {pendingKOT.items.length} item(s)</p>
            <div className="modal-items">
              {pendingKOT.items.map((item, idx) => (
                <div key={idx} className="modal-item">
                  <span>{item.name}</span>
                  <span className="qty">×{item.qty}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={confirmKOT}
              >
                ✓ Send KOT
              </button>
              <button
                className="btn-cancel"
                onClick={() => setPendingKOT(null)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Mark as Paid */}
      {pendingPaymentTable && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Mark as Paid?</h3>
            <p>Confirm payment for table <strong>{pendingPaymentTable}</strong></p>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={() => {
                  markTableAsPaid(pendingPaymentTable)
                  setPendingPaymentTable(null)
                }}
              >
                ✓ Mark as Paid
              </button>
              <button
                className="btn-cancel"
                onClick={() => setPendingPaymentTable(null)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clear All Data */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Clear All Data?</h3>
            <p>This will permanently delete:</p>
            <ul style={{ textAlign: 'left', margin: '15px 0', paddingLeft: '20px' }}>
              <li>All orders ({orders.length})</li>
              <li>All bills ({bills.length})</li>
              <li>All print jobs ({prints.length})</li>
              <li>Order number counter</li>
            </ul>
            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>This action cannot be undone!</p>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={handleClearAllData}
                style={{ background: '#dc2626' }}
              >
                ✓ Yes, Clear All
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <Layout 
      isOnline={isOnline} 
      syncStatus={syncStatus} 
      onClearData={handleClearData}
      showOrderHeader={true}
      orderForm={orderForm}
      flowStarted={flowStarted}
      onBackToTables={changeTable}
      onGoHome={goHome}
    >
      <Routes>
        <Route path="/" element={<OrderEntry />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/print-queue" element={<PrintQueuePage />} />
        <Route path="/print-center" element={<PrintPage />} />
      </Routes>

      {/* Confirmation Modal for KOT */}
      {pendingKOT && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Send KOT to Kitchen?</h3>
            <p>Table <strong>{pendingKOT.table}</strong> • {pendingKOT.items.length} item(s)</p>
            <div className="modal-items">
              {pendingKOT.items.map((item, idx) => (
                <div key={idx} className="modal-item">
                  <span>{item.name}</span>
                  <span className="qty">×{item.qty}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={confirmKOT}
              >
                ✓ Send KOT
              </button>
              <button
                className="btn-cancel"
                onClick={() => setPendingKOT(null)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Mark as Paid */}
      {pendingPaymentTable && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Mark as Paid?</h3>
            <p>Confirm payment for table <strong>{pendingPaymentTable}</strong></p>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={() => {
                  markTableAsPaid(pendingPaymentTable)
                  setPendingPaymentTable(null)
                }}
              >
                ✓ Mark as Paid
              </button>
              <button
                className="btn-cancel"
                onClick={() => setPendingPaymentTable(null)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Clear All Data */}
      {showClearConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>⚠️ Clear All Data?</h3>
            <p>This will permanently delete:</p>
            <ul style={{ textAlign: 'left', margin: '15px 0', paddingLeft: '20px' }}>
              <li>All orders ({orders.length})</li>
              <li>All bills ({bills.length})</li>
              <li>All print jobs ({prints.length})</li>
              <li>Order number counter</li>
            </ul>
            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>This action cannot be undone!</p>
            <div className="modal-actions">
              <button
                className="btn-confirm"
                onClick={handleClearAllData}
                style={{ background: '#dc2626' }}
              >
                ✓ Yes, Clear All
              </button>
              <button
                className="btn-cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

// Cycle View Component
function CycleView({ bills, selectedCycle, onSelectCycle }) {
  const cycles = getUniqueCycles(bills);
  const filteredBills = selectedCycle 
    ? filterBillsByCycle(bills, selectedCycle)
    : bills;

  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <h3 style={{ fontSize: '14px', marginBottom: '10px' }}>Select Cycle:</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
          <button
            className={`button ${!selectedCycle ? 'active' : 'secondary'}`}
            type="button"
            onClick={() => onSelectCycle(null)}
            style={{ textAlign: 'left', fontSize: '12px' }}
          >
            All Cycles ({bills.length} bills)
          </button>
          {cycles.map((cycle) => (
            <button
              key={cycle.cycleDate}
              className={`button ${selectedCycle === cycle.cycleDate ? 'active' : 'secondary'}`}
              type="button"
              onClick={() => onSelectCycle(cycle.cycleDate)}
              style={{ textAlign: 'left', fontSize: '12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                <span>{cycle.cycleLabel || cycle.cycleDate}</span>
                <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>
                  {cycle.billCount} bills • ₹{cycle.totalAmount}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedCycle && (
        <div style={{ marginBottom: '10px', padding: '10px', background: '#f0f8ff', borderRadius: '6px' }}>
          <strong>Cycle:</strong> {cycles.find(c => c.cycleDate === selectedCycle)?.cycleLabel || selectedCycle}
        </div>
      )}

      <div className="list">
        {filteredBills.length === 0 ? (
          <div className="muted">No bills found for selected cycle.</div>
        ) : (
          filteredBills.map((bill) => {
            const totalItems = bill.items?.length || 0;
            const totalQty = bill.items?.reduce((sum, item) => sum + item.qty, 0) || 0;
            
            return (
              <div key={bill.id} className="list-item" style={{ padding: '15px', marginBottom: '10px', background: '#f9f9f9', borderRadius: '6px' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div>
                      <div><strong>{bill.customer}</strong> • ₹{bill.total}</div>
                      <div className="muted">Table {bill.table} • Order #{bill.orderNumber || bill.id.slice(0, 8)}</div>
                      <div className="muted" style={{ fontSize: '11px' }}>
                        {new Date(bill.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="tag">{bill.synced ? 'synced' : 'queued'}</span>
                    </div>
                  </div>
                  
                  {bill.cycleLabel && (
                    <div style={{ marginBottom: '8px', padding: '6px', background: '#e6f3ff', borderRadius: '4px', fontSize: '11px' }}>
                      <strong>Cycle:</strong> {bill.cycleLabel}
                    </div>
                  )}
                  
                  <div style={{ marginBottom: '8px', padding: '8px', background: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px' }}>📋 Billing Summary:</div>
                    <div style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Total Items:</strong> {totalItems} different items</div>
                      <div><strong>Total Quantity:</strong> {totalQty} units</div>
                      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e0e0e0' }}>
                        <strong>Item Details:</strong>
                        <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {bill.items?.map((item, idx) => (
                            <div key={idx} style={{ fontSize: '10px', color: '#666' }}>
                              {item.name} × {item.qty} = ₹{item.price * item.qty}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '11px', color: '#666' }}>
                    <strong>Payment:</strong> {bill.paymentMethod || 'Cash'} • Amount Paid: ₹{bill.total}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default App
