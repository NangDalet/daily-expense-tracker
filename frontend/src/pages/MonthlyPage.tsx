import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
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
import { PrivateIncomeAmount } from '@/components/incomes/PrivateIncomeAmount'
import { sumMoney } from '@/lib/currency'

export default function MonthlyPage() {
  useLanguage()
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
  const rows = report.data ?? []
  const totalIncome = sumMoney(rows.map((row) => ({ amount: row.totalIncome, currency: row.currency })), currency)
  const totalExpenses = sumMoney(rows.map((row) => ({ amount: row.totalExpenses, currency: row.currency })), currency)
  const totals = {
    totalIncome,
    totalExpenses,
    balance: sumMoney(rows.flatMap((row) => [
      { amount: row.totalIncome, currency: row.currency },
      { amount: -row.totalExpenses, currency: row.currency },
    ]), currency),
    incomeCount: rows.reduce((sum, row) => sum + row.incomeCount, 0),
    expenseCount: rows.reduce((sum, row) => sum + row.expenseCount, 0),
  }
  const available = validPeriod && report.isSuccess
  const amount = (value: number | undefined) => available ? formatMoney(value ?? 0, currency) : '—'
  const numberOf = (value: number | undefined, type: string) => available ? `${value ?? 0} ${type}` : t("Loading monthly totals")
  const projectedBalance = (Math.round(Number(plannedIncome || 0) * 100) - Math.round(Number(plannedExpenses || 0) * 100)) / 100
  const validProjection = [plannedIncome, plannedExpenses].every((value) => /^\d*(\.\d{0,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) <= 999999999)

  return <div className="mx-auto max-w-5xl space-y-6">
    <PageHeading title={t("Monthly calculator")} description={t("See your income, expenses, and balance for a calendar month.")} />
    <Card><CardBody className="flex flex-wrap items-end gap-4">
      <Input type="month" label={t("Month")} min="1900-01" max="2100-12" value={period} onChange={(event) => setPeriod(event.target.value)} />
      <div><label htmlFor="monthly-currency" className="mb-1.5 block text-sm font-medium text-slate-700">{t("Currency")}</label>
        <select id="monthly-currency" value={currency} onChange={(event) => { setCurrency(event.target.value); setPlannedIncome(''); setPlannedExpenses('') }} className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
          <option value="USD">{t("USD ($)")}</option><option value="KHR">{t("KHR (៛)")}</option>
        </select>
      </div>
      <p className="pb-2 text-xs text-slate-500">{t('Includes USD and KHR at 1 USD = 4,000 KHR.')}</p>
    </CardBody></Card>
    {!validPeriod && <Alert tone="error">{t("Choose a valid month between 1900 and 2100.")}</Alert>}
    {report.isError && <Alert tone="error">{t(report.error.message)}<button className="ml-2 underline" onClick={() => void report.refetch()}>{t("Try again")}</button></Alert>}
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard label={t("Monthly income")} value={available ? <PrivateIncomeAmount amount={totals?.totalIncome ?? 0} currency={currency} scope={period} /> : t("Loading monthly totals")} hint={numberOf(totals?.incomeCount, t("income entries"))} icon={<ArrowDownLeft />} tone="positive" />
      <StatCard label={t("Monthly expenses")} value={amount(totals?.totalExpenses)} hint={numberOf(totals?.expenseCount, t("expenses"))} icon={<ArrowUpRight />} tone="warning" />
      <StatCard label={t("Monthly balance")} value={available ? <PrivateIncomeAmount amount={totals?.balance ?? 0} currency={currency} scope={period} /> : t("Loading monthly totals")} hint={t("Income minus expenses")} icon={<Wallet />} tone="brand" />
    </div>
    {available && rows.length === 0 && <p className="text-sm text-slate-500">{t('No income or expenses recorded for this month.')}</p>}
    <Card><CardHeader title={t("Plan your month")} description={t("Try different amounts to calculate a monthly balance.")} />
      <CardBody className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t("Planned income ({0})", [currency])} type="number" min="0" max="999999999" step="0.01" value={plannedIncome} onChange={(event) => setPlannedIncome(event.target.value)} placeholder="0.00" />
          <Input label={t("Planned expenses ({0})", [currency])} type="number" min="0" max="999999999" step="0.01" value={plannedExpenses} onChange={(event) => setPlannedExpenses(event.target.value)} placeholder="0.00" />
        </div>
        <div className="rounded-xl bg-brand-50 p-4"><p className="flex items-center gap-2 text-sm text-slate-600"><Calculator className="h-4 w-4" />{t("Planned balance")}</p>
          <p className="mt-1 text-2xl font-semibold text-brand-700">{validProjection ? formatMoney(projectedBalance, currency) : t("Enter valid amounts")}</p>
          <p className="mt-1 text-xs text-slate-500">{t("These planning amounts do not create income or expense entries.")}</p>
        </div>
      </CardBody>
    </Card>
  </div>
}
