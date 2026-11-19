import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Catch Vite dynamic import / asset hash mismatch errors and auto-reload once
window.addEventListener('vite:preloadError', (event) => {
  console.warn('Vite preload error detected, reloading page for new version...', event)
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
