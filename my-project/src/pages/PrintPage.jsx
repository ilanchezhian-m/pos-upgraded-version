import { useEffect, useState } from 'react'
import { listBills, listOrders, listPrintJobs } from '../lib/db'
import billLogo from '../assets/bill-logo.png'
import './PrintPage.css'

function PrintPage() {
  const [orders, setOrders] = useState([])
  const [bills, setBills] = useState([])
  const [prints, setPrints] = useState([])
  const [selectedPrintJob, setSelectedPrintJob] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const [o, b, p] = await Promise.all([listOrders(), listBills(), listPrintJobs()])
      setOrders(o)
      setBills(b)
      setPrints(p)
    }
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  const pendingPrintJobs = prints.filter((p) => p.status === 'queued')
  const kotJobs = pendingPrintJobs.filter((p) => p.type === 'KOT')
  const billJobs = pendingPrintJobs.filter((p) => p.type === 'BILL')

  const selectLatest = (type) => {
    const list = type === 'KOT' ? kotJobs : billJobs
    if (list.length) {
      setSelectedPrintJob(list[0])
    }
  }

  const getOrderDetails = (orderId) => {
    return orders.find((o) => o.id === orderId)
  }

  const getBillDetails = (billId) => {
    return bills.find((b) => b.id === billId)
  }

  const handleSelectJob = (job) => {
    setSelectedPrintJob(job)
  }

  const handlePrintNow = () => {
    if (selectedPrintJob) {
      window.print()
    }
  }

  return (
    <div className="print-page-container">
      <header className="print-header">
        <h1>🖨️ Print Queue Manager</h1>
        <div className="header-stats">
          <button type="button" className="stat-badge" onClick={() => selectLatest('BILL')}>
            <span className="badge-label">Billing</span>
            <span className={`badge-count ${billJobs.length > 0 ? 'active' : ''}`}>
              {billJobs.length}
            </span>
          </button>
          <button type="button" className="stat-badge" onClick={() => selectLatest('KOT')}>
            <span className="badge-label">Kitchen (KOT)</span>
            <span className={`badge-count ${kotJobs.length > 0 ? 'active' : ''}`}>
              {kotJobs.length}
            </span>
          </button>
        </div>
      </header>

      <div className="print-layout">
        {/* Left Panel - Job Queue */}
        <aside className="job-list-panel">
          <div className="panel-section">
            <h3>Billing</h3>
            <div className="job-queue">
              {billJobs.length === 0 ? (
                <div className="empty-state">No pending bill jobs</div>
              ) : (
                billJobs.map((job) => {
                  const bill = getBillDetails(job.refId)
                  return (
                    <div
                      key={job.id}
                      className={`job-card ${selectedPrintJob?.id === job.id ? 'selected' : ''}`}
                      onClick={() => handleSelectJob(job)}
                    >
                      <div className="job-time">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="job-details">
                        <div className="job-item">{bill?.customer || 'Guest'}</div>
                        <div className="job-meta">₹{bill?.total} • {bill?.table}</div>
                      </div>
                      <div className={`job-status ${job.status}`}>{job.status}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="panel-section">
            <h3>Kitchen Orders (KOT)</h3>
            <div className="job-queue">
              {kotJobs.length === 0 ? (
                <div className="empty-state">No pending KOT jobs</div>
              ) : (
                kotJobs.map((job) => {
                  const order = getOrderDetails(job.refId)
                  const lineCount = order?.items?.length || 1
                  const summary = order?.items?.map((l) => `${l.name} x${l.qty}`).join(', ') || `${order?.item} x${order?.qty}`
                  return (
                    <div
                      key={job.id}
                      className={`job-card ${selectedPrintJob?.id === job.id ? 'selected' : ''}`}
                      onClick={() => handleSelectJob(job)}
                    >
                      <div className="job-time">
                        {new Date(job.createdAt).toLocaleTimeString()}
                      </div>
                      <div className="job-details">
                        <div className="job-item">{summary || 'Unknown'}</div>
                        <div className="job-meta">
                          {order?.table} • {lineCount} line(s)
                        </div>
                      </div>
                      <div className={`job-status ${job.status}`}>{job.status}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </aside>

        {/* Right Panel - Print Preview */}
        <main className="print-preview-panel">
          {selectedPrintJob ? (
            <>
              <div className="preview-toolbar">
                <div>
                  <h2 className="preview-title">
                    {selectedPrintJob.type === 'KOT'
                      ? '🍳 Kitchen Order Ticket'
                      : '💳 Billing Receipt'}
                  </h2>
                </div>
                <button className="button-print" onClick={handlePrintNow}>
                  🖨️ Print Now
                </button>
              </div>

              <div className="print-preview">
                {selectedPrintJob.type === 'KOT' ? (
                  <KOTReceipt key={selectedPrintJob.id} order={getOrderDetails(selectedPrintJob.refId)} />
                ) : (
                  <BillingReceipt key={selectedPrintJob.id} bill={getBillDetails(selectedPrintJob.refId)} />
                )}
              </div>
            </>
          ) : (
            <div className="preview-empty">
              <p>Select a print job to preview</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function KOTReceipt({ order }) {
  if (!order) return <div>Order not found</div>

  const lines = order.items && order.items.length
    ? order.items
    : [{ name: order.item, qty: order.qty, price: order.price }]

  return (
    <div className="receipt receipt-kot">
      <div className="receipt-header">
        <h1 className="receipt-title">KITCHEN ORDER TICKET</h1>
        <div className="receipt-time">
          {new Date(order.createdAt).toLocaleString()}
        </div>
      </div>

      <div className="receipt-section">
        <div className="receipt-row">
          <span className="label">Order No:</span>
          <span className="value table-emphasis">{order.orderNumber || order.id.slice(0, 8)}</span>
        </div>
        <div className="receipt-row">
          <span className="label">Table / Parcel:</span>
          <span className="value table-emphasis">{order.table}</span>
        </div>
        {order.customer && order.customer !== 'Walk-in' && (
          <div className="receipt-row">
            <span className="label">Customer:</span>
            <span className="value">{order.customer}</span>
          </div>
        )}
      </div>

      <div className="receipt-header"></div>

      <div className="receipt-section items-section">
        <div className="items-table">
          <div className="items-header">
            <div className="col-item">Item</div>
            <div className="col-qty">Qty</div>
          </div>
          <div className="items-body">
            {lines.map((line, idx) => (
              <div key={idx} className="item-row">
                <div className="col-item">
                  <span className="item-name">{line.name}</span>
                </div>
                <div className="col-qty">
                  <span className="quantity-badge">{line.qty}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="receipt-header"></div>

      <div className="receipt-footer">
        <div className="footer-note">🔔 Please prepare immediately</div>
        <div className="footer-reference">Ref: {order.id.slice(0, 8)}</div>
      </div>
    </div>
  )
}

function BillingReceipt({ bill }) {
  if (!bill) return <div>Bill not found</div>

  const [tokenNumber] = useState(() => Math.floor(Math.random() * 51) + 50)

  // Local state for items to enable interactive editing
  const [items, setItems] = useState([])

  // Local state for manual overrides of totals
  const [manualSubtotal, setManualSubtotal] = useState('')
  const [manualCgst, setManualCgst] = useState('')
  const [manualSgst, setManualSgst] = useState('')
  const [manualGrandTotal, setManualGrandTotal] = useState('')
  const [manualTotalQty, setManualTotalQty] = useState('')

  // Sync state with selected bill prop (only when bill ID changes, preserving active edits)
  const billId = bill?.id
  useEffect(() => {
    if (bill && bill.items) {
      setItems(
        bill.items.map((item) => ({
          name: item.name || '',
          qty: (item.qty || 0).toString(),
          price: (item.price || 0).toString(),
          total: ((item.price || 0) * (item.qty || 0)).toFixed(2),
        }))
      )
    } else {
      setItems([])
    }
    setManualSubtotal('')
    setManualCgst('')
    setManualSgst('')
    setManualGrandTotal('')
    setManualTotalQty('')
  }, [billId])

  // Handle updates to item rows
  const handleItemChange = (idx, field, value) => {
    const updated = [...items]
    const item = { ...updated[idx] }
    item[field] = value

    if (field === 'qty') {
      const q = parseFloat(value) || 0
      const p = parseFloat(item.price) || 0
      item.total = (p * q).toFixed(2)
    } else if (field === 'price') {
      const q = parseFloat(item.qty) || 0
      const p = parseFloat(value) || 0
      item.total = (p * q).toFixed(2)
    } else if (field === 'total') {
      const t = parseFloat(value) || 0
      const q = parseFloat(item.qty) || 0
      if (q > 0) {
        item.price = (t / q).toFixed(2)
      }
    }

    updated[idx] = item
    setItems(updated)
  }

  // Derive all calculations
  const calculatedSubtotal = items.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0)
  const displaySubtotal = manualSubtotal !== '' ? manualSubtotal : calculatedSubtotal.toFixed(2)

  const calculatedCgst = (parseFloat(displaySubtotal) || 0) * 0.025
  const displayCgst = manualCgst !== '' ? manualCgst : calculatedCgst.toFixed(2)

  const calculatedSgst = (parseFloat(displaySubtotal) || 0) * 0.025
  const displaySgst = manualSgst !== '' ? manualSgst : calculatedSgst.toFixed(2)

  const calculatedGrandTotal = (parseFloat(displaySubtotal) || 0) + (parseFloat(displayCgst) || 0) + (parseFloat(displaySgst) || 0)
  const displayGrandTotal = manualGrandTotal !== '' ? manualGrandTotal : calculatedGrandTotal.toFixed(2)

  const calculatedTotalQty = items.reduce((sum, item) => sum + (parseFloat(item.qty) || 0), 0)
  const displayTotalQty = manualTotalQty !== '' ? manualTotalQty : calculatedTotalQty.toString()

  return (
    <div className="receipt receipt-billing">
      <div className="receipt-header" style={{ textAlign: 'center' }}>
        <img src={billLogo} alt="Logo" style={{ width: '200px', marginBottom: '-10px' }} />
        <h2 className="receipt-title">TOPI VAPPA BIRIYANI - SALEM</h2>

        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">261A, Advaitha Ashram Rd,</span>
        </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">Fairlands, Salem,</span>
        </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">Tamil Nadu 636004</span>
        </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">GST Name : GIRI FOODS</span>
        </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">GST No : 33BZGPG7879D1Z7</span>
        </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">FSSAI No : 12421018001075</span>
        </div>


        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
          <span className="label">Phone : 7305748889</span>
        </div>
      </div>

      {/* <div className="divider"></div> */}

      <div className="receipt-section">
        <div className="receipt-row" style={{ lineHeight: '0.3' }}>
          <span className="label-two">Name:<input type="text" defaultValue="(M:0000000000" style={{ border: 'none', background: 'transparent', width: '120px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', marginLeft: '5px' }} /></span>
        </div>
        <div className="receipt-row" style={{ lineHeight: '0.3' }}>
          <span className="label-two">Mob:<input type="text" defaultValue="0000000000" style={{ border: 'none', background: 'transparent', width: '120px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', marginLeft: '5px' }} /></span>
        </div>
        <div className="receipt-row" style={{ lineHeight: '0.' }}>
          <span className="label-two">Adr:<input type="text" defaultValue="0000000000" style={{ border: 'none', background: 'transparent', width: '120px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', marginLeft: '5px' }} /></span>
        </div>
      </div>
      <div className="receipt-header"></div>


      <div className="receipt-section">
        <div className="receipt-row" style={{ lineHeight: '0.5' }}>
          <span className="label-two">Date : <input type="text" defaultValue={new Date(bill.createdAt).toLocaleDateString('en-GB')} style={{ border: 'none', background: 'transparent', width: '85px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', marginLeft: '5px' }} /></span>
          <span className="label">Dine In:<input type="text" defaultValue={bill.table} style={{ border: 'none', background: 'transparent', width: '50px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', marginLeft: '5px', textAlign: 'right' }} /></span>
        </div>

        <div className="receipt-row" style={{ lineHeight: '0.1', }}>
          <span className="label-two"><input type="text" defaultValue={new Date(bill.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })} style={{ border: 'none', background: 'transparent', width: '80px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none' }} /></span>
        </div>

        <div className="receipt-row">
          <span className="label-two">Cashier:cap001</span>
          <span className="label-two">Bill No:{bill.orderNumber || bill.id.slice(0, 8)}</span>
        </div>

        <div className="receipt-row">
          <span className="label">Token No: {tokenNumber}</span>
        </div>
      </div>
      <div className='receipt-header'></div>
      <div className="receipt-section items-section">
        <div className="items-table">
          <div className="items-header billing">
            <div className="col-sno">No.</div>
            <div className="col-item">Item</div>
            <div className="col-qty">Qty.</div>
            <div className="col-price">Price</div>
            <div className="col-total">Amount</div>
          </div>
          <div className='receipt-header'></div>
          <div className="items-body">
            {items.map((item, idx) => (
              <div key={idx} className="item-row billing">
                <div className="col-sno">
                  <span className="sno">{idx + 1}</span>
                </div>
                <div className="col-item">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      color: 'inherit',
                      outline: 'none',
                      padding: 0,
                      margin: 0,
                    }}
                  />
                </div>
                <div className="col-qty">
                  <input
                    type="text"
                    value={item.qty}
                    onChange={(e) => handleItemChange(idx, 'qty', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      width: '100%',
                      fontFamily: 'inherit',
                      fontSize: 'inherit',
                      fontWeight: 'inherit',
                      color: 'inherit',
                      outline: 'none',
                      textAlign: 'center',
                      padding: 0,
                      margin: 0,
                    }}
                  />
                </div>
                <div className="col-price">
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ₹
                    <input
                      type="text"
                      value={item.price}
                      onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        width: '80%',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        color: 'inherit',
                        outline: 'none',
                        textAlign: 'right',
                        padding: 0,
                        margin: 0,
                      }}
                    />
                  </span>
                </div>
                <div className="col-total">
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    ₹
                    <input
                      type="text"
                      value={item.total}
                      onChange={(e) => handleItemChange(idx, 'total', e.target.value)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        width: '80%',
                        fontFamily: 'inherit',
                        fontSize: 'inherit',
                        fontWeight: 'inherit',
                        color: 'inherit',
                        outline: 'none',
                        textAlign: 'right',
                        padding: 0,
                        margin: 0,
                      }}
                    />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="receipt-totals">
        <div className="total-row" style={{ justifyContent: 'flex-end', lineHeight: '0.5' }}>
          <span className="total-label">Total Qty: <input type="text" value={displayTotalQty} onChange={(e) => setManualTotalQty(e.target.value)} style={{ border: 'none', background: 'transparent', width: '20px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none' }} /></span>

          <span className="total-label" style={{ paddingLeft: '5px' }}>Sub: ₹<input type="text" value={displaySubtotal} onChange={(e) => setManualSubtotal(e.target.value)} style={{ border: 'none', background: 'transparent', width: '60px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', textAlign: 'left' }} /></span>
        </div>

        <div className="total-row" style={{ justifyContent: 'flex-end', lineHeight: '0.1' }}>
          <span className="total-label" style={{ paddingRight: '70px' }}><input type="text" defaultValue="Total" style={{ border: 'none', background: 'transparent', width: '50px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', textAlign: 'right' }} /></span>
        </div>

        <div className="total-row" style={{ justifyContent: 'flex-end', lineHeight: '0.5' }}>
          <span className="total-label">CGST @ 2.5%: ₹<input type="text" value={displayCgst} onChange={(e) => setManualCgst(e.target.value)} style={{ border: 'none', background: 'transparent', width: '50px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', textAlign: 'left' }} /></span>
        </div>
        <div className="total-row" style={{ justifyContent: 'flex-end', lineHeight: '0.5' }}>
          <span className="total-label">SGST @ 2.5%: ₹<input type="text" value={displaySgst} onChange={(e) => setManualSgst(e.target.value)} style={{ border: 'none', background: 'transparent', width: '50px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', textAlign: 'left' }} /></span>
        </div>

        <div className="total-row total-final" style={{ justifyContent: 'flex-end', lineHeight: '0.5' }}>
          <span className="total-label-bold">Grand Total: ₹<input type="text" value={displayGrandTotal} onChange={(e) => setManualGrandTotal(e.target.value)} style={{ border: 'none', background: 'transparent', width: '70px', fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit', color: 'inherit', outline: 'none', textAlign: 'left' }} /></span>
        </div>
      </div>

      <div className="receipt-footer" style={{ marginBottom: '0' }}>
        <span className="label-two">FSSAI Lic No : 12421018001075</span>
        {/* <div className="footer-reference">Invoice: {bill.id.slice(0, 8)}</div> */}
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>

          <div className="footer-note">THANKS FOR VISTING US!</div>
        </div>
      </div>
    </div>
  )
}

export default PrintPage
