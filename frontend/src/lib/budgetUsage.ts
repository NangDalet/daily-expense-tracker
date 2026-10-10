import type { BudgetUsageResponse, ExpenseResponse } from '@/lib/api/types'

/** Calculate monthly usage from expense currencies, including legacy USD budgets. */
export function calculateBudgetUsage(usage: BudgetUsageResponse[], expenses: ExpenseResponse[]): BudgetUsageResponse[] {
  return usage.map((entry) => {
    const budget = { ...entry.budget, currency: entry.budget.currency ?? 'USD' }
    const period = `${budget.year}-${String(budget.month).padStart(2, '0')}`
    let cents = 0
    let expenseCount = 0
    for (const expense of expenses) {
      if (expense.currency !== budget.currency || !expense.expenseDate.startsWith(period + '-')) continue
      if (budget.categoryId && budget.categoryId !== (expense.category?.id ?? expense.categoryId)) continue
      cents += Math.round(expense.amount * 100)
      expenseCount++
    }
    const limit = Math.round(budget.monthlyLimit * 100)
    return {
      budget, expenseCount, spentAmount: cents / 100, remainingAmount: (limit - cents) / 100,
      usagePercentage: limit > 0 ? Math.round(cents * 10000 / limit) / 100 : 0,
      exceeded: cents > limit,
    }
  })
}
