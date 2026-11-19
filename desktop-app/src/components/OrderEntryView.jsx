import React from 'react'

function OrderEntryView({
  flowStarted,
  tableGroups,
  getTableStatus,
  isTableOccupied,
  selectTable,
  setPendingPaymentTable,
  changeTable,
  categories,
  selectedCategory,
  setSelectedCategory,
  categoryTone,
  filteredItems,
  searchTerm,
  setSearchTerm,
  addLine,
  orderForm,
  setOrderForm,
  orders,
  orderLines,
  changeLineQty,
  paymentMethods,
  orderTotal,
  handleCreateOrder,
  isDelivery,
  showMarkAsPaid,
  markTableAsPaid,
}) {
  return (
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

          {/* Order Summary */}
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
                <button type="button" className="pill subtle" onClick={changeTable}>
                  Change
                </button>
              </div>

              {/* Show previous running orders for this table */}
              {orders.filter((o) => o.table === orderForm.table && o.status !== 'paid').length > 0 && (
                <div className="running-orders">
                  <div className="running-orders-title">📋 Running Orders</div>
                  {orders
                    .filter((o) => o.table === orderForm.table && o.status !== 'paid')
                    .map((order) => (
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
                      ₹
                      {orders
                        .filter((o) => o.table === orderForm.table && o.status !== 'paid')
                        .reduce((sum, o) => sum + o.total, 0) + orderTotal}
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
                      disabled={
                        orderLines.length === 0 &&
                        orders.filter((o) => o.table === orderForm.table && o.status !== 'paid').length === 0
                      }
                      onClick={(e) => handleCreateOrder(e, 'bill')}
                    >
                      Print Bill
                    </button>
                  )}
                  {!isDelivery &&
                    orders.some((o) => o.table === orderForm.table && o.status === 'billed') &&
                    showMarkAsPaid[orderForm.table] && (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => markTableAsPaid(orderForm.table)}
                        style={{
                          transition: 'all 0.3s ease',
                          animation: 'fadeIn 0.3s ease-in',
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
      )}
    </>
  )
}

export default React.memo(OrderEntryView)
