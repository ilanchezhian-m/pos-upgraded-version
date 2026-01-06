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
    <div className="board">
      <section className="panel" style={{ width: '100%', maxWidth: '1200px', margin: '20px auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div>
              <h2>Bills</h2>
              <p className="panel-subtitle">Ready for printing at the PC.</p>
            </div>
            <button
              className="button secondary"
              type="button"
              onClick={() => setShowCycleView(!showCycleView)}
              style={{ marginTop: '10px' }}
            >
              {showCycleView ? '📋 All Bills' : '🕐 View by Cycle'}
            </button>
          </div>
          
          {showCycleView ? (
            <CycleView 
              bills={bills} 
              selectedCycle={selectedCycle}
              onSelectCycle={setSelectedCycle}
            />
          ) : (
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
          )}
        </section>
    </div>
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

export default BillsPage

