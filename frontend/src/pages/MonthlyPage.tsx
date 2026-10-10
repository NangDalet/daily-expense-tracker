import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownLeft, ArrowUpRight, Wallet, Calculator } from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/Card'
import { Input } from '@/components/ui/Field'
import { Alert } from '@/components/ui/Alert'
import { financeApi } from '@/lib/api/endpoints'
import { formatMoney, toIsoDate } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

export default function MonthlyPage() {
  const { user } = useAuth()
  const [period, setPeriod] = useState(() => toIsoDate(new Date()).slice(0, 7))
  const [currency, setCurrency] = useState('USD')
  const [plannedIncome, setPlannedIncome] = useState('')
  const [plannedExpenses, setPlannedExpenses] = useState('')
  const validPeriod = /^\d{4}-(0[1-9]|1[0-2])$/.test(period) && Number(period.slice(0, 4)) >= 1900 && Number(period.slice(0, 4)) <= 2100
  const report = useQuery({
    queryKey: ['monthly-finances', user?.id, period],
    queryFn: ({ signal }) => financeApi.monthly(Number(period.slice(0, 4)), Number(period.slice(5)), signal),
    enabled: validPeriod,
    staleTime: 0,
  })
  const totals = report.data?.find((row) => row.currency === currency)
  const available = validPeriod && report.isSuccess
  const amount = (value: number | undefined) => available ? formatMoney(value ?? 0, currency) : '—'
  const numberOf = (value: number | undefined, type: string) => available ? `${value ?? 0} ${type}` : 'Loading monthly totals'
  const projectedBalance = (Math.round(Number(plannedIncome || 0) * 100) - Math.round(Number(plannedExpenses || 0) * 100)) / 100
  const validProjection = [plannedIncome, plannedExpenses].every((value) => /^\d*(\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) <= 999999999)

  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeading title="Monthly calculator" description="See your income, expenses, and balance for a calendar month." />
    <Card><CardBody className="flex flex-wrap items-end gap-4">
      <Input type="month" label="Month" min="1900-01" max="2100-12" value={period} onChange={(event) => setPeriod(event.target.value)} />
      <div><label htmlFor="monthly-currency" className="mb-1.5 block text-sm font-medium text-slate-700">Currency</label>
        <select id="monthly-currency" value={currency} onChange={(event) => { setCurrency(event.target.value); setPlannedIncome(''); setPlannedExpenses('') }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="USD">USD ($)</option><option value="KHR">KHR (៛)</option>
        </select>
      </div>
      <p className="pb-2 text-xs text-slate-500">USD and KHR are calculated separately.</p>
    </CardBody></Card>
    {!validPeriod && <Alert tone="error">Choose a valid month between 1900 and 2100.</Alert>}
    {report.isError && <Alert tone="error">{report.error.message}<button className="ml-2 underline" onClick={() => void report.refetch()}>Try again</button></Alert>}
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label="Monthly income" value={amount(totals?.totalIncome)} hint={numberOf(totals?.incomeCount, 'income entries')} icon={<ArrowDownLeft />} tone="positive" />
      <StatCard label="Monthly expenses" value={amount(totals?.totalExpenses)} hint={numberOf(totals?.expenseCount, 'expenses')} icon={<ArrowUpRight />} tone="warning" />
      <StatCard label="Monthly balance" value={amount(totals?.balance)} hint="Income minus expenses" icon={<Wallet />} tone={(totals?.balance ?? 0) < 0 ? 'danger' : 'brand'} />
    </div>
    {available && !totals && <p className="text-sm text-slate-500">No {currency} income or expenses recorded for this month.</p>}
    <Card><CardHeader title="Plan your month" description="Try different amounts to calculate a monthly balance." />
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={`Planned income (${currency})`} type="number" min="0" max="999999999" step="0.01" value={plannedIncome} onChange={(event) => setPlannedIncome(event.target.value)} placeholder="0.00" />
          <Input label={`Planned expenses (${currency})`} type="number" min="0" max="999999999" step="0.01" value={plannedExpenses} onChange={(event) => setPlannedExpenses(event.target.value)} placeholder="0.00" />
        </div>
        <div className="rounded-xl bg-brand-50 p-4"><p className="flex items-center gap-2 text-sm text-slate-600"><Calculator className="h-4 w-4" />Planned balance</p>
          <p className="mt-1 text-2xl font-semibold text-brand-700">{validProjection ? formatMoney(projectedBalance, currency) : 'Enter valid amounts'}</p>
          <p className="mt-1 text-xs text-slate-500">These planning amounts do not create income or expense entries.</p>
        </div>
      </CardBody>
    </Card>
  </div>
}
