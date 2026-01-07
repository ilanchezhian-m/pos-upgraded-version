import { useEffect, useState } from 'react'
import { listBills, listPrintJobs, savePrintJob } from '../lib/db'
import { getUniqueCycles, filterBillsByCycle } from '../lib/cycleUtils'
import '../App.css'

function BillsPage() {
  const [bills, setBills] = useState([])
  const [prints, setPrints] = useState([])
  const [selectedCycle, setSelectedCycle] = useState(null)
  const [showCycleView, setShowCycleView] = useState(false)
  const [hoveredBillId, setHoveredBillId] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const [b, p] = await Promise.all([listBills(), listPrintJobs()])
      setBills(b)
      setPrints(p)
    }
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

  async function handlePrintBill(bill) {
    const existing = prints.find((p) => p.type === 'BILL' && p.refId === bill.id && p.status !== 'done')
    if (existing) return
    const job = await savePrintJob({ type: 'BILL', refId: bill.id, status: 'queued' })
    setPrints((prev) => [job, ...prev])
  }

  return (
    <div className={showCycleView ? 'cycle-view-page' : 'board'}>
      {showCycleView ? (
        <section className="panel cycle-panel">
          <div className="cycle-header">
            <div>
              <div className="muted small">Billing cycles</div>
              <h2 style={{ margin: 0 }}>Cycle View</h2>
            </div>
            <div className="cycle-header-actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setSelectedCycle(null)}
              >
                Clear cycle
              </button>
              <button
                className="button"
                type="button"
                onClick={() => setShowCycleView(false)}
              >
                📋 Back to Bills
              </button>
            </div>
          </div>

          <CycleView 
            bills={bills} 
            selectedCycle={selectedCycle}
            onSelectCycle={setSelectedCycle}
          />
        </section>
      ) : (
        <section className="panel" style={{ width: '100%', maxWidth: '1200px', margin: '20px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h2>Bills</h2>
              <p className="panel-subtitle">Ready for printing at the PC.</p>
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={() => setShowCycleView(true)}
              style={{ marginTop: '10px' }}
            >
              🕐 View by Cycle
            </button>
          </div>
          
          <div className="list">
            {bills.length === 0 && <div className="muted">No bills yet.</div>}
            {bills.map((bill) => {
              const hasQueuedBillPrint = prints.some(
                (p) => p.type === 'BILL' && p.refId === bill.id && p.status !== 'done',
              )
              const isPrinted = prints.some(
                (p) => p.type === 'BILL' && p.refId === bill.id && p.status === 'done',
              )
              const printStatus = isPrinted ? 'printed' : hasQueuedBillPrint ? 'printing' : 'not-printed'
              
              return (
                <div 
                  key={bill.id} 
                  className="list-item"
                  onMouseEnter={() => setHoveredBillId(bill.id)}
                  onMouseLeave={() => setHoveredBillId(null)}
                  style={{ 
                    position: 'relative',
                    transition: 'all 0.2s ease',
                    border: printStatus === 'printed' ? '2px solid #10b981' : printStatus === 'printing' ? '2px solid #f59e0b' : '1px solid #e5e7eb'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong>{bill.customer}</strong> • ₹{bill.total}
                      {printStatus === 'printed' && (
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#10b981', 
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          ✓ Printed
                        </span>
                      )}
                      {printStatus === 'printing' && (
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#f59e0b', 
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          ⏳ Printing...
                        </span>
                      )}
                      {printStatus === 'not-printed' && (
                        <span style={{ 
                          fontSize: '12px', 
                          color: '#ef4444', 
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          ⚠️ Not Printed
                        </span>
                      )}
                    </div>
                    <div className="muted">Table {bill.table} • {bill.items?.[0]?.qty} item(s)</div>
                    {bill.cycleLabel && <div className="muted" style={{ fontSize: '11px' }}>Cycle: {bill.cycleLabel}</div>}
                    <div className="muted" style={{ fontSize: '11px' }}>
                      {new Date(bill.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="toolbar">
                    <span className="tag">{bill.synced ? 'synced' : 'queued'}</span>
                    <button
                      className="button secondary"
                      type="button"
                      disabled={hasQueuedBillPrint}
                      onClick={() => handlePrintBill(bill)}
                      style={{
                        transition: 'all 0.2s ease',
                        cursor: hasQueuedBillPrint ? 'not-allowed' : 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        if (!hasQueuedBillPrint) {
                          e.target.style.transform = 'scale(1.05)'
                          e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)'
                        e.target.style.boxShadow = 'none'
                      }}
                    >
                      {hasQueuedBillPrint ? 'Bill in queue' : 'Print Bill'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

// Cycle View Component
function CycleView({ bills, selectedCycle, onSelectCycle }) {
  const cycles = getUniqueCycles(bills)
  const filteredBills = selectedCycle
    ? filterBillsByCycle(bills, selectedCycle)
    : bills
  const activeCycle = cycles.find((c) => c.cycleDate === selectedCycle)

  return (
    <div className="cycle-body">
      <div className="cycle-chip-grid">
        <button
          className={`cycle-chip ${!selectedCycle ? 'active' : ''}`}
          type="button"
          onClick={() => onSelectCycle(null)}
        >
          <div className="cycle-chip-title">All cycles</div>
          <div className="cycle-chip-meta">{bills.length} bills total</div>
        </button>
        {cycles.map((cycle) => (
          <button
            key={cycle.cycleDate}
            className={`cycle-chip ${selectedCycle === cycle.cycleDate ? 'active' : ''}`}
            type="button"
            onClick={() => onSelectCycle(cycle.cycleDate)}
          >
            <div className="cycle-chip-title">{cycle.cycleLabel || cycle.cycleDate}</div>
            <div className="cycle-chip-meta">{cycle.billCount} bills • ₹{cycle.totalAmount}</div>
          </button>
        ))}
      </div>

      {selectedCycle && (
        <div className="cycle-selected">
          <div>
            <div className="muted small">Selected cycle</div>
            <strong>{activeCycle?.cycleLabel || selectedCycle}</strong>
          </div>
          <button className="pill subtle" type="button" onClick={() => onSelectCycle(null)}>
            Clear
          </button>
        </div>
      )}

      <div className="cycle-bill-list">
        {filteredBills.length === 0 ? (
          <div className="muted">No bills found for selected cycle.</div>
        ) : (
          filteredBills.map((bill) => {
            const totalItems = bill.items?.length || 0
            const totalQty = bill.items?.reduce((sum, item) => sum + item.qty, 0) || 0

            return (
              <div key={bill.id} className="cycle-bill-card">
                <div className="cycle-bill-top">
                  <div>
                    <div className="cycle-bill-title">
                      <strong>{bill.customer}</strong> • ₹{bill.total}
                    </div>
                    <div className="muted">Table {bill.table} • Order #{bill.orderNumber || bill.id.slice(0, 8)}</div>
                    <div className="muted small">{new Date(bill.createdAt).toLocaleString()}</div>
                  </div>
                  <span className="tag">{bill.synced ? 'synced' : 'queued'}</span>
                </div>

                {bill.cycleLabel && (
                  <div className="cycle-badge">Cycle: {bill.cycleLabel}</div>
                )}

                <div className="cycle-bill-summary">
                  <div><strong>Total Items:</strong> {totalItems}</div>
                  <div><strong>Total Quantity:</strong> {totalQty}</div>
                  <div><strong>Payment:</strong> {bill.paymentMethod || 'Cash'} • ₹{bill.total}</div>
                </div>

                <div className="cycle-items-grid">
                  {bill.items?.map((item, idx) => (
                    <div key={idx} className="cycle-item-row">
                      <span>{item.name}</span>
                      <span>×{item.qty}</span>
                      <span>₹{item.price * item.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default BillsPage

