import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  LogOut,
  Menu,
  Bell,
  Plus,
  Receipt,
  Shield,
  Tags,
  Target,
  TrendingUp,
  Wallet,
  X,
  UserRound,
  Calculator,
  Moon,
  Sun,
  HardHat,
} from 'lucide-react'
import { useConstructionAccess } from '@/hooks/construction'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/layout/Avatar'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: typeof LayoutDashboard
  adminOnly?: boolean
  constructionOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/incomes', label: 'Income', icon: TrendingUp },
  { to: '/monthly', label: 'Monthly calculator', icon: Calculator },
  { to: '/categories', label: 'Categories', icon: Tags },
  { to: '/budgets', label: 'Budgets', icon: Target },
  { to: '/telegram', label: 'Telegram alerts', icon: Bell },
  { to: '/profile', label: 'My profile', icon: UserRound },
  { to: '/users', label: 'Users', icon: Shield, adminOnly: true },
  { to: '/construction', label: 'Construction payments', icon: HardHat, constructionOnly: true },
]

/** Longest-prefix match so `/expenses` and `/categories` both resolve. */
function useActiveItem(items: NavItem[]) {
  const { pathname } = useLocation()
  return (
    items
      .filter((item) => pathname === item.to || (item.to !== '/' && pathname.startsWith(item.to)))
      .sort((a, b) => b.to.length - a.to.length)[0] ?? items[0]
  )
}

function Breadcrumbs() {
  useLanguage()
  const { isAdmin } = useAuth()
  const access = useConstructionAccess()
  const active = useActiveItem(NAV_ITEMS.filter((item) => (!item.adminOnly || isAdmin) && (!item.constructionOnly || access.data?.allowed)))

  return (
    <h1 className="truncate text-sm font-semibold text-slate-900">{t(active?.label ?? 'Dashboard')}</h1>
  )
}

export function AppLayout() {
  useLanguage()
  const access = useConstructionAccess()
  const { user, isAdmin, isSuperAdmin, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isIncomePage = pathname.startsWith('/incomes')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const visibleItems = NAV_ITEMS.filter((item) => (!item.adminOnly || isAdmin) && (!item.constructionOnly || access.data?.allowed))
  const roleLabel = isSuperAdmin ? t("Super administrator") : isAdmin ? t("Administrator") : t("Member")

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell flex min-h-screen">
      {/* Mobile backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'glass-sidebar fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col',
          'transition-transform duration-200 lg:sticky lg:top-4 lg:my-4 lg:ml-4 lg:h-[calc(100dvh-2rem)] lg:translate-x-0 lg:rounded-3xl',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="glass-divider flex h-16 items-center justify-between gap-2 border-b px-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{t("Expense Tracker")}</p>
              <p className="truncate text-xs text-slate-500">{t("Daily spending")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label={t("Close navigation")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t("Main")}>
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setIsSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  'glass-nav flex items-center gap-3 px-3 py-2.5 text-sm font-medium',
                  isActive
                    ? 'text-brand-700'
                    : 'text-slate-600 hover:text-slate-900',
                )
              }
            >
              <item.icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
              <span className="truncate">{t(item.label)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="glass-divider border-t p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <NavLink to="/profile" aria-label={t("Edit my profile")}><Avatar name={user?.fullName || user?.username} src={user?.avatarUrl} /></NavLink>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {user?.fullName || user?.username}
              </p>
              <p className="truncate text-xs text-slate-500">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label={t("Sign out")}
              title={t("Sign out")}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header sticky top-3 z-20 mx-4 mt-3 flex h-16 items-center gap-3 rounded-2xl px-4 sm:mx-6 sm:px-5">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label={t("Open navigation")}
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>

          <LanguageSwitcher />
          <button type="button" onClick={toggleTheme} aria-label={theme === 'light' ? t("Switch to dark mode") : t("Switch to light mode")}
            title={theme === 'light' ? t("Dark mode") : t("Light mode")} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
            {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </button>
          <Button size="sm" onClick={() => navigate(isIncomePage ? '/incomes?new=1' : '/expenses?new=1')}>
            <Plus className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{isIncomePage ? t("Add income") : t("Add expense")}</span>
          </Button>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  useLanguage()
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t(title)}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{t(description)}</p>}
      </div>
      {action}
    </div>
  )
}
