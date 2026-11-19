import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { v4 as uuidv4 } from 'uuid'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT_FILE = path.join(__dirname, '.system_audit_vault.json')
const VAULT_CONFIG_FILE = path.join(__dirname, '.vault_config.json')

// Default master PIN is '7788'
export function getOwnerPin() {
  try {
    if (fs.existsSync(VAULT_CONFIG_FILE)) {
      const cfg = JSON.parse(fs.readFileSync(VAULT_CONFIG_FILE, 'utf-8'))
      if (cfg && cfg.pin) return String(cfg.pin).trim()
    }
  } catch (_) {}
  return '7788'
}

export function setOwnerPin(newPin) {
  try {
    const cleanPin = String(newPin).trim()
    if (!cleanPin || cleanPin.length < 4) return false
    fs.writeFileSync(
      VAULT_CONFIG_FILE,
      JSON.stringify({ pin: cleanPin, updatedAt: new Date().toISOString() }, null, 2),
      'utf-8'
    )
    return true
  } catch (err) {
    console.error('Failed to set vault pin:', err)
    return false
  }
}

export function verifyPin(pin) {
  if (!pin) return false
  return String(pin).trim() === getOwnerPin()
}

export function loadVaultRecords() {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const data = fs.readFileSync(VAULT_FILE, 'utf-8')
      const parsed = JSON.parse(data)
      if (Array.isArray(parsed)) return parsed
    }
  } catch (err) {
    console.error('Error loading vault records:', err)
  }
  return []
}

export function saveVaultRecords(records) {
  try {
    fs.writeFileSync(VAULT_FILE, JSON.stringify(records, null, 2), 'utf-8')
    return true
  } catch (err) {
    console.error('Error saving vault records:', err)
    return false
  }
}

/**
 * Record items from an order or bill into the stealth vault.
 * This is append-only and completely isolated from cashier clear operations.
 */
