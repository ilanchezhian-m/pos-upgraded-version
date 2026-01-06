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
                  <KOTReceipt order={getOrderDetails(selectedPrintJob.refId)} />
                ) : (
                  <BillingReceipt bill={getBillDetails(selectedPrintJob.refId)} />
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

      <div className="divider"></div>

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

      <div className="divider"></div>

      <div className="receipt-footer">
        <div className="footer-note">🔔 Please prepare immediately</div>
        <div className="footer-reference">Ref: {order.id.slice(0, 8)}</div>
      </div>
    </div>
  )
}

function BillingReceipt({ bill }) {
  if (!bill) return <div>Bill not found</div>

    const total = bill.items?.reduce((sum, item) => sum + item.price * item.qty, 0) || bill.total

  return (
    <div className="receipt receipt-billing">
      <div className="receipt-header" style={{ textAlign: 'center' }}>
        <img src={billLogo} alt="Logo" style={{ width: '200px', marginBottom: '-10px' }} />
        <h2 className="receipt-title">TOPI VAPPA BIRIYANI - SALEM</h2>

        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7'}}>
            <span className="label">261A, Advaitha Ashram Rd,</span>
          </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
            <span className="label">Fairlands, Salem,</span>
          </div>
        <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
            <span className="label">Tamil Nadu 636004</span>
          </div>
        
          <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
            <span className="label">FSSAI No : 12421018001075</span>
          </div>
          <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
            <span className="label">GST No : 33BZGPG7879D1Z7</span>           
          </div>

          <div className="receipt-row" style={{ justifyContent: 'center', textAlign: 'center', lineHeight: '0.7' }}>
            <span className="label">Phone : 7305748889</span>
          </div>
      </div>
      
               {/* <div className="divider"></div> */}
              
      <div className="receipt-section">
        <div className="receipt-row" style={{ lineHeight: '0.5' }}>
          <span className="label">Name:0000000000--`$(M:</span>
        </div>
        <div className="receipt-row" style={{ lineHeight: '0.5'}}>
          <span className="label">0000000000</span>
        </div>
        <div className="receipt-row" style={{ lineHeight: '0.5'}}>
          <span className="label">Adr:0000000</span>
        </div>
      </div>
              <div className="divider"></div>
              
     

      <div className="receipt-section">
        <div className="receipt-row">
          <span className="label">Order No:</span>
          <span className="value table-emphasis">{bill.orderNumber || bill.id.slice(0, 8)}</span>
        </div>
        <div className="receipt-row">
          <span className="label">Customer:</span>
          <span className="value">{bill.customer}</span>
        </div>
        <div className="receipt-row">
          <span className="label">Table / Order:</span>
          <span className="value table-emphasis">{bill.table}</span>
        </div>
        <div className="receipt-row">
          <span className="label">Date & Time:</span>
          <span className="value">{new Date(bill.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* <div className="divider"></div> */}

      <div className="receipt-section items-section">
        <div className="items-table">
          <div className="items-header billing">
            <div className="col-sno">No.</div>
            <div className="col-item">Item</div>
            <div className="col-qty">Qty.</div>
            <div className="col-price">Price</div>
            <div className="col-total">Amount</div>
          </div>
          <div className="items-body">
            {bill.items?.map((item, idx) => (
              <div key={idx} className="item-row billing">
                <div className="col-sno">
                  <span className="sno">{idx + 1}</span>
                </div>
                <div className="col-item">
                  <span className="item-name">{item.name}</span>
                </div>
                <div className="col-qty">{item.qty}</div>
                <div className="col-price">₹{item.price}</div>
                <div className="col-total">₹{item.price * item.qty}</div>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* <div className="divider"></div> */}
      <div className="receipt-totals">
        <div className="total-row total-final">
          <span className="total-label">Grand Total:</span>
          <span className="total-value">₹{total}</span>
        </div>
      </div>
      <div className="receipt-footer">
        <div className="footer-note">THANKS FOR VISTING US</div>
        {/* <div className="footer-reference">Invoice: {bill.id.slice(0, 8)}</div> */}
      </div>
    </div>
  )
}

export default PrintPage
