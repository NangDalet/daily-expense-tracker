import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import '@/index.css'
import { initializeTelegram, loadTelegramSdk } from '@/lib/telegram'

async function bootstrap() {
  await loadTelegramSdk()
  initializeTelegram()
  const container = document.getElementById('root')
  if (!container) throw new Error('Root container #root is missing from index.html')
  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void bootstrap()
