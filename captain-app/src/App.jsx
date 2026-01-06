import { useState, useEffect } from 'react'
import './App.css'
import { items as MENU_ITEMS } from './data/items.js'

const PRINT_SERVER_URL = 'http://localhost:5001'
const SYNC_SERVER_URL = 'http://localhost:5000/api'
const TABLES = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3', 'C4', 'F1', 'F2', 'F4', 'Parcel']

function App() {
  const [waiter, setWaiter] = useState('')
  const [table, setTable] = useState('')
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [serverStatus, setServerStatus] = useState('unknown')
  const [syncStatus, setSyncStatus] = useState('unknown')
  const [orders, setOrders] = useState([]) // Synced from server
  const [tablePrintedItems, setTablePrintedItems] = useState({})
  const [pendingKOT, setPendingKOT] = useState(null)
  const [pendingBill, setPendingBill] = useState(null)

  // Get unique categories
  const getCategories = () => {
    const categories = new Set(MENU_ITEMS.map(item => item.category))
    return ['ALL', ...Array.from(categories).sort()]
  }

  // Fetch orders from sync server
  const fetchOrdersFromServer = async () => {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/orders`)
      const data = await response.json()
      setOrders(data)
      setSyncStatus('online')
    } catch (error) {
      console.error('Sync fetch error:', error)
      setSyncStatus('offline')
    }
  }

  // Create order in sync server
  const createOrderInSync = async (orderData) => {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/orders`, {
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
      const response = await fetch(`${SYNC_SERVER_URL}/orders/${orderId}`, {
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

  // Subscribe to real-time updates
  useEffect(() => {
    // Initial fetch
    fetchOrdersFromServer()

    // Subscribe to updates
    const eventSource = new EventSource(`${SYNC_SERVER_URL.replace('/api', '')}/api/sync`)
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'ORDER_CREATED') {
          setOrders(prev => [...prev, data.data])
        } else if (data.type === 'ORDER_UPDATED') {
          setOrders(prev => prev.map(o => o.id === data.data.id ? data.data : o))
        } else if (data.type === 'ORDER_DELETED') {
          setOrders(prev => prev.filter(o => o.id !== data.data.id))
        } else if (data.type === 'TABLE_CLEARED') {
          setOrders(prev => prev.filter(o => o.table !== data.data.table))
        }
      } catch (error) {
        console.error('Error parsing update:', error)
      }
    })

    eventSource.addEventListener('error', () => {
      setSyncStatus('offline')
    })

    return () => eventSource.close()
  }, [])

  const goHome = () => {
    setWaiter('')
    setTable('')
    setCart([])
    setSearch('')
    setPendingKOT(null)
    setPendingBill(null)
  }

  const getNextOrderNumber = () => {
    const timestamp = Date.now()
    return `CAP-${timestamp.toString().slice(-6)}`
  }

  useEffect(() => {
    const checkServer = async () => {
      try {
        const response = await fetch(`${PRINT_SERVER_URL}/status`)
        const data = await response.json()
        setServerStatus(data.status)
      } catch (error) {
        setServerStatus('offline')
      }
    }
    checkServer()
    const interval = setInterval(checkServer, 10000)
    return () => clearInterval(interval)
  }, [])

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, { ...item, qty: 1 }])
    }
  }

  const updateQty = (id, delta) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQty = c.qty + delta
        return newQty > 0 ? { ...c, qty: newQty } : null
      }
      return c
    }).filter(Boolean))
  }

  // Get all orders for current table
  const getTableOrders = () => {
    return orders.filter(order => order.table === table && !order.billed)
  }

  // Check if table has any active orders
  const isTableOccupied = (tableSlot) => {
    return orders.some(order => order.table === tableSlot && !order.billed)
  }

  // Check if table has billed orders (pending payment) - shows red notification
  const getTableStatus = (tableSlot) => {
    return orders.some(order => order.table === tableSlot && order.billed)
  }

  // Calculate delta items (only new items not yet printed)
  const calculateDeltaItems = () => {
    if (!table) return cart
    
    const printedItems = tablePrintedItems[table] || []
    const deltaItems = []

    cart.forEach(cartItem => {
      const printedItem = printedItems.find(p => p.id === cartItem.id)
      if (!printedItem) {
        // Item never printed, add all quantity
        deltaItems.push(cartItem)
      } else if (cartItem.qty > printedItem.quantity) {
        // Item printed before, but quantity increased
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
      alert('No new items to send to kitchen')
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

    // Create order record
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

    // Save to sync server
    try {
      await createOrderInSync(newOrder)

      // Send to printer
      const response = await fetch(`${PRINT_SERVER_URL}/print`, {
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

      if (response.ok) {
        alert(`KOT ${orderNumber} sent to kitchen!`)
        setPendingKOT(null)
      } else {
        alert('Failed to print KOT')
      }
    } catch (error) {
      console.error('Error saving order:', error)
      alert('Failed to save order')
    }
  }

  // Initiate Bill confirmation
  const initiateBill = () => {
    const tableOrders = getTableOrders()
    if (cart.length === 0 && tableOrders.length === 0) return

    // Merge all orders
    const allItems = new Map()
    
    // Add existing orders
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

    // Add current cart
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

    // Mark all table orders as billed in sync server
    try {
      const tableOrders = orders.filter(o => o.table === table && !o.billed)
      
      for (const order of tableOrders) {
        await updateOrderInSync(order.id, { billed: true })
      }

      // Send to printer
      const response = await fetch(`${PRINT_SERVER_URL}/print`, {
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
        alert(`Bill ${billNumber} printed for ${table}!`)
        // Clear table data
        setCart([])
        setTablePrintedItems(prev => {
          const updated = { ...prev }
          delete updated[table]
          return updated
        })
        setPendingBill(null)
        setTable('')
      } else {
        alert('Failed to print Bill')
      }
    } catch (error) {
      console.error('Error marking orders as billed:', error)
      alert('Failed to process bill')
    }
  }

  const filteredItems = MENU_ITEMS.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0)
  const tableOrders = getTableOrders()
  const runningTotal = tableOrders.reduce((sum, order) => sum + order.total, 0)
  const combinedTotal = cartTotal + runningTotal

  return (
    <div className="captain-app">
      <header className="app-header">
        <div className="header-top">
          <h1>🧑‍✈️ Captain App</h1>
          {(waiter || table) && (
            <button className="btn-home" onClick={goHome} title="Go to Home">
              🏠 Home
            </button>
          )}
        </div>
        <p className="subtitle">Quick Order & Print System</p>
        <div style={{ marginTop: '12px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <span className={`status-badge ${serverStatus}`}>
            Print Server: {serverStatus}
          </span>
          <span className={`status-badge ${syncStatus}`}>
            Sync Server: {syncStatus}
          </span>
        </div>
      </header>

      {!waiter && (
        <div className="waiter-select">
          <h2>Select Waiter</h2>
          <div className="waiter-buttons">
            <button className="waiter-btn" onClick={() => setWaiter('Waiter 1')}>Waiter 1</button>
            <button className="waiter-btn" onClick={() => setWaiter('Waiter 2')}>Waiter 2</button>
            <button className="waiter-btn" onClick={() => setWaiter('Waiter 3')}>Waiter 3</button>
            <button className="waiter-btn" onClick={() => setWaiter('Waiter 4')}>Waiter 4</button>
          </div>
        </div>
      )}

      {waiter && !table && (
        <div className="table-select">
          <h2>Serving: {waiter} - Select Table</h2>
          <div className="table-grid">
            {TABLES.map(t => {
              const isOccupied = isTableOccupied(t)
              const hasBilledOrders = getTableStatus(t)
              
              return (
                <button 
                  key={t} 
                  className={`table-btn ${isOccupied ? 'occupied' : ''} ${hasBilledOrders ? 'has-pending' : ''}`}
                  onClick={() => setTable(t)}
                >
                  {isOccupied && <span className="occupied-icon">👥</span>}
                  {hasBilledOrders && <span className="pending-badge">●</span>}
                  {t}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {waiter && table && (
        <>
          <div className="order-builder">
            <h2>Table: {table} | Waiter: {waiter}</h2>
            <input
              type="text"
              className="search-box"
              placeholder="Search items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            
            {/* Category Filter */}
            <div className="category-filter">
              <div className="category-list">
                {getCategories().map(cat => (
                  <button
                    key={cat}
                    className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="items-grid">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="item-card"
                  onClick={() => addToCart(item)}
                >
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">₹{item.price}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Running Orders Display */}
          {tableOrders.length > 0 && (
            <div className="running-orders">
              <h3>📋 Running Orders</h3>
              {tableOrders.map((order, idx) => (
                <div key={order.id} className="running-order-item">
                  <div className="order-badge">
                    {order.isRunningOrder && '🔄 '} Order #{order.orderNumber}
                  </div>
                  <div className="order-items">
                    {order.items.map((item, i) => (
                      <div key={i} className="order-item-row">
                        <span>{item.name}</span>
                        <span>₹{item.price} × {item.qty} = ₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>
                  <div className="order-subtotal">
                    Subtotal: ₹{order.total}
                  </div>
                </div>
              ))}
              <div className="running-total">
                <strong>Running Total: ₹{runningTotal}</strong>
              </div>
            </div>
          )}

          <div className="cart">
            <h2>Current Cart</h2>
            {cart.length === 0 ? (
              <div className="cart-empty">No items added yet</div>
            ) : (
              <>
                <div className="cart-items">
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-left">
                        <div>{item.name}</div>
                        <div style={{ color: '#fbbf24' }}>₹{item.price} × {item.qty} = ₹{item.price * item.qty}</div>
                      </div>
                      <div className="cart-item-controls">
                        <button className="qty-btn" onClick={() => updateQty(item.id, -1)}>−</button>
                        <span className="qty-display">{item.qty}</span>
                        <button className="qty-btn" onClick={() => updateQty(item.id, 1)}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cart-total">
                  <span>Cart Total:</span>
                  <span>₹{cartTotal}</span>
                </div>
              </>
            )}

            {(tableOrders.length > 0 || cart.length > 0) && (
              <div className="combined-total">
                <span>Grand Total:</span>
                <span>₹{combinedTotal}</span>
              </div>
            )}

            <div className="action-buttons">
              <button 
                className="btn btn-secondary" 
                onClick={initiateKOT}
                disabled={cart.length === 0}
              >
                Save & KOT
              </button>
              <button 
                className="btn btn-primary" 
                onClick={initiateBill}
                disabled={cart.length === 0 && tableOrders.length === 0}
              >
                Print Bill
              </button>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => { setTable(''); setCart([]); }}
              style={{ maxWidth: '300px' }}
            >
              Change Table
            </button>
          </div>
        </>
      )}

      {/* KOT Confirmation Modal */}
      {pendingKOT && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm KOT</h2>
            <p>Send the following items to kitchen?</p>
            <div className="modal-items">
              {pendingKOT.items.map((item, idx) => (
                <div key={idx} className="modal-item-row">
                  <span>{item.name}</span>
                  <span>× {item.qty}</span>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setPendingKOT(null)}>
                Cancel
              </button>
              <button className="btn btn-confirm" onClick={confirmKOT}>
                Confirm KOT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Confirmation Modal */}
      {pendingBill && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Confirm Bill</h2>
            <p>Print bill for Table {pendingBill.table}?</p>
            <div className="modal-items">
              {pendingBill.items.map((item, idx) => (
                <div key={idx} className="modal-item-row">
                  <span>{item.name}</span>
                  <span>₹{item.price} × {item.qty} = ₹{item.price * item.qty}</span>
                </div>
              ))}
            </div>
            <div className="modal-total">
              <strong>Total: ₹{pendingBill.total}</strong>
            </div>
            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={() => setPendingBill(null)}>
                Cancel
              </button>
              <button className="btn btn-confirm" onClick={confirmBill}>
                Print Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
