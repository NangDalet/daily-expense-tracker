/** The SDK is only a UI bridge. Identity is verified by the backend using initData. */
export interface TelegramWebApp {
  initData: string
  colorScheme: 'light' | 'dark'
  themeParams: Record<string, string | undefined>
  ready: () => void
  expand: () => void
  isVersionAtLeast?: (version: string) => boolean
  onEvent: (event: string, handler: () => void) => void
  offEvent: (event: string, handler: () => void) => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  openTelegramLink?: (url: string) => void
  requestWriteAccess?: (callback: (allowed: boolean) => void) => void
  BackButton: { show: () => void; hide: () => void; onClick: (handler: () => void) => void; offClick: (handler: () => void) => void }
  HapticFeedback?: { selectionChanged: () => void }
}

declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp } }
}

const MINI_APP_KEY = 'expense-tracker.miniapp'
const TELEGRAM_LAUNCH = new URLSearchParams(window.location.hash.slice(1)).has('tgWebAppData')

export function hasTelegramLaunch(): boolean { return TELEGRAM_LAUNCH || Boolean(telegramWebApp()) }

export function telegramWebApp(): TelegramWebApp | undefined {
  const app = window.Telegram?.WebApp
  return app?.initData ? app : undefined
}

/** Only a UI hint: this must never be used to authenticate or link an account. */
export function telegramAllowsMessages(): boolean {
  try {
    const user = new URLSearchParams(telegramWebApp()?.initData).get('user')
    return Boolean(user && JSON.parse(user).allows_write_to_pm === true)
  } catch { return false }
}

export function isMiniApp(): boolean {
  return Boolean(telegramWebApp()) || window.location.pathname === '/miniapp'
    || sessionStorage.getItem(MINI_APP_KEY) === '1'
}

export function enterMiniApp() { sessionStorage.setItem(MINI_APP_KEY, '1') }

/** Keep embedded sessions separate from the normal website and other launches. */
export function authStorage(): Storage { return isMiniApp() ? sessionStorage : localStorage }

export function initializeTelegram() {
  if (!isMiniApp()) return
  enterMiniApp()
  telegramWebApp()?.ready()
  telegramWebApp()?.expand()
}

/** Load the official bridge before React mounts, only for embedded/preview launches. */
export async function loadTelegramSdk(): Promise<void> {
  if (window.Telegram?.WebApp) return
  if (!isMiniApp() && !hasTelegramLaunch()) return
  enterMiniApp()
  await new Promise<void>((resolve) => {
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-web-app.js?64'
    const timer = window.setTimeout(resolve, 8000)
    const finish = () => { window.clearTimeout(timer); resolve() }
    script.onload = finish
    script.onerror = finish
    document.head.appendChild(script)
  })
}

export function openTelegramLink(url: string) {
  const app = telegramWebApp()
  if (app?.openTelegramLink) app.openTelegramLink(url)
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export function leaveMiniApp() {
  sessionStorage.removeItem(MINI_APP_KEY)
  window.location.assign('/')
}
