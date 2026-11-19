import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import '../App.css'

function Layout({ children, isOnline, syncStatus, onClearData, showOrderHeader, orderForm, flowStarted, onBackToTables, onGoHome }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [localIP, setLocalIP] = useState('')
  const [showSyncModal, setShowSyncModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [updateMsg, setUpdateMsg] = useState('')
  const [showVaultModal, setShowVaultModal] = useState(false)
  const [logoClicks, setLogoClicks] = useState(0)

  // Secret Owner Vault shortcut: Ctrl + Alt + O or Ctrl + Shift + O
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey && e.altKey && (e.key === 'o' || e.key === 'O')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'o' || e.key === 'O'))
      ) {
        e.preventDefault()
        setShowVaultModal((prev) => !prev)
      } else if (e.key === 'Escape' && showVaultModal) {
        setShowVaultModal(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showVaultModal])

  const handleBrandClick = () => {
    setLogoClicks((prev) => {
      const next = prev + 1
      if (next >= 5) {
        setShowVaultModal(true)
        return 0
      }
      setTimeout(() => setLogoClicks(0), 3000)
      return next
    })
  }

  useEffect(() => {
    // Listen for background auto-updater notifications
    if (typeof window !== 'undefined' && window.electronAPI?.onUpdateStatus) {
      const unsub = window.electronAPI.onUpdateStatus((data) => {
        if (data?.status === 'updating') {
          setUpdateMsg('⏳ Updating app from GitHub...')
        } else if (data?.status === 'updated') {
          setUpdateMsg('✓ Updated to latest! Reloading...')
        } else if (data?.status === 'failed') {
          setUpdateMsg('⚠️ Update attempt failed.')
          setTimeout(() => setUpdateMsg(''), 5000)
        } else if (data?.status === 'latest') {
          setUpdateMsg('✓ Up to date (' + (data.commit || '') + ')')
          setTimeout(() => setUpdateMsg(''), 4000)
        }
      })
      return () => {
        if (unsub) unsub()
      }
    }
  }, [])

  useEffect(() => {
    // 1. Try Electron native IP detection
    if (typeof window !== 'undefined' && window.electronAPI?.getLocalIP) {
      window.electronAPI.getLocalIP().then((ip) => {
        if (ip && ip !== '127.0.0.1') setLocalIP(ip)
      }).catch(() => {})
    }
    // 2. Fetch from sync-server network info
    fetch('http://localhost:5000/api/network-info')
      .then((r) => r.json())
      .then((data) => {
        if (data?.localIP && data.localIP !== '127.0.0.1') {
          setLocalIP(data.localIP)
        }
      })
      .catch(() => {})
  }, [])

  const captainUrl = localIP ? `http://${localIP}:5000` : 'http://localhost:5000'

  const copyCaptainUrl = () => {
    navigator.clipboard?.writeText(captainUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }
  
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
        <div className="brand" onClick={handleBrandClick} style={{ cursor: 'pointer' }}>
          <span role="img" aria-label="pos">
            💳
          </span>
          PetPooja POS
          <span className="pill">Offline-first</span>
          {typeof window !== 'undefined' && window.electronAPI?.isElectron && (
            <span className="pill" style={{ background: '#3b82f6', color: '#fff', fontWeight: 'bold' }}>
              ⚡ Silent Print Active
            </span>
          )}
          {updateMsg && (
            <span className="pill" style={{ background: '#7c3aed', color: '#fff', fontWeight: 'bold' }}>
              {updateMsg}
            </span>
          )}
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
          <button
            type="button"
            className="pill"
            onClick={() => setShowSyncModal(true)}
            style={{
              background: '#047857',
              color: '#ecfdf5',
              border: '1px solid #059669',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Click to view Wi-Fi Captain App address"
          >
            📡 Wi-Fi: {localIP || 'Connecting...'}
          </button>
          <div className="pill">
            <span className={`status-dot ${isOnline ? 'status-online' : 'status-offline'}`} /> {isOnline ? 'Online' : 'Offline'}
          </div>
          <div className="pill">
            <span className={`status-dot ${syncStatus === 'online' ? 'status-online' : syncStatus === 'offline' ? 'status-offline' : 'status-unknown'}`} /> Sync: {syncStatus}
          </div>
        </div>
      </header>

      {/* Wi-Fi Sync Instructions Modal */}
      {showSyncModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
          }}
          onClick={() => setShowSyncModal(false)}
        >
          <div
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              padding: '24px 28px',
              borderRadius: '12px',
              maxWidth: '520px',
              width: '90%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid #334155',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📡 Wi-Fi Local Sync (Zero Cloud)
              </h2>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '14px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Both Captain App (mobile phones) and Desktop POS sync directly over your local restaurant Wi-Fi router. 
              No internet or cloud storage is needed.
            </p>

            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155', marginBottom: '16px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '6px' }}>
                📱 Open on Captain Phone / Tablet:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={captainUrl}
                  style={{
                    flex: 1,
                    background: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #475569',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                />
                <button
                  type="button"
                  onClick={copyCaptainUrl}
                  style={{
                    background: copied ? '#10b981' : '#3b82f6',
                    color: 'white',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                  }}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.6' }}>
              <strong>Quick 2-Step Setup:</strong>
              <ol style={{ paddingLeft: '20px', margin: '8px 0 0 0' }}>
                <li>Connect all captain phones to the <strong>same Wi-Fi</strong> as this PC.</li>
                <li>Open <strong>{captainUrl}</strong> in Safari or Chrome on the phone.</li>
              </ol>
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#064e3b', color: '#a7f3d0', borderRadius: '6px', fontSize: '12px' }}>
                ✓ Any order created by a Captain will instantly appear on this screen and automatically queue in the thermal print center!
              </div>
            </div>

            {/* Silent Auto-Update Section */}
            <div style={{ marginTop: '16px', background: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#f8fafc' }}>
                    🔄 GitHub Silent Auto-Updates
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Checks for new commits automatically every 5 minutes.
                  </div>
                </div>
                {typeof window !== 'undefined' && window.electronAPI?.checkForUpdates && (
                  <button
                    type="button"
                    onClick={() => {
                      setUpdateMsg('⏳ Checking GitHub for updates...')
                      window.electronAPI.checkForUpdates()
                    }}
                    style={{
                      background: '#4338ca',
                      color: 'white',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    }}
                  >
                    Check Now
                  </button>
                )}
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                style={{
                  background: '#334155',
                  color: 'white',
                  border: 'none',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '13px',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showVaultModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 18px',
              background: '#0b0f19',
              borderBottom: '1px solid #1f2937',
            }}
          >
            <div
              style={{
                color: '#f97316',
                fontWeight: 'bold',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span>🔐 Executive Audit Vault</span>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'normal' }}>
                (Stealth Local Archive • Private)
              </span>
            </div>
            <button
              onClick={() => setShowVaultModal(false)}
              style={{
                background: '#1f2937',
                color: '#f3f4f6',
                border: '1px solid #374151',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
              }}
            >
              ✕ Close
            </button>
          </div>
          <iframe
            src="http://localhost:5000/owner-vault"
            style={{
              flex: 1,
              width: '100%',
              height: '100%',
              border: 'none',
              background: '#0b0f19',
            }}
            title="Owner Vault"
          />
        </div>
      )}
      {children}
    </div>
  )
}

export default Layout

