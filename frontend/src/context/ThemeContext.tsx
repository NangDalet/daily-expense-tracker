import { createContext, useContext, useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { telegramWebApp } from '@/lib/telegram'

type Theme = 'light' | 'dark'
const ThemeContext = createContext<{ theme: Theme; toggleTheme: () => void } | null>(null)
const THEME_KEY = 'expense-tracker.theme'

function initialTheme(): Theme {
  if (telegramWebApp()) return telegramWebApp()!.colorScheme
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* Use the device preference when storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  useEffect(() => {
    const app = telegramWebApp()
    if (!app) return
    const sync = () => setTheme(app.colorScheme)
    app.onEvent('themeChanged', sync)
    return () => app.offEvent('themeChanged', sync)
  }, [])
  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.colorScheme = theme
    try { if (!telegramWebApp()) localStorage.setItem(THEME_KEY, theme) } catch { /* The theme still works in this tab. */ }
  }, [theme])
  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === 'light' ? 'dark' : 'light') }}>
    {children}
  </ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme requires ThemeProvider')
  return context
}
