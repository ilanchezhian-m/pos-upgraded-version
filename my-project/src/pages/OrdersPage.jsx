import { useEffect, useState } from 'react'
import { listOrders, listPrintJobs, saveBill, savePrintJob } from '../lib/db'
import '../App.css'

function OrdersPage() {
  const [orders, setOrders] = useState([])
  const [prints, setPrints] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const [o, p] = await Promise.all([listOrders(), listPrintJobs()])
      setOrders(o)
      setPrints(p)
    }
    fetchData()
    const interval = setInterval(fetchData, 3000)
    return () => clearInterval(interval)
  }, [])

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
    await savePrintJob({ type: 'BILL', refId: savedBill.id, status: 'queued' })
    // Refresh data
    const [o, p] = await Promise.all([listOrders(), listPrintJobs()])
    setOrders(o)
    setPrints(p)
  }

  return (
    <div className="board">
      <section className="panel" style={{ width: '100%', maxWidth: '1200px', margin: '20px auto' }}>
        <h2>Orders</h2>
        <p className="panel-subtitle">Recent orders awaiting billing or sync.</p>
        <div className="list">
          {orders.length === 0 && <div className="muted">No orders yet.</div>}
          {orders.map((order) => (
            <div key={order.id} className="list-item">
              <div>
                <div><strong>{order.customer}</strong> • {order.summary || `${order.item} x ${order.qty}`}</div>
                <div className="muted">₹{order.total} • {order.table} • {order.status}</div>
                <div className="muted" style={{ fontSize: '11px' }}>
                  {new Date(order.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="toolbar">
                <span className="tag">{order.synced ? 'synced' : 'queued'}</span>
                {order.status !== 'billed' && (
                  <button className="button secondary" type="button" onClick={() => handleCreateBill(order)}>
                    Make Bill
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default OrdersPage

