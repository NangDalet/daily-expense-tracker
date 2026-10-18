import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Plus, Receipt, RefreshCw, Target } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { financeApi } from '@/lib/api/endpoints'
import { cashApi } from '@/lib/api/cash'
import { useRecentExpenses } from '@/hooks/queries'
import { formatDate, formatMoney } from '@/lib/utils'
import { LoadingBlock } from '@/components/ui/States'
import { Alert } from '@/components/ui/Alert'

export function MiniAppHome() {
  const { user } = useAuth()
  const [currency, setCurrency] = useState('USD')
  const now = new Date()
  const year = now.getFullYear(), month = now.getMonth() + 1
  const finances = useQuery({ queryKey: ['monthly-finances', year, month], queryFn: () => financeApi.monthly(year, month) })
  const cash = useQuery({ queryKey: ['cash', 'balances'], queryFn: cashApi.balances })
  const recent = useRecentExpenses(5)
  const summary = finances.data?.find(row => row.currency === currency)
  const wallet = cash.data?.find(row => row.currency === currency)
  const name = (user?.fullName || user?.username || 'there').split(' ')[0]

  return <div className="miniapp-home">
    <section className="miniapp-welcome"><div><p className="miniapp-eyebrow">A LITTLE CLARITY, EVERY DAY</p><h1>Hello, {name} <span aria-hidden>☀</span></h1><p>Let’s make your money go further.</p></div></section>
    <div className="miniapp-period"><span>{now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span><div role="group" aria-label="Currency">{['USD', 'KHR'].map(value => <button key={value} aria-pressed={currency === value} className={currency === value ? 'selected' : ''} onClick={() => setCurrency(value)}>{value}</button>)}</div></div>
    {finances.isPending ? <LoadingBlock label="Loading your monthly balance" /> : finances.isError ? <Alert tone="error" title="Could not load your balance"><button onClick={() => void finances.refetch()}>Try again</button></Alert> : <section className="miniapp-balance" aria-label="Monthly balance">
      <div className="miniapp-balance-top"><span>Monthly balance</span><span>{currency}</span></div>
      <strong className="miniapp-balance-amount">{formatMoney(summary?.balance ?? 0, currency)}</strong>
      <p>Income minus expenses this month</p>
      <div className="miniapp-balance-details"><div><ArrowDownLeft size={19} /><span>Income<strong>{formatMoney(summary?.totalIncome ?? 0, currency)}</strong></span></div><div><ArrowUpRight size={19} /><span>Spent<strong>{formatMoney(summary?.totalExpenses ?? 0, currency)}</strong></span></div></div>
    </section>}
    <div className="miniapp-quick-actions"><Link to="/expenses?new=1"><span><Plus size={21} /></span>Add expense</Link><Link to="/incomes?new=1"><span><ArrowDownLeft size={21} /></span>Add income</Link><Link to="/budgets"><span><Target size={21} /></span>My budgets</Link></div>
    <Link to="/expenses" className="miniapp-cash miniapp-panel"><div><span>Cash wallet</span>{cash.isPending ? <strong>Loading…</strong> : cash.isError ? <strong>Unavailable</strong> : <strong>{formatMoney(wallet?.remainingAmount ?? 0, currency)}</strong>}<small>Remaining from your cash top-ups</small></div><ArrowRight size={20} /></Link>
    <section aria-label="Recent expenses">
      <div className="miniapp-section-title"><h2>Recent expenses</h2><Link to="/expenses">View all <ArrowRight size={14} /></Link></div>
      {recent.isPending ? <LoadingBlock label="Loading recent expenses" /> : recent.isError ? <Alert tone="error" title="Could not load expenses"><button onClick={() => void recent.refetch()}><RefreshCw size={15} /> Retry</button></Alert> : !recent.data?.length ? <div className="miniapp-empty miniapp-panel"><Receipt size={28} /><h3>A fresh start</h3><p>Your first expense is the first step to a clearer picture.</p><Link to="/expenses?new=1">Add your first expense <ArrowRight size={15} /></Link></div> : <div className="miniapp-panel miniapp-transactions">{recent.data.map(expense => <Link to="/expenses" key={expense.id} className="miniapp-transaction"><span className="miniapp-transaction-icon"><Receipt size={19} /></span><div><strong>{expense.description || expense.category?.name || 'Expense'}</strong><small>{expense.category?.name || 'Uncategorized'} · {formatDate(expense.expenseDate, 'short')}</small></div><b>−{formatMoney(expense.amount, expense.currency)}</b></Link>)}</div>}
    </section>
    <p className="miniapp-home-note">Small habits. A clearer picture.</p>
  </div>
}
