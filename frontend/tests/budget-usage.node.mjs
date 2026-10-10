import assert from 'node:assert/strict'
import { test } from 'node:test'
import { calculateBudgetUsage } from '../src/lib/budgetUsage.ts'

const budget = (currency, categoryId) => ({
  budget: { id: currency ?? 'legacy', currency, categoryId, monthlyLimit: 250, year: 2026, month: 10 },
  spentAmount: 4588.48, remainingAmount: -4338.48, expenseCount: 99, usagePercentage: 1835.39, exceeded: true,
})
const expenses = [
  { amount: 1.6, currency: 'USD', expenseDate: '2026-10-09', category: { id: 'food' } },
  { amount: 86.88, currency: 'USD', expenseDate: '2026-10-08', categoryId: 'other' },
  { amount: 4500, currency: 'KHR', expenseDate: '2026-10-09', category: { id: 'food' } },
  { amount: 1000, currency: 'USD', expenseDate: '2026-09-30', category: { id: 'food' } },
]

test('replaces mixed server totals with same-currency spending in the budget month', () => {
  const [usd, khr] = calculateBudgetUsage([budget(), budget('KHR')], expenses)
  assert.equal(usd.budget.currency, 'USD')
  assert.equal(usd.spentAmount, 88.48)
  assert.equal(usd.remainingAmount, 161.52)
  assert.equal(usd.usagePercentage, 35.39)
  assert.equal(usd.expenseCount, 2)
  assert.equal(usd.exceeded, false)
  assert.equal(khr.spentAmount, 4500)
  assert.equal(khr.expenseCount, 1)
  assert.equal(khr.exceeded, true)
})

test('category budgets only count their category in their currency', () => {
  const [food, other] = calculateBudgetUsage([budget('USD', 'food'), budget('USD', 'other')], expenses)
  assert.equal(food.spentAmount, 1.6)
  assert.equal(food.remainingAmount, 248.4)
  assert.equal(food.expenseCount, 1)
  assert.equal(other.spentAmount, 86.88)
  assert.equal(other.expenseCount, 1)
})

test('uses exact cents and clears stale usage when no expenses match', () => {
  const entry = budget('USD')
  entry.budget.monthlyLimit = 1
  const [usage] = calculateBudgetUsage([entry], [0.1, 0.2, 0.5].map(amount => ({
    amount, currency: 'USD', expenseDate: '2026-10-01',
  })))
  assert.equal(usage.spentAmount, 0.8)
  assert.equal(usage.remainingAmount, 0.2)
  assert.equal(usage.usagePercentage, 80)
  const [empty] = calculateBudgetUsage([entry], [])
  assert.equal(empty.spentAmount, 0)
  assert.equal(empty.remainingAmount, 1)
  assert.equal(empty.expenseCount, 0)
  assert.equal(empty.exceeded, false)
})
