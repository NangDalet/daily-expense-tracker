import { expenseApi } from '@/lib/api/endpoints'
import type { CategoryStatResponse, ExpenseResponse, ExpenseSummaryResponse, SummaryGroupBy } from '@/lib/api/types'
import { parseIsoDate, toIsoDate } from '@/lib/utils'

/** The deployed summary API combines currencies, so use currency-bearing rows. */
export async function fetchDashboardExpenses(from: string, to: string, signal?: AbortSignal): Promise<ExpenseResponse[]> {
  const expenses: ExpenseResponse[] = []
  const ids = new Set<string>()
  let total: number | undefined
  let pages = 1
  for (let page = 0; page < pages; page++) {
    const result = await expenseApi.list({ fromDate: from, toDate: to, page, size: 100 }, signal)
    total ??= result.totalElements
    if (result.totalElements !== total) throw new Error('Expenses changed while loading the dashboard. Please refresh.')
    pages = result.totalPages
    for (const expense of result.items) {
      if (ids.has(expense.id)) throw new Error('Expenses changed while loading the dashboard. Please refresh.')
      ids.add(expense.id)
      expenses.push(expense)
    }
  }
  if (expenses.length !== total) throw new Error('Could not load all expenses for the dashboard. Please refresh.')
  return expenses
}

function periodStart(date: string, groupBy: SummaryGroupBy): string {
  if (groupBy === 'daily') return date
  const parsed = parseIsoDate(date)!
  if (groupBy === 'monthly') parsed.setDate(1)
  else parsed.setDate(parsed.getDate() - (parsed.getDay() + 6) % 7)
  return toIsoDate(parsed)
}

export function summarizeDashboardExpenses(expenses: ExpenseResponse[], currency: string, groupBy: SummaryGroupBy) {
  const periods = new Map<string, ExpenseSummaryResponse>()
  const categories = new Map<string, CategoryStatResponse>()
  let cents = 0
  let count = 0
  for (const expense of expenses) {
    if (expense.currency !== currency) continue
    const amount = Math.round(expense.amount * 100)
    cents += amount
    count++
    const start = periodStart(expense.expenseDate, groupBy)
    const period = periods.get(start) ?? { periodStart: start, totalAmount: 0, expenseCount: 0, averageAmount: 0 }
    period.totalAmount += amount
    period.expenseCount++
    periods.set(start, period)
    const key = expense.category?.id ?? 'uncategorised'
    const category = categories.get(key) ?? {
      categoryId: expense.category?.id,
      categoryName: expense.category?.name ?? 'Uncategorised',
      categoryColor: expense.category?.colorHex,
      categoryIcon: expense.category?.iconName,
      totalAmount: 0, expenseCount: 0, averageAmount: 0, percentage: 0,
    }
    category.totalAmount += amount
    category.expenseCount++
    categories.set(key, category)
  }
  return {
    total: cents / 100,
    count,
    average: count ? cents / 100 / count : 0,
    summary: [...periods.values()].sort((a, b) => a.periodStart.localeCompare(b.periodStart)).map((period) => ({
      ...period, totalAmount: period.totalAmount / 100, averageAmount: period.totalAmount / 100 / period.expenseCount,
    })),
    categories: [...categories.values()].sort((a, b) => b.totalAmount - a.totalAmount).map((category) => ({
      ...category,
      percentage: cents ? category.totalAmount * 100 / cents : 0,
      averageAmount: category.totalAmount / 100 / category.expenseCount,
      totalAmount: category.totalAmount / 100,
    })),
  }
}