export function recordItemsToVault(orderData, source = 'order') {
  if (!orderData) return false
  const items =
    orderData.items ||
    (orderData.item
      ? [{ name: orderData.item, qty: orderData.qty, price: orderData.price, category: orderData.category }]
      : [])

  if (!Array.isArray(items) || items.length === 0) return false

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}`
  const timeStr = now.toLocaleTimeString('en-IN', { hour12: false })

  const vault = loadVaultRecords()
  const newRecords = []

  items.forEach((item) => {
    const qty = Number(item.qty || item.quantity || 1)
    const price = Number(item.price || 0)
    const total = Number((qty * price).toFixed(2))
    const dishName = String(item.name || item.dish || 'Unnamed Dish').trim()
    const category = String(item.category || 'General').trim()

    newRecords.push({
      id: uuidv4(),
      orderId: String(orderData.id || ''),
      orderNumber: String(orderData.orderNumber || orderData.id?.slice(0, 8) || 'N/A'),
      table: String(orderData.table || 'Parcel'),
      customer: String(orderData.customer || 'Walk-in'),
      waiter: String(orderData.waiter || orderData.captain || 'Counter'),
      paymentMethod: String(orderData.paymentMethod || orderData.payment || 'N/A'),
      dishName,
      category,
      qty,
      price,
      total,
      date: dateStr,
      time: timeStr,
      timestamp: now.toISOString(),
      entryType: source, // 'order' (KOT) or 'bill' (Settled)
    })
  })

  if (newRecords.length > 0) {
    vault.push(...newRecords)
    saveVaultRecords(vault)
    return true
  }
  return false
}

/**
 * Get aggregated statistics & itemized records for owner view.
 */
export function getVaultAnalytics({ pin, from, to, dish, type, search } = {}) {
  if (!verifyPin(pin)) return null

  let records = loadVaultRecords()

  // Filter by date range
  if (from) {
    records = records.filter((r) => r.date >= from)
  }
  if (to) {
    records = records.filter((r) => r.date <= to)
  }

  // Filter by type ('order' or 'bill')
  if (type && type !== 'all') {
    records = records.filter((r) => r.entryType === type)
  }

  // Filter by search keyword (dish name, order #, table)
  if (search) {
    const q = search.toLowerCase().trim()
    records = records.filter(
      (r) =>
        r.dishName.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.orderNumber.toLowerCase().includes(q) ||
        r.table.toLowerCase().includes(q)
    )
  }

  // Calculate totals
  const totalRecords = records.length
  let totalQuantity = 0
  let totalRevenue = 0
  const uniqueOrderSet = new Set()

  // Aggregators
  const dishMap = new Map()
  const dateMap = new Map()

  records.forEach((r) => {
    totalQuantity += r.qty
    totalRevenue += r.total
    if (r.orderNumber) uniqueOrderSet.add(r.orderNumber)

    // Dish aggregation
    const dishKey = r.dishName.toLowerCase()
    if (!dishMap.has(dishKey)) {
      dishMap.set(dishKey, {
        dishName: r.dishName,
        category: r.category,
        totalQty: 0,
        totalRevenue: 0,
        unitPrice: r.price,
        orderCount: 0,
      })
    }
    const d = dishMap.get(dishKey)
    d.totalQty += r.qty
    d.totalRevenue += r.total
    d.orderCount += 1

    // Date aggregation
    if (!dateMap.has(r.date)) {
      dateMap.set(r.date, {
        date: r.date,
        ordersCount: new Set(),
        dishesSold: 0,
        totalRevenue: 0,
      })
    }
    const dt = dateMap.get(r.date)
    dt.ordersCount.add(r.orderNumber)
    dt.dishesSold += r.qty
    dt.totalRevenue += r.total
  })

  // Format rankings sorted by quantity sold descending
  const dishRankings = Array.from(dishMap.values())
    .map((d) => ({
      ...d,
      totalRevenue: Number(d.totalRevenue.toFixed(2)),
      sharePercent: totalQuantity > 0 ? Number(((d.totalQty / totalQuantity) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.totalQty - a.totalQty)

  // Format daily breakdown sorted by date descending
  const dailySummary = Array.from(dateMap.values())
    .map((dt) => ({
      date: dt.date,
      ordersCount: dt.ordersCount.size,
      dishesSold: dt.dishesSold,
      totalRevenue: Number(dt.totalRevenue.toFixed(2)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    success: true,
    totalRecords,
    totalOrders: uniqueOrderSet.size,
    totalQuantity,
    totalRevenue: Number(totalRevenue.toFixed(2)),
    topDish: dishRankings[0] || null,
    dishRankings,
    dailySummary,
    records: records.slice().reverse(), // newest first
  }
}

/**
 * Delete / Purge records by owner command
 */
export function purgeVaultRecords({ pin, deleteType = 'all', targetDate } = {}) {
  if (!verifyPin(pin)) return { success: false, error: 'Unauthorized PIN' }

  let records = loadVaultRecords()
  const initialCount = records.length

  if (deleteType === 'all') {
    saveVaultRecords([])
    return { success: true, deleted: initialCount, remaining: 0 }
  } else if (deleteType === 'date' && targetDate) {
    records = records.filter((r) => r.date !== targetDate)
    saveVaultRecords(records)
    return { success: true, deleted: initialCount - records.length, remaining: records.length }
  } else if (deleteType === 'olderThanDays' && typeof targetDate === 'number') {
    const cutoff = new Date(Date.now() - targetDate * 86400000).toISOString().slice(0, 10)
    records = records.filter((r) => r.date >= cutoff)
    saveVaultRecords(records)
    return { success: true, deleted: initialCount - records.length, remaining: records.length }
  }

  return { success: false, error: 'Invalid delete options' }
}

/**
 * Generate Excel-compatible CSV string
 */
export function generateVaultCSV({ pin, from, to, type } = {}) {
  if (!verifyPin(pin)) return null

  let records = loadVaultRecords()
  if (from) records = records.filter((r) => r.date >= from)
  if (to) records = records.filter((r) => r.date <= to)
  if (type && type !== 'all') records = records.filter((r) => r.entryType === type)

  // UTF-8 BOM for Microsoft Excel auto-detect
  let csv = '\uFEFF'
  csv += 'Date,Time,Order Number,Table,Dish Name,Category,Quantity,Unit Price (INR),Total Amount (INR),Staff / Waiter,Customer,Payment Method,Type\r\n'

  records.forEach((r) => {
    const clean = (val) => `"${String(val || '').replace(/"/g, '""')}"`
    csv += [
      clean(r.date),
      clean(r.time),
      clean(r.orderNumber),
      clean(r.table),
      clean(r.dishName),
      clean(r.category),
      r.qty,
      r.price,
      r.total,
      clean(r.waiter),
      clean(r.customer),
      clean(r.paymentMethod),
      clean(r.entryType),
    ].join(',') + '\r\n'
  })

  return csv
}

