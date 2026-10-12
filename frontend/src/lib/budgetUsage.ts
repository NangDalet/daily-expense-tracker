import type { BudgetUsageResponse, ExpenseResponse } from '@/lib/api/types'
import { fromKhrMinor, toKhrMinor } from '@/lib/currency'

/** Both currencies count toward each budget, converted at the fixed rate. */
export function calculateBudgetUsage(usage: BudgetUsageResponse[], expenses: ExpenseResponse[]): BudgetUsageResponse[] {
  return usage.map((entry) => {
    const budget = { ...entry.budget, currency: entry.budget.currency ?? 'USD' }
    const period = `${budget.year}-${String(budget.month).padStart(2, '0')}`
    let cents = 0
    let expenseCount = 0
    for (const expense of expenses) {
      if (!expense.expenseDate.startsWith(period + '-')) continue
      if (budget.categoryId && budget.categoryId !== (expense.category?.id ?? expense.categoryId)) continue
      cents += toKhrMinor(expense.amount, expense.currency)
      expenseCount++
    }
    const limit = Math.round(budget.monthlyLimit * 100)
    const spent = Math.round(fromKhrMinor(cents, budget.currency) * 100)
    return {
      budget, expenseCount, spentAmount: spent / 100, remainingAmount: (limit - spent) / 100,
      usagePercentage: limit > 0 ? Math.round(spent * 10000 / limit) / 100 : 0,
      exceeded: spent > limit,
    }
  })
}
