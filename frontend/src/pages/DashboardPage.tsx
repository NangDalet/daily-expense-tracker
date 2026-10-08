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
import {
  useBudgetUsage,
  useCategories,
  useCategoryStats,
  useExpenseSummary,
  useRecentExpenses,
} from '@/hooks/queries'
import { useAuth } from '@/context/AuthContext'
import type { SummaryGroupBy } from '@/lib/api/types'
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

/** Recharts passes (value, index) to axis formatters; only the value is used. */
const formatAxisTick = (value: number) => formatMoneyCompact(value)

export default function DashboardPage() {
  const { user } = useAuth()
  const [groupBy, setGroupBy] = useState<SummaryGroupBy>('daily')

  const to = useMemo(() => toIsoDate(new Date()), [])
  const from = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - trendWindow(groupBy))
    return toIsoDate(date)
  }, [groupBy])

  const summary = useExpenseSummary({ groupBy, from, to })
  const stats = useCategoryStats(from, to)
  const recent = useRecentExpenses(6)
  const budgets = useBudgetUsage()
  const { data: categories } = useCategories()

  const firstName = user?.fullName?.split(' ')[0] || user?.username || 'there'

  const summaryRows = summary.data ?? []
  const totalSpend = summaryRows.reduce((sum, row) => sum + row.totalAmount, 0)
  const totalCount = summaryRows.reduce((sum, row) => sum + row.expenseCount, 0)
  const averageExpense = totalCount > 0 ? totalSpend / totalCount : 0

  // Daily bars are the useful "compare the last two periods" signal; for
  // weekly/monthly buckets a line reads better with few points.
  const overallBudget = budgets.data?.find((entry) => !entry.budget.categoryId)
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
        title={`Welcome back, ${firstName}`}
        description={`Spending from ${formatDate(from, 'short')} to ${formatDate(to, 'short')}`}
        action={
          <div className="flex items-center gap-2">
            <div
              className="flex rounded-lg border border-slate-300 bg-white p-0.5"
              role="group"
              aria-label="Chart grouping"
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
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total spend"
            value={formatMoney(totalSpend)}
            hint={`${formatNumber(totalCount)} ${totalCount === 1 ? 'expense' : 'expenses'}`}
            icon={<Wallet className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label="Average expense"
            value={formatMoney(averageExpense)}
            icon={<TrendingUp className="h-5 w-5" aria-hidden />}
            tone="brand"
          />
          <StatCard
            label="Categories used"
            value={formatNumber(categoryData.length)}
            hint={`of ${formatNumber(categories?.length ?? 0)} available`}
            icon={<Tags className="h-5 w-5" aria-hidden />}
          />
          <StatCard
            label={budgetRemaining === null ? 'Budgets' : 'Budget left'}
            value={budgetRemaining === null ? 'Not set' : formatMoney(budgetRemaining)}
            hint={
              overallBudget
                ? `${formatPercent(overallBudget.usagePercentage)} of ${formatMoney(
                    overallBudget.budget.monthlyLimit,
                  )} used`
                : 'No overall budget yet'
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
              title="Spending trend"
              description={`Grouped by ${groupBy.replace('ly', '')}`}
              action={
                <Link
                  to="/expenses"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardBody className="pb-2">
              {summary.isError ? (
                <ErrorState
                  title="Could not load the trend"
                  message={summary.error instanceof Error ? summary.error.message : undefined}
                  onRetry={() => void summary.refetch()}
                  className="py-10"
                />
              ) : summary.isPending ? (
                <LoadingBlock label="Loading trend" />
              ) : trendData.length === 0 ? (
                <EmptyState
                  title="No spending in this window"
                  description="Add an expense to start building your trend."
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
                          content={<TrendTooltip />}
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
                        <Tooltip content={<TrendTooltip />} />
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
            <CardHeader title="By category" description="Share of total spend" />
            <CardBody>
              {stats.isPending ? (
                <LoadingBlock label="Loading breakdown" />
              ) : categoryData.length === 0 ? (
                <EmptyState
                  title="No categorised spend"
                  description="Category totals appear once you tag expenses."
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
                        <Tooltip content={<CategoryTooltip />} />
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
                            {formatMoney(entry.totalAmount)}
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

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Recent expenses"
              action={
                <Link
                  to="/expenses"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            {recent.isPending ? (
              <LoadingBlock label="Loading expenses" />
            ) : (recent.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Receipt className="h-6 w-6" aria-hidden />}
                title="Nothing logged yet"
                description="Your six most recent expenses will show up here."
                  action={
                    <Link to="/expenses">
                      <Button size="sm">
                        <Plus className="h-4 w-4" aria-hidden />
                        Add your first expense
                      </Button>
                    </Link>
                  }
                />
              ) : (
                <ExpenseList expenses={recent.data ?? []} />
              )}
          </Card>

          <Card>
            <CardHeader
              title="Budget status"
              description={
                budgets.data?.[0]
                  ? `${MONTH_NAMES[budgets.data[0].budget.month - 1]} ${budgets.data[0].budget.year}`
                  : undefined
              }
              action={
                <Link
                  to="/budgets"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  Manage
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              }
            />
            <CardBody className="space-y-4">
              {budgets.isPending ? (
                <LoadingBlock label="Loading budgets" />
              ) : (budgets.data?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={<Target className="h-6 w-6" aria-hidden />}
                  title="No budgets this month"
                  description="Set a limit to track how much is left."
                  action={
                    <Link to="/budgets">
                      <Button size="sm" variant="outline">
                        Set a budget
                      </Button>
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
                            {entry.budget.category?.name ?? 'Overall budget'}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">
                          <span
                            className={cn(
                              'font-semibold',
                              entry.exceeded ? 'text-red-600' : 'text-slate-800',
                            )}
                          >
                            {formatMoney(entry.spentAmount)}
                          </span>
                          {' / '}
                          {formatMoney(entry.budget.monthlyLimit)}
                        </span>
                      </div>
                      <ProgressBar
                        percentage={entry.usagePercentage}
                        label={`${entry.budget.category?.name ?? 'Overall budget'} usage`}
                        className="h-1.5"
                      />
                      <p className="mt-1 text-[11px] text-slate-500">
                        {entry.exceeded
                          ? `Over by ${formatMoney(Math.abs(entry.remainingAmount))}`
                          : `${formatMoney(entry.remainingAmount)} left`}
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
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { periodStart: string; totalAmount: number; expenseCount: number; averageAmount: number } }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  const rows: TooltipRow[] = [
    { label: 'Total', value: formatMoney(row.totalAmount) },
    { label: 'Expenses', value: formatNumber(row.expenseCount) },
    { label: 'Average', value: formatMoney(row.averageAmount) },
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
  active,
  payload,
}: {
  active?: boolean
  payload?: { payload: { categoryName?: string; totalAmount: number; expenseCount: number; percentage: number } }[]
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-slate-900">
        {row.categoryName ?? 'Uncategorised'}
      </p>
      <ul className="mt-1 space-y-0.5">
        <li className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Total</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatMoney(row.totalAmount)}
          </span>
        </li>
        <li className="flex items-center gap-3 text-xs">
          <span className="text-slate-500">Share</span>
          <span className="ml-auto font-medium tabular-nums text-slate-900">
            {formatPercent(row.percentage)}
          </span>
        </li>
      </ul>
    </div>
  )
}