/**
 * Self-contained HTML executive dashboard for owner viewing on PC or mobile phone
 */
export function renderVaultDashboardHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Topi Vappa - Executive Audit Vault</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background: #0b0f19; color: #f3f4f6; min-height: 100vh; padding-bottom: 40px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 16px; }
    
    /* Header */
    header { background: #111827; border-bottom: 1px solid #1f2937; padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 50; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 1.15rem; color: #f97316; }
    .badge-stealth { background: #1e1b4b; color: #a5b4fc; font-size: 0.72rem; padding: 4px 8px; border-radius: 6px; border: 1px solid #3730a3; letter-spacing: 0.5px; }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .btn { background: #1f2937; color: #e5e7eb; border: 1px solid #374151; padding: 8px 14px; border-radius: 8px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn:hover { background: #374151; border-color: #4b5563; }
    .btn-primary { background: #f97316; color: #fff; border-color: #ea580c; }
    .btn-primary:hover { background: #ea580c; }
    .btn-danger { background: #991b1b; color: #fecaca; border-color: #b91c1c; }
    .btn-danger:hover { background: #b91c1c; }

    /* Lock Screen */
    #lockScreen { position: fixed; inset: 0; background: #0b0f19; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .pin-box { background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 32px 24px; width: 100%; max-width: 360px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.7); }
    .pin-icon { font-size: 2.5rem; margin-bottom: 12px; }
    .pin-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 6px; }
    .pin-sub { color: #9ca3af; font-size: 0.85rem; margin-bottom: 24px; }
    .pin-input { width: 100%; padding: 14px; font-size: 1.6rem; text-align: center; letter-spacing: 8px; background: #030712; border: 2px solid #374151; border-radius: 10px; color: #fff; margin-bottom: 16px; outline: none; }
    .pin-input:focus { border-color: #f97316; }
    .numpad { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
    .num-btn { background: #1f2937; border: 1px solid #374151; color: #fff; font-size: 1.25rem; font-weight: 600; padding: 14px 0; border-radius: 10px; cursor: pointer; transition: 0.1s; }
    .num-btn:active { background: #f97316; }
    .pin-err { color: #f87171; font-size: 0.82rem; margin-top: 8px; min-height: 20px; }

    /* Dashboard Layout */
    .dashboard { display: none; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 20px; }
    .kpi-card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 18px; position: relative; overflow: hidden; }
    .kpi-card::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; }
    .kpi-1::before { background: #10b981; }
    .kpi-2::before { background: #3b82f6; }
    .kpi-3::before { background: #f97316; }
    .kpi-4::before { background: #8b5cf6; }
    .kpi-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.6px; color: #9ca3af; font-weight: 600; }
    .kpi-val { font-size: 1.8rem; font-weight: 800; color: #f9fafb; margin-top: 6px; }
    .kpi-sub { font-size: 0.78rem; color: #6b7280; margin-top: 4px; }

    /* Filters */
    .filters-bar { background: #111827; border: 1px solid #1f2937; border-radius: 12px; padding: 14px; margin-top: 16px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between; }
    .filter-chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip { background: #1f2937; border: 1px solid #374151; color: #d1d5db; padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
    .chip.active { background: #f97316; color: #fff; border-color: #ea580c; }
    .date-pickers { display: flex; gap: 8px; align-items: center; font-size: 0.82rem; }
    .date-pickers input { background: #030712; border: 1px solid #374151; color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 0.82rem; }
    .search-box { width: 100%; margin-top: 10px; display: flex; gap: 10px; }
    .search-input { flex: 1; background: #030712; border: 1px solid #374151; border-radius: 8px; padding: 10px 14px; color: #fff; font-size: 0.9rem; outline: none; }
    .search-input:focus { border-color: #f97316; }

    /* Tabs */
    .tabs-bar { display: flex; gap: 8px; border-bottom: 1px solid #1f2937; margin-top: 24px; padding-bottom: 2px; }
    .tab-btn { background: none; border: none; color: #9ca3af; font-size: 0.95rem; font-weight: 600; padding: 8px 16px; cursor: pointer; border-bottom: 3px solid transparent; }
    .tab-btn.active { color: #f97316; border-bottom-color: #f97316; }

    /* Table */
    .table-card { background: #111827; border: 1px solid #1f2937; border-radius: 12px; margin-top: 14px; overflow: hidden; }
    .table-wrap { overflow-x: auto; max-height: 600px; }
    table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.88rem; }
    thead th { background: #1f2937; color: #9ca3af; font-weight: 600; padding: 12px 14px; position: sticky; top: 0; z-index: 10; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.5px; }
    tbody td { padding: 12px 14px; border-bottom: 1px solid #1f2937; color: #e5e7eb; }
    tbody tr:hover { background: #161e2e; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; }
    .badge-category { background: #1e293b; color: #94a3b8; }
    .badge-qty { background: #064e3b; color: #6ee7b7; font-weight: 700; padding: 3px 10px; border-radius: 12px; }
    .badge-rev { color: #10b981; font-weight: 700; }
    .progress-track { background: #1f2937; height: 6px; border-radius: 3px; overflow: hidden; width: 80px; margin-top: 4px; }
    .progress-fill { background: #f97316; height: 100%; border-radius: 3px; }

    /* Modal */
    .modal-backdrop { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 150; align-items: center; justify-content: center; padding: 20px; }
    .modal-box { background: #111827; border: 1px solid #1f2937; border-radius: 14px; max-width: 440px; width: 100%; padding: 24px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    .modal-title { font-size: 1.15rem; font-weight: 700; margin-bottom: 12px; color: #fff; }
    .modal-body { font-size: 0.88rem; color: #9ca3af; line-height: 1.5; margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; }

    @media (max-width: 768px) {
      .header-actions .btn-text { display: none; }
      .kpi-grid { grid-template-columns: 1fr 1fr; }
      .kpi-val { font-size: 1.4rem; }
    }
  </style>
</head>
<body>

  <!-- Lock Screen -->
  <div id="lockScreen">
    <div class="pin-box">
      <div class="pin-icon">🔐</div>
      <h1 class="pin-title">Owner Audit Vault</h1>
      <p class="pin-sub">Enter owner passcode to view stealth sales & dish analytics</p>
      <input type="password" id="pinInput" class="pin-input" maxlength="8" placeholder="••••" autocomplete="off" />
      <div id="pinErr" class="pin-err"></div>
      <button class="btn btn-primary" style="width: 100%; padding: 12px 0; font-size: 1rem; justify-content: center;" onclick="submitPin()">
        Unlock Vault
      </button>

      <div class="numpad">
        <button class="num-btn" onclick="pressNum('1')">1</button>
        <button class="num-btn" onclick="pressNum('2')">2</button>
        <button class="num-btn" onclick="pressNum('3')">3</button>
        <button class="num-btn" onclick="pressNum('4')">4</button>
        <button class="num-btn" onclick="pressNum('5')">5</button>
        <button class="num-btn" onclick="pressNum('6')">6</button>
        <button class="num-btn" onclick="pressNum('7')">7</button>
        <button class="num-btn" onclick="pressNum('8')">8</button>
        <button class="num-btn" onclick="pressNum('9')">9</button>
        <button class="num-btn" onclick="clearPin()">C</button>
        <button class="num-btn" onclick="pressNum('0')">0</button>
        <button class="num-btn" onclick="backspacePin()">⌫</button>
      </div>
    </div>
  </div>

  <!-- Main Dashboard -->
  <div id="dashboard" class="dashboard">
    <header>
      <div class="brand">
        <span>👑 Topi Vappa</span>
        <span class="badge-stealth">OWNER VAULT</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-primary" onclick="downloadCSV()">
          <span>📥</span> <span class="btn-text">Export CSV (Excel)</span>
        </button>
        <button class="btn" onclick="openChangePinModal()">
          <span>🔑</span> <span class="btn-text">Change PIN</span>
        </button>
        <button class="btn btn-danger" onclick="openPurgeModal()">
          <span>🗑️</span> <span class="btn-text">Delete History</span>
        </button>
        <button class="btn" onclick="lockVault()">
          <span>🔒</span> <span class="btn-text">Lock</span>
        </button>
      </div>
    </header>

    <div class="container">
      <!-- Filters -->
      <div class="filters-bar">
        <div class="filter-chips">
          <button class="chip active" onclick="setQuickRange('today')">Today</button>
          <button class="chip" onclick="setQuickRange('yesterday')">Yesterday</button>
          <button class="chip" onclick="setQuickRange('week')">Last 7 Days</button>
          <button class="chip" onclick="setQuickRange('month')">This Month</button>
          <button class="chip" onclick="setQuickRange('all')">All Time</button>
        </div>
        <div class="date-pickers">
          <label>From: <input type="date" id="fromDate" onchange="loadStats()"></label>
          <label>To: <input type="date" id="toDate" onchange="loadStats()"></label>
          <button class="btn" style="padding: 6px 12px;" onclick="loadStats()">Apply</button>
        </div>
        <div class="search-box">
          <input type="text" id="searchInput" class="search-input" placeholder="🔍 Search dishes, order number, table or category..." oninput="debouncedSearch()" />
        </div>
      </div>

      <!-- KPI Metric Cards -->
      <div class="kpi-grid">
        <div class="kpi-card kpi-1">
          <div class="kpi-label">Total Revenue</div>
          <div class="kpi-val" id="kpiRevenue">₹0</div>
          <div class="kpi-sub" id="kpiAvgOrder">Avg Order: ₹0</div>
        </div>
        <div class="kpi-card kpi-2">
          <div class="kpi-label">Dishes Sold</div>
          <div class="kpi-val" id="kpiQuantity">0</div>
          <div class="kpi-sub">Total item portions served</div>
        </div>
        <div class="kpi-card kpi-3">
          <div class="kpi-label">Total Orders Placed</div>
          <div class="kpi-val" id="kpiOrders">0</div>
          <div class="kpi-sub" id="kpiRecordCount">0 records logged</div>
        </div>
        <div class="kpi-card kpi-4">
          <div class="kpi-label">Top Selling Dish</div>
          <div class="kpi-val" style="font-size: 1.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" id="kpiTopDish">-</div>
          <div class="kpi-sub" id="kpiTopDishSub">0 portions sold</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs-bar">
        <button class="tab-btn active" onclick="switchTab('dishes')">🍛 Dishes Sold & Quantities</button>
        <button class="tab-btn" onclick="switchTab('days')">📅 Day-by-Day Summary</button>
        <button class="tab-btn" onclick="switchTab('logs')">📝 All Individual Orders Log</button>
      </div>

      <!-- Tab 1: Dishes Breakdown -->
      <div id="tabDishes" class="table-card">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Dish Name</th>
                <th>Category</th>
                <th style="text-align: right;">Unit Price</th>
                <th style="text-align: right;">Sold Quantity</th>
                <th style="text-align: right;">Total Sales (₹)</th>
                <th>Popularity</th>
              </tr>
            </thead>
            <tbody id="dishesTableBody">
              <tr><td colspan="7" style="text-align: center; padding: 24px;">Loading dish analytics...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 2: Daily Breakdown -->
      <div id="tabDays" class="table-card" style="display: none;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align: right;">Total Orders</th>
                <th style="text-align: right;">Dishes Sold</th>
                <th style="text-align: right;">Total Revenue (₹)</th>
                <th style="text-align: right;">Avg per Order (₹)</th>
              </tr>
            </thead>
            <tbody id="daysTableBody">
              <tr><td colspan="5" style="text-align: center; padding: 24px;">Loading daily breakdown...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tab 3: Detailed Raw Log -->
      <div id="tabLogs" class="table-card" style="display: none;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Order #</th>
                <th>Table</th>
                <th>Dish</th>
                <th style="text-align: right;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total (₹)</th>
                <th>Staff</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody id="logsTableBody">
              <tr><td colspan="9" style="text-align: center; padding: 24px;">Loading raw logs...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>

  <!-- Change PIN Modal -->
  <div id="changePinModal" class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-title">Change Owner Passcode</div>
      <div class="modal-body">
        <div style="margin-bottom: 12px;">
          <label style="display: block; font-size: 0.8rem; margin-bottom: 4px;">Current PIN:</label>
          <input type="password" id="curPinInput" class="search-input" style="width: 100%;" placeholder="Current PIN" />
        </div>
        <div>
          <label style="display: block; font-size: 0.8rem; margin-bottom: 4px;">New PIN (min 4 digits):</label>
          <input type="password" id="newPinInput" class="search-input" style="width: 100%;" placeholder="New PIN" />
        </div>
        <div id="changePinErr" style="color: #f87171; font-size: 0.8rem; margin-top: 8px;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal('changePinModal')">Cancel</button>
        <button class="btn btn-primary" onclick="submitChangePin()">Save PIN</button>
      </div>
    </div>
  </div>

  <!-- Purge Modal -->
  <div id="purgeModal" class="modal-backdrop">
    <div class="modal-box">
      <div class="modal-title" style="color: #f87171;">⚠️ Delete Audit History</div>
      <div class="modal-body">
        <p style="margin-bottom: 12px;">Cashiers cannot delete this data. Only you as the owner can purge records here.</p>
        <label style="display: block; font-size: 0.8rem; margin-bottom: 6px;">Select Delete Action:</label>
        <select id="purgeType" class="search-input" style="width: 100%; margin-bottom: 12px;">
          <option value="olderThanDays">Delete records older than 30 days</option>
          <option value="date">Delete records for selected date</option>
          <option value="all">WIPE ALL HISTORY (Permanent)</option>
        </select>
        <div id="purgeDateWrap" style="display: none; margin-bottom: 12px;">
          <label style="display: block; font-size: 0.8rem; margin-bottom: 4px;">Target Date:</label>
          <input type="date" id="purgeTargetDate" class="search-input" style="width: 100%;" />
        </div>
        <label style="display: block; font-size: 0.8rem; margin-bottom: 4px;">Confirm Your Owner PIN:</label>
        <input type="password" id="purgePinConfirm" class="search-input" style="width: 100%;" placeholder="Owner PIN" />
        <div id="purgeErr" style="color: #f87171; font-size: 0.8rem; margin-top: 8px;"></div>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal('purgeModal')">Cancel</button>
        <button class="btn btn-danger" onclick="submitPurge()">Permanently Delete</button>
      </div>
    </div>
  </div>

  <script>
    let activePin = sessionStorage.getItem('tv_vault_pin') || '';
    let currentData = null;
    let searchTimeout = null;

    document.getElementById('purgeType').addEventListener('change', function(e) {
      document.getElementById('purgeDateWrap').style.display = e.target.value === 'date' ? 'block' : 'none';
    });

    function pressNum(n) {
      const el = document.getElementById('pinInput');
      if (el.value.length < 8) el.value += n;
    }
    function clearPin() {
      document.getElementById('pinInput').value = '';
    }
    function backspacePin() {
      const el = document.getElementById('pinInput');
      el.value = el.value.slice(0, -1);
    }

    document.getElementById('pinInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitPin();
    });

    async function submitPin() {
      const pin = document.getElementById('pinInput').value.trim();
      const errEl = document.getElementById('pinErr');
      errEl.textContent = '';

      if (!pin) {
        errEl.textContent = 'Please enter PIN';
        return;
      }

      try {
        const res = await fetch('/api/vault/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin }),
        });
        const data = await res.json();
        if (data.success) {
          activePin = pin;
          sessionStorage.setItem('tv_vault_pin', pin);
          document.getElementById('lockScreen').style.display = 'none';
          document.getElementById('dashboard').style.display = 'block';
          setQuickRange('today');
        } else {
          errEl.textContent = 'Invalid PIN code';
          document.getElementById('pinInput').value = '';
        }
      } catch (err) {
        errEl.textContent = 'Connection error';
      }
    }

    function lockVault() {
      activePin = '';
      sessionStorage.removeItem('tv_vault_pin');
      document.getElementById('pinInput').value = '';
      document.getElementById('pinErr').textContent = '';
      document.getElementById('lockScreen').style.display = 'flex';
      document.getElementById('dashboard').style.display = 'none';
    }

    function setQuickRange(type) {
      document.querySelectorAll('.filter-chips .chip').forEach(c => c.classList.remove('active'));
      event?.target?.classList?.add('active');

      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const toStr = (d) => \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())}\`;

      const todayStr = toStr(now);
      const fromEl = document.getElementById('fromDate');
      const toEl = document.getElementById('toDate');

      if (type === 'today') {
        fromEl.value = todayStr;
        toEl.value = todayStr;
      } else if (type === 'yesterday') {
        const y = new Date(now.getTime() - 86400000);
        fromEl.value = toStr(y);
        toEl.value = toStr(y);
      } else if (type === 'week') {
        const w = new Date(now.getTime() - 7 * 86400000);
        fromEl.value = toStr(w);
        toEl.value = todayStr;
      } else if (type === 'month') {
        const m = new Date(now.getFullYear(), now.getMonth(), 1);
        fromEl.value = toStr(m);
        toEl.value = todayStr;
      } else if (type === 'all') {
        fromEl.value = '';
        toEl.value = '';
      }

      loadStats();
    }

    function debouncedSearch() {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(loadStats, 300);
    }

    async function loadStats() {
      if (!activePin) return;

      const from = document.getElementById('fromDate').value;
      const to = document.getElementById('toDate').value;
      const search = document.getElementById('searchInput').value;

      const params = new URLSearchParams({ pin: activePin });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search) params.set('search', search);

      try {
        const res = await fetch(\`/api/vault/stats?\${params.toString()}\`);
        if (!res.ok) {
          if (res.status === 404 || res.status === 401) {
            lockVault();
            return;
          }
          throw new Error('Failed to load stats');
        }
        currentData = await res.json();
        renderDashboard(currentData);
      } catch (err) {
        console.error('Error fetching vault stats:', err);
      }
    }

    function renderDashboard(data) {
      if (!data) return;

      // KPI Cards
      document.getElementById('kpiRevenue').textContent = \`₹\${data.totalRevenue.toLocaleString('en-IN')}\`;
      const avg = data.totalOrders > 0 ? (data.totalRevenue / data.totalOrders).toFixed(0) : 0;
      document.getElementById('kpiAvgOrder').textContent = \`Avg Order: ₹\${avg}\`;

      document.getElementById('kpiQuantity').textContent = data.totalQuantity.toLocaleString('en-IN');
      document.getElementById('kpiOrders').textContent = data.totalOrders.toLocaleString('en-IN');
      document.getElementById('kpiRecordCount').textContent = \`\${data.totalRecords} order line(s) logged\`;

      if (data.topDish) {
        document.getElementById('kpiTopDish').textContent = data.topDish.dishName;
        document.getElementById('kpiTopDishSub').textContent = \`\${data.topDish.totalQty} sold (₹\${data.topDish.totalRevenue.toLocaleString('en-IN')})\`;
      } else {
        document.getElementById('kpiTopDish').textContent = '-';
        document.getElementById('kpiTopDishSub').textContent = 'No sales in period';
      }

      // Dishes Table
      const dishBody = document.getElementById('dishesTableBody');
      if (!data.dishRankings.length) {
        dishBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: #9ca3af;">No dishes recorded for this period.</td></tr>';
      } else {
        const maxQty = data.dishRankings[0]?.totalQty || 1;
        dishBody.innerHTML = data.dishRankings.map((d, i) => \`
          <tr>
            <td style="color: #6b7280; font-weight: 600;">\${i + 1}</td>
            <td style="font-weight: 600; color: #fff;">\${escapeHtml(d.dishName)}</td>
            <td><span class="badge badge-category">\${escapeHtml(d.category)}</span></td>
            <td style="text-align: right; color: #9ca3af;">₹\${d.unitPrice}</td>
            <td style="text-align: right;"><span class="badge badge-qty">\${d.totalQty}</span></td>
            <td style="text-align: right;" class="badge-rev">₹\${d.totalRevenue.toLocaleString('en-IN')}</td>
            <td>
              <div style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 2px;">\${d.sharePercent}%</div>
              <div class="progress-track"><div class="progress-fill" style="width: \${(d.totalQty / maxQty) * 100}%;"></div></div>
            </td>
          </tr>
        \`).join('');
      }

      // Daily Breakdown Table
      const daysBody = document.getElementById('daysTableBody');
      if (!data.dailySummary.length) {
        daysBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 24px; color: #9ca3af;">No daily data recorded.</td></tr>';
      } else {
        daysBody.innerHTML = data.dailySummary.map(dt => {
          const avgDay = dt.ordersCount > 0 ? (dt.totalRevenue / dt.ordersCount).toFixed(0) : 0;
          return \`
            <tr>
              <td style="font-weight: 600; color: #fff;">\${dt.date}</td>
              <td style="text-align: right;">\${dt.ordersCount}</td>
              <td style="text-align: right;"><span class="badge badge-qty">\${dt.dishesSold}</span></td>
              <td style="text-align: right;" class="badge-rev">₹\${dt.totalRevenue.toLocaleString('en-IN')}</td>
              <td style="text-align: right; color: #9ca3af;">₹\${avgDay}</td>
            </tr>
          \`;
        }).join('');
      }

      // Raw Log Table
      const logsBody = document.getElementById('logsTableBody');
      if (!data.records.length) {
        logsBody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 24px; color: #9ca3af;">No logs found.</td></tr>';
      } else {
        logsBody.innerHTML = data.records.slice(0, 300).map(r => \`
          <tr>
            <td style="font-size: 0.8rem; color: #9ca3af; white-space: nowrap;">\${r.date} \${r.time}</td>
            <td style="font-weight: 600; color: #f97316;">\${escapeHtml(r.orderNumber)}</td>
            <td><span class="badge badge-category">\${escapeHtml(r.table)}</span></td>
            <td style="font-weight: 600;">\${escapeHtml(r.dishName)}</td>
            <td style="text-align: right;"><span class="badge badge-qty">\${r.qty}</span></td>
            <td style="text-align: right; color: #9ca3af;">₹\${r.price}</td>
            <td style="text-align: right;" class="badge-rev">₹\${r.total}</td>
            <td style="color: #9ca3af; font-size: 0.8rem;">\${escapeHtml(r.waiter)}</td>
            <td><span class="badge badge-category" style="font-size: 0.7rem;">\${r.entryType.toUpperCase()}</span></td>
          </tr>
        \`).join('');
      }
    }

    function switchTab(tab) {
      document.querySelectorAll('.tabs-bar .tab-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');

      document.getElementById('tabDishes').style.display = tab === 'dishes' ? 'block' : 'none';
      document.getElementById('tabDays').style.display = tab === 'days' ? 'block' : 'none';
      document.getElementById('tabLogs').style.display = tab === 'logs' ? 'block' : 'none';
    }

    function downloadCSV() {
      if (!activePin) return;
      const from = document.getElementById('fromDate').value;
      const to = document.getElementById('toDate').value;
      const params = new URLSearchParams({ pin: activePin });
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      window.open(\`/api/vault/export-csv?\${params.toString()}\`, '_blank');
    }

    function openChangePinModal() {
      document.getElementById('curPinInput').value = '';
      document.getElementById('newPinInput').value = '';
      document.getElementById('changePinErr').textContent = '';
      document.getElementById('changePinModal').style.display = 'flex';
    }

    async function submitChangePin() {
      const cur = document.getElementById('curPinInput').value.trim();
      const nxt = document.getElementById('newPinInput').value.trim();
      const errEl = document.getElementById('changePinErr');
      errEl.textContent = '';

      if (!cur || !nxt) {
        errEl.textContent = 'Please fill all fields';
        return;
      }
      if (nxt.length < 4) {
        errEl.textContent = 'New PIN must be at least 4 digits';
        return;
      }

      try {
        const res = await fetch('/api/vault/change-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPin: cur, newPin: nxt }),
        });
        const data = await res.json();
        if (data.success) {
          activePin = nxt;
          sessionStorage.setItem('tv_vault_pin', nxt);
          closeModal('changePinModal');
          alert('Owner PIN updated successfully!');
        } else {
          errEl.textContent = data.error || 'Failed to update PIN';
        }
      } catch (err) {
        errEl.textContent = 'Error updating PIN';
      }
    }

    function openPurgeModal() {
      document.getElementById('purgePinConfirm').value = '';
      document.getElementById('purgeErr').textContent = '';
      document.getElementById('purgeModal').style.display = 'flex';
    }

    async function submitPurge() {
      const pin = document.getElementById('purgePinConfirm').value.trim();
      const deleteType = document.getElementById('purgeType').value;
      const targetDate = document.getElementById('purgeTargetDate').value;
      const errEl = document.getElementById('purgeErr');
      errEl.textContent = '';

      if (!pin) {
        errEl.textContent = 'Please confirm with owner PIN';
        return;
      }

      if (!confirm('Are you ABSOLUTELY sure you want to permanently delete these audit records?')) {
        return;
      }

      try {
        const res = await fetch('/api/vault/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin,
            deleteType,
            targetDate: deleteType === 'date' ? targetDate : deleteType === 'olderThanDays' ? 30 : null,
          }),
        });
        const data = await res.json();
        if (data.success) {
          closeModal('purgeModal');
          alert(\`Successfully deleted \${data.deleted} record(s).\`);
          loadStats();
        } else {
          errEl.textContent = data.error || 'Failed to delete records';
        }
      } catch (err) {
        errEl.textContent = 'Error deleting records';
      }
    }

    function closeModal(id) {
      document.getElementById(id).style.display = 'none';
    }

    function escapeHtml(str) {
      return String(str || '').replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    // Auto-login if session PIN is already valid
    if (activePin) {
      document.getElementById('pinInput').value = activePin;
      submitPin();
    }
  </script>
</body>
</html>`
}
