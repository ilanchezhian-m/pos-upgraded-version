import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'
import { items as MENU_ITEMS } from './data/items.js'

// Auto-detect local Wi-Fi host IP when opened on phone/tablet over LAN
const getAutoSyncServer = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sync_server_url')
    if (saved) return saved
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:5000/api`
    }
  }
  return import.meta.env.VITE_SYNC_SERVER_URL || 'http://localhost:5000/api'
}

const getAutoPrintServer = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('print_server_url')
    if (saved) return saved
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:5001`
    }
  }
  return import.meta.env.VITE_PRINT_SERVER_URL || 'http://localhost:5001'
}

const DEFAULT_PRINT_SERVER = 'http://localhost:5001'
const DEFAULT_SYNC_SERVER = 'http://localhost:5000/api'
const TABLES = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'C4', 'F1', 'F2', 'F4', 'Parcel']
const CAPTAINS = ['Captain 1', 'Captain 2', 'Captain 3', 'Captain 4']

function App() {
  // Waiter & Table selection - defaults directly to menu!
  const [waiter, setWaiter] = useState(() => localStorage.getItem('captain_name') || 'Captain 1')
  const [table, setTable] = useState(() => localStorage.getItem('captain_table') || 'A1')
  
  // UI states
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [showTableModal, setShowTableModal] = useState(false)
  const [showCaptainModal, setShowCaptainModal] = useState(false)
  const [showCartDrawer, setShowCartDrawer] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Server URLs (editable via settings modal)
  const [printServerUrl, setPrintServerUrl] = useState(getAutoPrintServer)
  const [syncServerUrl, setSyncServerUrl] = useState(getAutoSyncServer)
  const [tempPrintUrl, setTempPrintUrl] = useState(printServerUrl)
  const [tempSyncUrl, setTempSyncUrl] = useState(syncServerUrl)
  const [quickIP, setQuickIP] = useState(() => {
    if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
      return window.location.hostname
    }
    return ''
  })
  const [testResult, setTestResult] = useState(null)

  // Connection & Orders
  const [serverStatus, setServerStatus] = useState('unknown')
  const [syncStatus, setSyncStatus] = useState('unknown')
  const [orders, setOrders] = useState([])
  const [tablePrintedItems, setTablePrintedItems] = useState({})
  const [pendingKOT, setPendingKOT] = useState(null)
  const [pendingBill, setPendingBill] = useState(null)

  const searchInputRef = useRef(null)

  // Persist waiter and table
  useEffect(() => {
    localStorage.setItem('captain_name', waiter)
  }, [waiter])

  useEffect(() => {
    localStorage.setItem('captain_table', table)
  }, [table])

  // Get unique categories with item counts
  const categories = useMemo(() => {
    const counts = {}
    MENU_ITEMS.forEach(it => {
      counts[it.category] = (counts[it.category] || 0) + 1
    })
    const uniqueCats = Array.from(new Set(MENU_ITEMS.map(item => item.category))).sort()
    return [
      { name: 'ALL', count: MENU_ITEMS.length },
      ...uniqueCats.map(cat => ({ name: cat, count: counts[cat] || 0 }))
    ]
  }, [])

  // Fetch orders from sync server
  const fetchOrdersFromServer = async () => {
    try {
      const response = await fetch(`${syncServerUrl}/orders`)
      if (!response.ok) throw new Error('Network response not ok')
      const data = await response.json()
      setOrders(Array.isArray(data) ? data : [])
      setSyncStatus('online')
    } catch (error) {
      console.error('Sync fetch error:', error)
      setSyncStatus('offline')
    }
  }

  // Create order in sync server
  const createOrderInSync = async (orderData) => {
    try {
      const response = await fetch(`${syncServerUrl}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      })
      const newOrder = await response.json()
      setOrders(prev => [...prev, newOrder])
      return newOrder
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  }

  // Update order in sync server
  const updateOrderInSync = async (orderId, updates) => {
    try {
      const response = await fetch(`${syncServerUrl}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      const updated = await response.json()
      setOrders(prev => prev.map(o => o.id === orderId ? updated : o))
      return updated
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  }

  // Subscribe to real-time updates via EventSource + Polling fallback
  useEffect(() => {
    fetchOrdersFromServer()
    // 3-second periodic sync prevents dropped orders when mobile screen locks/wakes
    const pollId = setInterval(fetchOrdersFromServer, 3000)

    let eventSource
    try {
      const baseSync = syncServerUrl.replace(/\/api\/?$/, '')
      eventSource = new EventSource(`${baseSync}/api/sync`)
      
      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'ORDER_CREATED' && data.data) {
            setOrders(prev => {
              if (prev.some(o => o.id === data.data.id)) return prev
              return [...prev, data.data]
            })
          } else if (data.type === 'ORDER_UPDATED' && data.data) {
            setOrders(prev => prev.map(o => o.id === data.data.id ? data.data : o))
          } else if (data.type === 'ORDER_DELETED' && data.data) {
            const delId = data.data.id || data.data
            setOrders(prev => prev.filter(o => o.id !== delId))
          } else if (data.type === 'TABLE_CLEARED') {
            const tbl = data.data?.table || data.data?.tableId
            setOrders(prev => prev.filter(o => o.table !== tbl))
          } else if (data.type === 'ALL_CLEARED') {
            setOrders([])
          }
          setSyncStatus('online')
        } catch (error) {
          console.error('Error parsing update:', error)
        }
      })

      eventSource.addEventListener('error', () => {
        setSyncStatus('offline')
      })
    } catch (err) {
      console.error('EventSource connection error:', err)
      setSyncStatus('offline')
    }

    return () => {
      clearInterval(pollId)
      if (eventSource) eventSource.close()
    }
  }, [syncServerUrl])

  // Check print server status
  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${printServerUrl}/status`)
        const data = await response.json()
        setServerStatus(data.status || 'online')
      } catch (error) {
        setServerStatus('offline')
      }
    }
    checkServer()
    const interval = setInterval(checkServer, 10000)
    return () => clearInterval(interval)
  }, [printServerUrl])

  const getNextOrderNumber = () => {
    const timestamp = Date.now()
    return `CAP-${timestamp.toString().slice(-6)}`
  }

  // Cart operations
  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id)
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      } else {
        return [...prev, { ...item, qty: 1 }]
      }
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        const newQty = c.qty + delta
        return newQty > 0 ? { ...c, qty: newQty } : null
      }
      return c
    }).filter(Boolean))
  }

  const removeItem = (id) => {
    setCart(prev => prev.filter(c => c.id !== id))
  }

  const getItemQtyInCart = (id) => {
    const found = cart.find(c => c.id === id)
    return found ? found.qty : 0
  }

  // Table orders and statuses
  const tableOrders = useMemo(() => {
    return orders.filter(order => order.table === table && !order.billed && order.status !== 'billed' && order.status !== 'paid')
  }, [orders, table])

  const isTableOccupied = (tableSlot) => {
    return orders.some(order => order.table === tableSlot && !order.billed && order.status !== 'billed' && order.status !== 'paid')
  }

  const isTableBilled = (tableSlot) => {
    return orders.some(order => order.table === tableSlot && (order.billed || order.status === 'billed') && order.status !== 'paid')
  }

  // Delta items calculation for KOT
  const calculateDeltaItems = () => {
    if (!table) return cart
    const printedItems = tablePrintedItems[table] || []
    const deltaItems = []

    cart.forEach(cartItem => {
      const printedItem = printedItems.find(p => p.id === cartItem.id)
      if (!printedItem) {
        deltaItems.push(cartItem)
      } else if (cartItem.qty > printedItem.quantity) {
        deltaItems.push({
          ...cartItem,
          qty: cartItem.qty - printedItem.quantity
        })
      }
    })

    return deltaItems
  }

  // Initiate KOT confirmation
  const initiateKOT = () => {
    if (cart.length === 0) return

    const deltaItems = calculateDeltaItems()
    if (deltaItems.length === 0) {
      alert('All items in the cart have already been sent to the kitchen!')
      return
    }

    setPendingKOT({
      items: deltaItems,
      table: table,
      waiter: waiter
    })
  }

  // Confirm and send KOT
  const confirmKOT = async () => {
    if (!pendingKOT) return

    const deltaItems = pendingKOT.items
    const orderNumber = getNextOrderNumber()
    const isRunning = (tablePrintedItems[table] || []).length > 0

    const newOrder = {
      orderNumber: orderNumber,
      table: table,
      waiter: waiter,
      items: deltaItems,
      total: deltaItems.reduce((sum, item) => sum + item.price * item.qty, 0),
      timestamp: new Date().toISOString(),
      isRunningOrder: isRunning,
      billed: false,
      source: 'captain-app'
    }

    // Update printed items tracking
    const updatedPrinted = [...(tablePrintedItems[table] || [])]
    cart.forEach(cartItem => {
      const existingIdx = updatedPrinted.findIndex(p => p.id === cartItem.id)
      if (existingIdx >= 0) {
        updatedPrinted[existingIdx].quantity = cartItem.qty
      } else {
        updatedPrinted.push({ id: cartItem.id, quantity: cartItem.qty })
      }
    })

    setTablePrintedItems(prev => ({
      ...prev,
      [table]: updatedPrinted
    }))

    try {
      // 1. Save to Sync Server (Zero cloud, local Wi-Fi sync)
      await createOrderInSync(newOrder)

      // 2. Optionally send to local Print Server if configured
      let printed = false
      try {
        const response = await fetch(`${printServerUrl}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'KOT',
            data: {
              orderNumber: orderNumber,
              table: table,
              waiter: waiter,
              items: deltaItems,
              isRunningOrder: isRunning,
              timestamp: new Date().toLocaleString()
            }
          })
        })
        if (response.ok) printed = true
      } catch (_) {}

      setPendingKOT(null)
      setShowCartDrawer(false)
      setCart([])

      if (printed) {
        alert(`✓ KOT #${orderNumber} sent & printed for Table ${table}!`)
      } else {
        alert(`✓ KOT #${orderNumber} synced to Desktop POS for Table ${table}!`)
      }
    } catch (error) {
      console.error('Error saving order:', error)
      alert('Error sending order. Check Wi-Fi connection to Desktop POS.')
    }
  }

  // Initiate Bill confirmation
  const initiateBill = () => {
    if (cart.length === 0 && tableOrders.length === 0) return

    const allItems = new Map()
    
    // Merge existing running orders
    tableOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = allItems.get(item.id)
        if (existing) {
          existing.qty += item.qty
        } else {
          allItems.set(item.id, { ...item })
        }
      })
    })

    // Merge current cart
    cart.forEach(item => {
      const existing = allItems.get(item.id)
      if (existing) {
        existing.qty += item.qty
      } else {
        allItems.set(item.id, { ...item })
      }
    })

    const mergedItems = Array.from(allItems.values())
    const total = mergedItems.reduce((sum, item) => sum + item.price * item.qty, 0)

    setPendingBill({
      items: mergedItems,
      total: total,
      table: table,
      waiter: waiter
    })
  }

  // Confirm and send Bill
  const confirmBill = async () => {
    if (!pendingBill) return
    const billNumber = getNextOrderNumber()

    try {
      // Mark table orders as billed in sync server
      const unbilledTableOrders = orders.filter(o => o.table === table && !o.billed)
      for (const order of unbilledTableOrders) {
        await updateOrderInSync(order.id, { billed: true })
      }

      // Send to print server
      const response = await fetch(`${printServerUrl}/print`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'BILL',
          data: {
            orderNumber: billNumber,
            table: table,
            waiter: waiter,
            items: pendingBill.items,
            total: pendingBill.total,
            paymentMethod: 'Cash',
            timestamp: new Date().toLocaleString()
          }
        })
      })

      if (response.ok) {
        alert(`✓ Bill #${billNumber} printed for Table ${table}!`)
        setCart([])
        setTablePrintedItems(prev => {
          const updated = { ...prev }
          delete updated[table]
          return updated
        })
        setPendingBill(null)
        setShowCartDrawer(false)
      } else {
        alert('Failed to print Bill on printer.')
      }
    } catch (error) {
      console.error('Error processing bill:', error)
      alert('Error printing bill. Check server connections.')
    }
  }

  // Filtered menu items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return MENU_ITEMS.filter(item => {
      const matchesSearch = !q || item.name.toLowerCase().includes(q)
      const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [search, selectedCategory])

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const cartItemCount = cart.reduce((sum, item) => sum + item.qty, 0)
  const runningTotal = tableOrders.reduce((sum, order) => sum + order.total, 0)
  const grandTotal = cartTotal + runningTotal

  const handleApplyQuickIP = (ipToApply) => {
    const cleanIP = (ipToApply || quickIP).trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '')
    if (!cleanIP) return
    const newSync = `http://${cleanIP}:5000/api`
    const newPrint = `http://${cleanIP}:5001`
    setTempSyncUrl(newSync)
    setTempPrintUrl(newPrint)
    setTestResult(null)
  }

  const handleTestConnection = async () => {
    setTestResult('testing')
    try {
      const cleanUrl = tempSyncUrl.trim()
      const res = await fetch(`${cleanUrl}/health`)
      const data = await res.json()
      if (data?.status === 'ok') {
        setTestResult({ ok: true, msg: `Connected to Desktop POS (${data.localIP || 'Host PC'}) ✅` })
      } else {
        setTestResult({ ok: false, msg: 'Server reached, but status not ok.' })
      }
    } catch (err) {
      setTestResult({ ok: false, msg: 'Cannot connect! Make sure Phone & PC are on the SAME Wi-Fi router.' })
    }
  }

  const handleSaveSettings = () => {
    localStorage.setItem('print_server_url', tempPrintUrl.trim())
    localStorage.setItem('sync_server_url', tempSyncUrl.trim())
    setPrintServerUrl(tempPrintUrl.trim())
    setSyncServerUrl(tempSyncUrl.trim())
    setShowSettingsModal(false)
  }

  return (
    <div className="captain-app">
      {/* Top Navigation Bar */}
      <header className="app-topbar">
        <div className="brand-group">
          <span className="brand-logo">🧑‍✈️</span>
          <div className="brand-text">
            <span className="brand-title">Topi Vappa</span>
            <span className="brand-sub">Captain POS</span>
          </div>
        </div>

        <div className="controls-group">
          {/* Table Selector */}
          <button 
            type="button"
            className="selector-pill table-pill"
            onClick={() => setShowTableModal(true)}
            title="Change Table"
          >
            <span className="pill-icon">📍</span>
            <span className="pill-label">Table:</span>
            <span className="pill-value">{table}</span>
            <span className="pill-arrow">▾</span>
          </button>

          {/* Captain Selector */}
          <button 
            type="button"
            className="selector-pill captain-pill"
            onClick={() => setShowCaptainModal(true)}
            title="Change Waiter/Captain"
          >
            <span className="pill-icon">👤</span>
            <span className="pill-value">{waiter}</span>
            <span className="pill-arrow">▾</span>
          </button>

          {/* Connection Indicators */}
          <div className="status-indicators" title={`Printer: ${serverStatus} | Sync: ${syncStatus}`}>
            <span className={`status-dot ${serverStatus}`} title={`Printer: ${serverStatus}`}>
              🖨️
            </span>
            <span className={`status-dot ${syncStatus}`} title={`Sync: ${syncStatus}`}>
              🔄
            </span>
          </div>

          {/* Settings Button */}
          <button 
            type="button"
            className="icon-btn" 
            onClick={() => setShowSettingsModal(true)}
            title="Server Settings"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Quick Table Switcher Bar */}
      <nav className="table-quick-bar">
        <span className="quick-bar-label">Tables:</span>
        <div className="table-chips-scroll">
          {TABLES.map(t => {
            const isSelected = table === t
            const occupied = isTableOccupied(t)
            const billed = isTableBilled(t)
            return (
              <button
                key={t}
                type="button"
                className={`table-chip ${isSelected ? 'active' : ''} ${occupied ? 'occupied' : ''} ${billed ? 'billed' : ''}`}
                onClick={() => setTable(t)}
              >
                {t}
                {billed ? (
                  <span className="chip-status-dot billed" title="Bill Printed">●</span>
                ) : occupied ? (
                  <span className="chip-status-dot occupied" title="Occupied">●</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Main Two-Column Layout */}
      <main className="main-layout">
        {/* Left Column: Menu & Search */}
        <section className="menu-section">
          {/* Search Bar */}
          <div className="search-bar-wrapper">
            <span className="search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Search biriyani, starters, drinks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button 
                type="button"
                className="search-clear-btn" 
                onClick={() => { setSearch(''); searchInputRef.current?.focus(); }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category Chips Bar */}
          <div className="category-scroll-wrapper">
            <div className="category-chips">
              {categories.map(cat => {
                const isActive = selectedCategory === cat.name
                return (
                  <button
                    key={cat.name}
                    type="button"
                    className={`category-pill ${isActive ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    <span>{cat.name}</span>
                    <span className="cat-count">{cat.count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Items Header */}
          <div className="items-header">
            <span className="category-heading">{selectedCategory}</span>
            <span className="items-count-badge">{filteredItems.length} items</span>
          </div>

          {/* Items Grid */}
          <div className="items-grid">
            {filteredItems.length === 0 ? (
              <div className="no-items-card">
                <span style={{ fontSize: '32px' }}>🍽️</span>
                <p>No items found matching "{search}"</p>
                <button type="button" className="btn-reset" onClick={() => { setSearch(''); setSelectedCategory('ALL'); }}>
                  Reset Filters
                </button>
              </div>
            ) : (
              filteredItems.map(item => {
                const qtyInCart = getItemQtyInCart(item.id)
                const isInCart = qtyInCart > 0

                return (
                  <div
                    key={item.id}
                    className={`menu-card ${isInCart ? 'selected' : ''}`}
                  >
                    <div className="card-top" onClick={() => addToCart(item)}>
                      <span className="card-category">{item.category}</span>
                      <h4 className="card-name">{item.name}</h4>
                      <div className="card-price">₹{item.price}</div>
                    </div>

                    <div className="card-action">
                      {isInCart ? (
                        <div className="stepper-control">
                          <button 
                            type="button" 
                            className="step-btn minus" 
                            onClick={(e) => { e.stopPropagation(); updateQty(item.id, -1); }}
                          >
                            −
                          </button>
                          <span className="step-qty">{qtyInCart}</span>
                          <button 
                            type="button" 
                            className="step-btn plus" 
                            onClick={(e) => { e.stopPropagation(); updateQty(item.id, 1); }}
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button 
                          type="button" 
                          className="btn-add-item" 
                          onClick={() => addToCart(item)}
                        >
                          + Add
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* Right Column: Order Panel (Cart + Running Orders) */}
        <aside className="order-sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">
              <h3>Order Summary</h3>
              <span className="table-badge">Table {table}</span>
            </div>
            <span className="waiter-name">Server: {waiter}</span>
          </div>

          <div className="sidebar-body">
            {/* New Cart Items */}
            <div className="cart-panel">
              <div className="panel-subhead">
                <span>🛒 New Items ({cartItemCount})</span>
                {cart.length > 0 && (
                  <button type="button" className="btn-clear-cart" onClick={() => setCart([])}>
                    Clear
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="empty-cart-hint">
                  <span>Tap items on the left to add to order</span>
                </div>
              ) : (
                <div className="cart-list">
                  {cart.map(item => (
                    <div key={item.id} className="cart-row">
                      <div className="cart-item-details">
                        <span className="cart-item-name">{item.name}</span>
                        <span className="cart-item-price">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</span>
                      </div>
                      <div className="cart-row-controls">
                        <button type="button" className="mini-step-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                        <span className="mini-qty">{item.qty}</span>
                        <button type="button" className="mini-step-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                        <button type="button" className="mini-trash-btn" onClick={() => removeItem(item.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Running Orders (Kitchen / Billed) */}
            {tableOrders.length > 0 && (
              <div className="running-orders-panel">
                <div className="panel-subhead">
                  <span>📋 Running Orders in Kitchen</span>
                  <span className="badge-count">{tableOrders.length} KOTs</span>
                </div>

                <div className="running-orders-list">
                  {tableOrders.map(order => (
                    <div key={order.id} className="running-order-card">
                      <div className="running-order-header">
                        <span className="order-num">#{order.orderNumber}</span>
                        <span className="order-time">{order.timestamp ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                      </div>
                      <div className="running-order-items">
                        {order.items.map((it, idx) => (
                          <div key={idx} className="running-item-line">
                            <span className="running-item-name">{it.name}</span>
                            <span className="running-item-calc">₹{it.price} × {it.qty}</span>
                          </div>
                        ))}
                      </div>
                      <div className="running-order-subtotal">
                        Subtotal: ₹{order.total}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Footer Totals & Actions */}
          <div className="sidebar-footer">
            <div className="totals-breakdown">
              {cart.length > 0 && (
                <div className="total-row sub">
                  <span>New Items:</span>
                  <span>₹{cartTotal}</span>
                </div>
              )}
              {tableOrders.length > 0 && (
                <div className="total-row sub">
                  <span>Running KOTs:</span>
                  <span>₹{runningTotal}</span>
                </div>
              )}
              <div className="total-row grand">
                <span>Grand Total:</span>
                <span className="grand-price">₹{grandTotal}</span>
              </div>
            </div>

            <div className="footer-action-buttons">
              <button 
                type="button"
                className="btn-action btn-kot" 
                onClick={initiateKOT}
                disabled={cart.length === 0}
              >
                🍳 Send KOT ({cartItemCount})
              </button>
              <button 
                type="button"
                className="btn-action btn-bill" 
                onClick={initiateBill}
                disabled={cart.length === 0 && tableOrders.length === 0}
              >
                🧾 Print Bill (₹{grandTotal})
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* Floating Bottom Bar for Mobile (< 960px) */}
      <div className="mobile-bottom-bar">
        <button 
          type="button"
          className="bottom-bar-info"
          onClick={() => setShowCartDrawer(true)}
        >
          <span className="cart-badge-icon">🛒 {cartItemCount}</span>
          <div className="bottom-bar-totals">
            <span className="mobile-table-tag">T-{table}</span>
            <span className="mobile-grand-price">₹{grandTotal}</span>
          </div>
          <span className="expand-hint">View Order ▲</span>
        </button>

        <div className="mobile-quick-actions">
          <button 
            type="button" 
            className="btn-mobile-kot"
            disabled={cart.length === 0}
            onClick={initiateKOT}
          >
            🍳 KOT
          </button>
          <button 
            type="button" 
            className="btn-mobile-bill"
            disabled={cart.length === 0 && tableOrders.length === 0}
            onClick={initiateBill}
          >
            🧾 Bill
          </button>
        </div>
      </div>

      {/* Mobile Drawer (Bottom Sheet) */}
      {showCartDrawer && (
        <div className="modal-backdrop" onClick={() => setShowCartDrawer(false)}>
          <div className="cart-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div className="drawer-title">
                <h3>Table {table} Order</h3>
                <span className="drawer-waiter">Captain: {waiter}</span>
              </div>
              <button type="button" className="btn-close-modal" onClick={() => setShowCartDrawer(false)}>
                ✕
              </button>
            </div>

            <div className="drawer-body">
              {/* New Cart Items */}
              <div className="cart-panel">
                <div className="panel-subhead">
                  <span>🛒 New Items ({cartItemCount})</span>
                  {cart.length > 0 && (
                    <button type="button" className="btn-clear-cart" onClick={() => setCart([])}>
                      Clear
                    </button>
                  )}
                </div>

                {cart.length === 0 ? (
                  <div className="empty-cart-hint">
                    <span>No new items added yet</span>
                  </div>
                ) : (
                  <div className="cart-list">
                    {cart.map(item => (
                      <div key={item.id} className="cart-row">
                        <div className="cart-item-details">
                          <span className="cart-item-name">{item.name}</span>
                          <span className="cart-item-price">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</span>
                        </div>
                        <div className="cart-row-controls">
                          <button type="button" className="mini-step-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                          <span className="mini-qty">{item.qty}</span>
                          <button type="button" className="mini-step-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                          <button type="button" className="mini-trash-btn" onClick={() => removeItem(item.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Running Orders */}
              {tableOrders.length > 0 && (
                <div className="running-orders-panel" style={{ marginTop: '16px' }}>
                  <div className="panel-subhead">
                    <span>📋 Running Orders in Kitchen</span>
                    <span className="badge-count">{tableOrders.length} KOTs</span>
                  </div>

                  <div className="running-orders-list">
                    {tableOrders.map(order => (
                      <div key={order.id} className="running-order-card">
                        <div className="running-order-header">
                          <span className="order-num">#{order.orderNumber}</span>
                          <span className="order-time">{order.timestamp ? new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <div className="running-order-items">
                          {order.items.map((it, idx) => (
                            <div key={idx} className="running-item-line">
                              <span className="running-item-name">{it.name}</span>
                              <span className="running-item-calc">₹{it.price} × {it.qty}</span>
                            </div>
                          ))}
                        </div>
                        <div className="running-order-subtotal">
                          Subtotal: ₹{order.total}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="drawer-footer">
              <div className="totals-breakdown">
                <div className="total-row grand">
                  <span>Grand Total:</span>
                  <span className="grand-price">₹{grandTotal}</span>
                </div>
              </div>
              <div className="footer-action-buttons">
                <button 
                  type="button"
                  className="btn-action btn-kot" 
                  onClick={initiateKOT}
                  disabled={cart.length === 0}
                >
                  🍳 Send KOT ({cartItemCount})
                </button>
                <button 
                  type="button"
                  className="btn-action btn-bill" 
                  onClick={initiateBill}
                  disabled={cart.length === 0 && tableOrders.length === 0}
                >
                  🧾 Print Bill (₹{grandTotal})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Picker Modal */}
      {showTableModal && (
        <div className="modal-backdrop" onClick={() => setShowTableModal(false)}>
          <div className="dialog-modal table-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Select Dining Table</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowTableModal(false)}>✕</button>
            </div>
            <div className="table-picker-grid">
              {TABLES.map(t => {
                const isSelected = table === t
                const occupied = isTableOccupied(t)
                const billed = isTableBilled(t)

                return (
                  <button
                    key={t}
                    type="button"
                    className={`dialog-table-btn ${isSelected ? 'selected' : ''} ${occupied ? 'occupied' : ''} ${billed ? 'billed' : ''}`}
                    onClick={() => {
                      setTable(t)
                      setShowTableModal(false)
                    }}
                  >
                    <span className="table-btn-title">{t}</span>
                    <span className="table-btn-state">
                      {billed ? '🔴 Billed' : occupied ? '👥 Active' : '🟢 Free'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Captain Picker Modal */}
      {showCaptainModal && (
        <div className="modal-backdrop" onClick={() => setShowCaptainModal(false)}>
          <div className="dialog-modal captain-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Select Waiter / Captain</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowCaptainModal(false)}>✕</button>
            </div>
            <div className="captain-picker-list">
              {CAPTAINS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`captain-picker-btn ${waiter === c ? 'selected' : ''}`}
                  onClick={() => {
                    setWaiter(c)
                    setShowCaptainModal(false)
                  }}
                >
                  <span className="captain-avatar">👤</span>
                  <span className="captain-title">{c}</span>
                  {waiter === c && <span className="captain-check">✓ Active</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KOT Confirmation Modal */}
      {pendingKOT && (
        <div className="modal-backdrop" onClick={() => setPendingKOT(null)}>
          <div className="dialog-modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Confirm Kitchen Order (KOT)</h3>
              <button type="button" className="btn-close-modal" onClick={() => setPendingKOT(null)}>✕</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-meta">
                <span>📍 Table: <strong>{pendingKOT.table}</strong></span>
                <span>👤 Waiter: <strong>{pendingKOT.waiter}</strong></span>
              </div>
              <p className="confirm-note">Send the following new items to the kitchen printer?</p>
              <div className="confirm-items-list">
                {pendingKOT.items.map((item, idx) => (
                  <div key={idx} className="confirm-item-row">
                    <span className="confirm-item-name">{item.name}</span>
                    <span className="confirm-item-qty">× {item.qty}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="btn-secondary" onClick={() => setPendingKOT(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={confirmKOT}>
                ✓ Confirm & Send KOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Confirmation Modal */}
      {pendingBill && (
        <div className="modal-backdrop" onClick={() => setPendingBill(null)}>
          <div className="dialog-modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>Confirm Final Bill</h3>
              <button type="button" className="btn-close-modal" onClick={() => setPendingBill(null)}>✕</button>
            </div>
            <div className="confirm-body">
              <div className="confirm-meta">
                <span>📍 Table: <strong>{pendingBill.table}</strong></span>
                <span>👤 Server: <strong>{pendingBill.waiter}</strong></span>
              </div>
              <div className="confirm-items-list">
                {pendingBill.items.map((item, idx) => (
                  <div key={idx} className="confirm-item-row">
                    <span className="confirm-item-name">{item.name}</span>
                    <span className="confirm-item-qty">₹{item.price} × {item.qty} = ₹{item.price * item.qty}</span>
                  </div>
                ))}
              </div>
              <div className="confirm-grand-total">
                <span>Grand Total Amount:</span>
                <span className="amount">₹{pendingBill.total}</span>
              </div>
            </div>
            <div className="dialog-footer">
              <button type="button" className="btn-secondary" onClick={() => setPendingBill(null)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={confirmBill}>
                🧾 Print Receipt Bill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Server Settings Modal */}
      {showSettingsModal && (
        <div className="modal-backdrop" onClick={() => setShowSettingsModal(false)}>
          <div className="dialog-modal settings-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>📡 Wi-Fi POS Server Setup</h3>
              <button type="button" className="btn-close-modal" onClick={() => setShowSettingsModal(false)}>✕</button>
            </div>
            <div className="settings-body">
              <p className="settings-hint">
                Connect your mobile phone to the <strong>same Wi-Fi router</strong> as the Desktop PC. Zero cloud needed!
              </p>

              {/* Quick Wi-Fi IP Auto Config */}
              <div className="form-group" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                <label style={{ fontWeight: 'bold', color: '#1e293b' }}>⚡ Desktop PC IP Address:</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    className="settings-input"
                    value={quickIP}
                    onChange={(e) => setQuickIP(e.target.value)}
                    placeholder="e.g. 192.168.1.6"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
                    onClick={() => handleApplyQuickIP(quickIP)}
                  >
                    Apply IP
                  </button>
                </div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                  (Find this IP in the top green banner of the Desktop POS screen)
                </span>
              </div>

              {/* Test Connection Button & Status */}
              <div style={{ margin: '14px 0' }}>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #3b82f6',
                    background: testResult === 'testing' ? '#93c5fd' : '#eff6ff',
                    color: '#1d4ed8',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  {testResult === 'testing' ? '⏳ Testing Wi-Fi Connection...' : '🧪 Test Connection to Desktop POS'}
                </button>
                {testResult && testResult !== 'testing' && (
                  <div
                    style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: testResult.ok ? '#d1fae5' : '#fee2e2',
                      color: testResult.ok ? '#065f46' : '#991b1b',
                    }}
                  >
                    {testResult.msg}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Sync Server API URL (Port 5000):</label>
                <input
                  type="text"
                  className="settings-input"
                  value={tempSyncUrl}
                  onChange={(e) => setTempSyncUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.6:5000/api"
                />
              </div>
              <div className="form-group">
                <label>Print Server URL (Port 5001):</label>
                <input
                  type="text"
                  className="settings-input"
                  value={tempPrintUrl}
                  onChange={(e) => setTempPrintUrl(e.target.value)}
                  placeholder="e.g. http://192.168.1.6:5001"
                />
              </div>
            </div>
            <div className="dialog-footer">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  setTempSyncUrl(DEFAULT_SYNC_SERVER)
                  setTempPrintUrl(DEFAULT_PRINT_SERVER)
                  setTestResult(null)
                }}
              >
                Reset Default
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveSettings}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
