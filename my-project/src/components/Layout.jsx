import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../App.css'

function Layout({ children, isOnline, syncStatus, onClearData, showOrderHeader, orderForm, flowStarted, onBackToTables, onGoHome }) {
  const location = useLocation()
  const navigate = useNavigate()
  
  const isActive = (path) => location.pathname === path
  const isOrderPage = location.pathname === '/'

  const handleHomeClick = (e) => {
    e.preventDefault()
    if (onGoHome) {
      onGoHome()
    }
    navigate('/')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button 
          onClick={handleHomeClick}
          className="header-back" 
          aria-label="Home"
          style={{ textDecoration: 'none' }}
        >
          ⌂ Home
        </button>
        {isOrderPage && showOrderHeader && flowStarted && (
          <button type="button" className="header-back" onClick={onBackToTables} aria-label="Back to tables">
            ← Tables
          </button>
        )}
        <div className="brand">
          <span role="img" aria-label="pos">
            💳
          </span>
          PetPooja POS
          <span className="pill">Offline-first</span>
          {isOrderPage && showOrderHeader && flowStarted && (
            <span className="pill selected-table">Table: {orderForm?.table || 'Parcel'}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <Link
            to="/print-center"
            style={{
              padding: '8px 16px',
              background: isActive('/print-center') ? '#10b981' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
              boxShadow: isActive('/print-center') ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 2px 8px rgba(16, 185, 129, 0.2)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = isActive('/print-center') ? '0 4px 12px rgba(16, 185, 129, 0.3)' : '0 2px 8px rgba(16, 185, 129, 0.2)'
            }}
          >
            🖨️ Print Center
          </Link>
          <Link
            to="/orders"
            style={{
              padding: '8px 16px',
              background: isActive('/orders') ? '#667eea' : '#f0f0f0',
              color: isActive('/orders') ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/orders')) {
                e.target.style.background = '#e0e0e0'
                e.target.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/orders')) {
                e.target.style.background = '#f0f0f0'
                e.target.style.transform = 'translateY(0)'
              }
            }}
          >
            📋 Orders
          </Link>
          <Link
            to="/bills"
            style={{
              padding: '8px 16px',
              background: isActive('/bills') ? '#667eea' : '#f0f0f0',
              color: isActive('/bills') ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/bills')) {
                e.target.style.background = '#e0e0e0'
                e.target.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/bills')) {
                e.target.style.background = '#f0f0f0'
                e.target.style.transform = 'translateY(0)'
              }
            }}
          >
            💳 Bills
          </Link>
          <Link
            to="/print-queue"
            style={{
              padding: '8px 16px',
              background: isActive('/print-queue') ? '#667eea' : '#f0f0f0',
              color: isActive('/print-queue') ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isActive('/print-queue')) {
                e.target.style.background = '#e0e0e0'
                e.target.style.transform = 'translateY(-2px)'
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive('/print-queue')) {
                e.target.style.background = '#f0f0f0'
                e.target.style.transform = 'translateY(0)'
              }
            }}
          >
            🖨️ Print Queue
          </Link>
          <button
            onClick={onClearData}
            style={{
              padding: '8px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px'
            }}
            title="Clear all data history"
          >
            🗑️ Clear Data
          </button>
          <div className="pill">
            <span className={`status-dot ${isOnline ? 'status-online' : 'status-offline'}`} /> {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="pill">
            <span className={`status-dot ${syncStatus === 'online' ? 'status-online' : syncStatus === 'offline' ? 'status-offline' : 'status-unknown'}`} /> Sync: {syncStatus}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}

export default Layout

