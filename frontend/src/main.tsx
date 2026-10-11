import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/index.css'

// An open tab can still reference chunks removed by a newer deployment.
// Reload once to get the current manifest; leave repeated failures visible.
window.addEventListener('vite:preloadError', event => {
  try {
    const key = 'expense-tracker.chunk-reload'
    const lastReload = Number(sessionStorage.getItem(key) ?? 0)
    const now = Date.now()
    if (lastReload && now - lastReload < 60_000) return
    sessionStorage.setItem(key, String(now))
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root is missing from index.html')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
