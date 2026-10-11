import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Plus, Receipt, Tags, Target, TrendingUp, Wallet } from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, StatCard } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { CategorySwatch } from '@/components/ui/CategoryIcon'
import { ExpenseList } from '@/components/expenses/ExpenseList'
import { IncomeList } from '@/components/incomes/IncomeList'
import {
  useBudgetUsage,
  useCategories,
  useDashboardExpenses,
  useRecentExpenses,
  useRecentIncome,
} from '@/hooks/queries'
import { useAuth } from '@/context/AuthContext'
import type { SummaryGroupBy } from '@/lib/api/types'
import { summarizeDashboardExpenses } from '@/lib/dashboardSpending'
import {
  MONTH_NAMES,
  cn,
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatNumber,
  formatPercent,
  resolveColor,
  toIsoDate,
} from '@/lib/utils'

const GROUP_BY_OPTIONS: { value: SummaryGroupBy; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

/** Rolling window used for the dashboard trend chart. */
function trendWindow(groupBy: SummaryGroupBy): number {
  if (groupBy === 'daily') return 30
  if (groupBy === 'weekly') return 84
  return 365
}

export default function DashboardPage() {
  useLanguage()
  const { user } = useAuth()
  const [groupBy, setGroupBy] = useState<SummaryGroupBy>('daily')
  const [chosenCurrency, setChosenCurrency] = useState<string>()

  const to = useMemo(() => toIsoDate(new Date()), [])
  const from = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - trendWindow(groupBy))
    return toIsoDate(date)
  }, [groupBy])

  const spending = useDashboardExpenses(from, to)
  const currency = chosenCurrency ?? (spending.data?.some((expense) => expense.currency === 'USD')
    ? 'USD' : spending.data?.some((expense) => expense.currency === 'KHR') ? 'KHR' : 'USD')
  const totals = useMemo(() => summarizeDashboardExpenses(spending.data ?? [], currency, groupBy), [spending.data, currency, groupBy])
  const summary = { ...spending, data: totals.summary }
  const stats = { ...spending, data: totals.categories }
  const formatAxisTick = (value: number) => formatMoneyCompact(value, currency)
  const recent = useRecentExpenses(6)
  const recentIncome = useRecentIncome(6)
  const budgets = useBudgetUsage()
  const { data: categories } = useCategories()

  const firstName = user?.fullName?.split(' ')[0] || user?.username || 'there'

  const summaryRows = summary.data ?? []
  const totalSpend = totals.total
  const totalCount = totals.count
  const averageExpense = totals.average

  // Daily bars are the useful "compare the last two periods" signal; for
  // weekly/monthly buckets a line reads better with few points.
  const overallBudget = budgets.data?.find((entry) => !entry.budget.categoryId && (entry.budget.currency ?? 'USD') === currency)
  const budgetRemaining = overallBudget ? overallBudget.remainingAmount : null

  const trendData = summaryRows.map((row) => ({
    ...row,
    label: formatDate(row.periodStart, 'short'),
  }))

  const categoryData = (stats.data ?? [])
    .filter((stat) => stat.totalAmount > 0)
    .slice(0, 8)

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title={t("Welcome back, {0}", [firstName])}
        description={t("Spending in {0} from {1} to {2}", [currency, formatDate(from, 'short'), formatDate(to, 'short')])}
        action={
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-600" htmlFor="dashboard-currency">{t("Currency")}</label>
            <select id="dashboard-currency" value={currency} onChange={(event) => setChosenCurrency(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
              <option value="USD">{t("USD ($)")}</option>
              <option value="KHR">{t("KHR (៛)")}</option>
            </select>
            <div
              className="flex rounded-lg border border-slate-300 bg-white p-0.5"
              role="group"
              aria-label={t("Chart grouping")}
            >
              {GROUP_BY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGroupBy(option.value)}
                  aria-pressed={groupBy === option.value}
                  className={cn(
                    'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                    groupBy === option.value
                      ? 'bg-brand-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100',
                  )}
                >
                  {t(option.label)}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={t("Total spend")}
            value={spending.isPending ? t("Loading…") : spending.isError ? t("Unavailable") : formatMoney(totalSpend, currency)}
            hint={`${formatNumber(totalCount)} ${totalCount === 1 ? t("expense") : t("expenses")}`}
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label={t("Average expense")}
            value={spending.isPending ? t("Loading…") : spending.isError ? t("Unavailable") : formatMoney(averageExpense, currency)}
            icon={<TrendingUp className="h-5 w-5" aria-hidden />}
            tone="brand"
          />
          <StatCard
            label={t("Categories used")}
            value={formatNumber(categoryData.length)}
            hint={t("of {0} available", [formatNumber(categories?.length ?? 0)])}
            icon={<Tags className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label={budgetRemaining === null ? t("Budgets") : t("Budget left")}
            value={budgets.isPending ? t("Loading…") : budgets.isError ? t("Unavailable") : budgetRemaining === null ? t("Not set") : formatMoney(budgetRemaining, overallBudget?.budget.currency)}
            hint={
              budgets.isError ? t("Could not load budget usage") : overallBudget
                ? t("{0} of {1} used", [formatPercent(overallBudget.usagePercentage), formatMoney(
                    overallBudget.budget.monthlyLimit, overallBudget.budget.currency,
                  )])
                : t("No overall budget yet")
            }
            icon={<Target className="h-5 w-5" aria-hidden />}
            tone={
              overallBudget?.exceeded ? 'danger' : budgetRemaining !== null ? 'positive' : 'default'
            }
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader
              title={t("Spending trend")}
              description={t("Grouped by {0}", [t(GROUP_BY_OPTIONS.find(option => option.value === groupBy)?.label ?? groupBy)])}
              action={
                <Link
                  to="/expenses"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {t("View all")}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardBody className="pb-2">
              {summary.isError ? (
                <ErrorState
                  title={t("Could not load the trend")}
                  message={summary.error instanceof Error ? summary.error.message : undefined}
                  onRetry={() => void summary.refetch()}
                  className="py-10"
                />
              ) : summary.isPending ? (
                <LoadingBlock label={t("Loading trend")} />
              ) : trendData.length === 0 ? (
                <EmptyState
                  title={t("No spending in this window")}
                  description={t("Add an expense to start building your trend.")}
                  className="py-10"
                />
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {groupBy === 'daily' ? (
                      <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          width={62}
                          tickFormatter={formatAxisTick}
                        />
                        <Tooltip
                          cursor={{ fill: '#f1f5f9' }}
                          content={<TrendTooltip currency={currency} />}
                        />
                        <Bar dataKey="totalAmount" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
                      </BarChart>
                    ) : (
                      <AreaChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          width={62}
                          tickFormatter={formatAxisTick}
                        />
                        <Tooltip content={<TrendTooltip currency={currency} />} />
                        <Area
                          type="monotone"
                          dataKey="totalAmount"
                          stroke="#4f46e5"
                          strokeWidth={2}
                          fill="url(#spendFill)"
                        />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("By category")} description={t("Share of total spend")} />
            <CardBody>
              {stats.isError ? (
                <ErrorState title={t("Could not load the breakdown")} onRetry={() => void stats.refetch()} />
              ) : stats.isPending ? (
                <LoadingBlock label={t("Loading breakdown")} />
              ) : categoryData.length === 0 ? (
                <EmptyState
                  title={t("No categorised spend")}
                  description={t("Category totals appear once you tag expenses.")}
                  className="py-10"
                />
              ) : (
                <>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="totalAmount"
                          nameKey="categoryName"
                          innerRadius={52}
                          outerRadius={78}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {categoryData.map((entry) => (
                            <Cell
                              key={entry.categoryId ?? entry.categoryName}
                              fill={resolveColor(entry.categoryColor, entry.categoryId)}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<CategoryTooltip currency={currency} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <ul className="mt-2 space-y-2">
                    {categoryData.slice(0, 6).map((entry) => {
                      const color = resolveColor(entry.categoryColor, entry.categoryId)
                      return (
                        <li key={entry.categoryId ?? entry.categoryName} className="flex items-center gap-2.5">
                          <CategorySwatch
                            iconName={entry.categoryIcon}
                            color={color}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                            {entry.categoryName ?? 'Uncategorised'}
                          </span>
                          <span className="text-sm font-medium tabular-nums text-slate-900">
                            {formatMoney(entry.totalAmount, currency)}
                          </span>
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500">
                            {formatPercent(entry.percentage)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title={t("Recent income")} action={
            <Link to="/incomes" className="text-xs font-medium text-brand-600 hover:text-brand-700">{t("View all")}</Link>
          } />
          {recentIncome.isError ? (
            <ErrorState title={t("Could not load income")} onRetry={() => void recentIncome.refetch()} />
          ) : recentIncome.isPending ? (
            <LoadingBlock label={t("Loading income")} />
          ) : (recentIncome.data?.length ?? 0) === 0 ? (
            <EmptyState title={t("No income recorded")} description={t("Record salary, freelance payments or other income.")} action={
              <Link to="/incomes?new=1"><Button size="sm">{t("Add income")}</Button></Link>
            } />
          ) : (
            <IncomeList incomes={recentIncome.data ?? []} />
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("Recent expenses")}
              action={
                <Link
                  to="/expenses"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {t("View all")}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            {recent.isPending ? (
              <LoadingBlock label={t("Loading expenses")} />
            ) : (recent.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" aria-hidden />}
                title={t("Nothing logged yet")}
                description={t("Your six most recent expenses will show up here.")}
                  action={
                    <Link to="/expenses">
                      <Button size="sm">
                        <Plus className="h-4 w-4" aria-hidden />
                        {t("Add your first expense")}</Button>
                    </Link>
                  }
                />
              ) : (
                <ExpenseList expenses={recent.data ?? []} />
              )}
          </Card>

          <Card>
            <CardHeader
              title={t("Budget status")}
              description={
                budgets.data?.[0]
                  ? `${t(MONTH_NAMES[budgets.data[0].budget.month - 1])} ${budgets.data[0].budget.year}`
                  : undefined
              }
              action={
                <Link
                  to="/budgets"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  {t("Manage")}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardBody className="space-y-4">
              {budgets.isError ? (
                <ErrorState title={t("Could not load budgets")} onRetry={() => void budgets.refetch()} />
              ) : budgets.isPending ? (
                <LoadingBlock label={t("Loading budgets")} />
              ) : (budgets.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<Target className="h-6 w-6" aria-hidden />}
                  title={t("No budgets this month")}
                  description={t("Set a limit to track how much is left.")}
                  action={
                    <Link to="/budgets">
                      <Button size="sm" variant="outline">
                        {t("Set a budget")}</Button>
                    </Link>
                  }
                  className="py-8"
                />
              ) : (
                budgets.data?.slice(0, 5).map((entry) => {
                  return (
                    <div key={entry.budget.id}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                          {!entry.budget.categoryId && (
                            <Wallet className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                          )}
                          <span className="truncate">
                            {entry.budget.category?.name ?? t("Overall budget")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          <span
                            className={cn(
                              'font-semibold',
                              entry.exceeded ? 'text-red-600' : 'text-slate-800',
                            )}
                          >
                            {formatMoney(entry.spentAmount, entry.budget.currency)}
                          </span>
                          {' / '}
                          {formatMoney(entry.budget.monthlyLimit, entry.budget.currency)}
                        </span>
                      </div>
                      <ProgressBar
                        percentage={entry.usagePercentage}
                        label={t("{0} usage", [entry.budget.category?.name ?? t("Overall budget")])}
                        className="h-1.5"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {entry.exceeded
                          ? t("Over by {0}", [formatMoney(Math.abs(entry.remainingAmount), entry.budget.currency)])
                          : t("{0} left", [formatMoney(entry.remainingAmount, entry.budget.currency)])}
                        {' · '}
                        {formatPercent(entry.usagePercentage)}
                      </p>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
/* -------------------------------------------------------------------------- */
/* Recharts tooltips                                                          */
/* -------------------------------------------------------------------------- */

interface TooltipRow {
  label: string
  value: string
}

function TrendTooltip({
  currency,
  active,
  payload,
}: {
  currency: string
  active?: boolean
  payload?: { payload: { periodStart: string; totalAmount: number; expenseCount: number; averageAmount: number } }[]
}) {
  useLanguage()
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  const rows: TooltipRow[] = [
    { label: t("Total"), value: formatMoney(row.totalAmount, currency) },
    { label: t("Expenses"), value: formatNumber(row.expenseCount) },
    { label: t("Average"), value: formatMoney(row.averageAmount, currency) },
  ]

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-900">{formatDate(row.periodStart)}</p>
      <ul className="mt-1 space-y-0.5">
        {rows.map((item) => (
          <li key={item.label} className="flex items-center gap-3 text-xs">
            <span className="text-slate-500">{item.label}</span>
            <span className="ml-auto font-medium tabular-nums text-slate-900">{item.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CategoryTooltip({
  currency,
  active,
  payload,
}: {
  currency: string
  active?: boolean
  payload?: { payload: { categoryName?: string; totalAmount: number; expenseCount: number; percentage: number } }[]
}) {
  useLanguage()
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-900">
        {row.categoryName ?? 'Uncategorised'}
      </p>
      <ul className="mt-1 space-y-0.5">
        <li className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">{t("Total")}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatMoney(row.totalAmount, currency)}
          </span>
        </li>
        <li className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">{t("Share")}</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatPercent(row.percentage)}
          </span>
        </li>
      </ul>
    </div>
  )
}

