import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, Calculator, ChevronRight, HardHat, House, LogOut, MoreHorizontal, Plus, Receipt, Shield, Tags, Target, TrendingUp, UserRound, Wallet, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useConstructionAccess } from '@/hooks/construction'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'
import { Avatar } from '@/components/layout/Avatar'
import { Modal } from '@/components/ui/Modal'
import { telegramWebApp } from '@/lib/telegram'
import { MiniAppHome } from './MiniAppHome'
import './miniapp.css'

export function MiniAppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { data: access } = useConstructionAccess()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [more, setMore] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  function selectTab() {
    setMore(false)
    telegramWebApp()?.HapticFeedback?.selectionChanged()
  }

  useEffect(() => { setMore(false); window.scrollTo(0, 0) }, [pathname])
  useEffect(() => {
    const app = telegramWebApp()
    if (!app) return
    const back = () => {
      if (document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      } else if (more) setMore(false)
      else navigate('/')
    }
    if (pathname === '/' && !more && !createOpen) app.BackButton.hide()
    else app.BackButton.show()
    app.BackButton.onClick(back)
    app.setHeaderColor?.('bg_color')
    app.setBackgroundColor?.('bg_color')
    return () => { app.BackButton.offClick(back); app.BackButton.hide() }
  }, [pathname, more, createOpen, navigate])

  const menu = [
    { to: '/incomes', label: 'Income', icon: TrendingUp },
    { to: '/monthly', label: 'Monthly calculator', icon: Calculator },
    { to: '/categories', label: 'Categories', icon: Tags },
    { to: '/telegram', label: 'Telegram connection', icon: Bell },
    { to: '/profile', label: 'My profile', icon: UserRound },
    ...(access?.allowed ? [{ to: '/construction', label: 'Construction payments', icon: HardHat }] : []),
    ...(isAdmin ? [{ to: '/users', label: 'Manage users', icon: Shield }] : []),
  ]

  return <div className="miniapp-layout">
    <header className="miniapp-header">
      <Link to="/" className="miniapp-brand"><span><Wallet size={20} /></span><div><strong>Daily Expense</strong><small>YOUR EVERYDAY MONEY</small></div></Link>
      <button className="miniapp-more-toggle" aria-label="More" aria-expanded={more} onClick={() => { setMore(value => !value); telegramWebApp()?.HapticFeedback?.selectionChanged() }}><MoreHorizontal size={25} /></button>
    </header>
    <main className="miniapp-main">
      {more ? <section className="miniapp-more" aria-label="More features">
        <div className="miniapp-section-title"><h1>More from your tracker</h1><button onClick={() => setMore(false)} aria-label="Close more menu"><X size={22} /></button></div>
        <div className="miniapp-panel">{menu.map(({ to, label, icon: Icon }) => <Link to={to} key={to} onClick={() => setMore(false)} className="miniapp-menu-row"><Icon size={20} /><span>{label}</span><ChevronRight size={17} /></Link>)}</div>
        <div className="miniapp-menu-settings"><LanguageSwitcher /><button onClick={() => { logout(); navigate('/miniapp', { replace: true }) }}><LogOut size={17} /> Sign out</button></div>
      </section> : pathname === '/' ? <MiniAppHome /> : <Outlet />}
    </main>
    <nav className="miniapp-nav" aria-label="Mini App navigation">
      <NavLink to="/" end onClick={selectTab} className={({ isActive }) => !more && isActive ? 'active' : ''}><House size={24} aria-hidden /><span>Home</span></NavLink>
      <NavLink to="/expenses" onClick={selectTab} className={({ isActive }) => !more && isActive ? 'active' : ''}><Receipt size={24} aria-hidden /><span>Expenses</span></NavLink>
      <button className={`miniapp-add${createOpen ? ' active' : ''}`} aria-label="Create new entry" aria-haspopup="dialog" aria-expanded={createOpen} onClick={() => { selectTab(); setCreateOpen(true) }}><span><Plus size={25} aria-hidden /></span><small>Create</small></button>
      <NavLink to="/budgets" onClick={selectTab} className={({ isActive }) => !more && isActive ? 'active' : ''}><Target size={24} aria-hidden /><span>Budgets</span></NavLink>
      <NavLink to="/profile" onClick={selectTab} className={({ isActive }) => `miniapp-profile-tab${!more && isActive ? ' active' : ''}`}><span className="miniapp-profile-ring"><Avatar name={user?.fullName || user?.username} src={user?.avatarUrl} size="sm" /></span><span>Profile</span></NavLink>
    </nav>
    <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create" description="What would you like to add?" size="sm">
      <div className="miniapp-create-actions">
        <Link className="miniapp-create-row text-slate-900 hover:bg-slate-100" to="/expenses?new=1" onClick={() => setCreateOpen(false)}><span className="miniapp-create-icon miniapp-create-expense"><Receipt size={23} /></span><span><strong>Add expense</strong><small className="text-slate-500">Record something you spent</small></span><ChevronRight size={18} /></Link>
        <Link className="miniapp-create-row text-slate-900 hover:bg-slate-100" to="/incomes?new=1" onClick={() => setCreateOpen(false)}><span className="miniapp-create-icon miniapp-create-income"><TrendingUp size={23} /></span><span><strong>Add income</strong><small className="text-slate-500">Record money coming in</small></span><ChevronRight size={18} /></Link>
      </div>
    </Modal>
  </div>
}
