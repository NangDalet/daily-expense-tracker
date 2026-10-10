import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { budgetApi, categoryApi, expenseApi, incomeApi, userApi } from '@/lib/api/endpoints'
import type {
  BudgetRequest,
  BudgetUsageResponse,
  CategoryRequest,
  CategoryResponse,
  CategoryStatResponse,
  CreateUserRequest,
  IncomeFilterParams,
  IncomeRequest,
  ExpenseFilterParams,
  ExpenseRequest,
  ExpenseSummaryResponse,
  ExpenseResponse,
  SummaryParams,
  UpdateUserRequest,
  UserResponse,
} from '@/lib/api/types'
import type { Page } from '@/lib/api/endpoints'
import { fetchDashboardExpenses } from '@/lib/dashboardSpending'
import { calculateBudgetUsage } from '@/lib/budgetUsage'
import { toIsoDate } from '@/lib/utils'

export const queryKeys = {
  expenses: (filter: ExpenseFilterParams) => ['expenses', 'list', filter] as const,
  expense: (id: string) => ['expenses', 'detail', id] as const,
  recentExpenses: (limit: number) => ['expenses', 'recent', limit] as const,
  summary: (params: SummaryParams) => ['expenses', 'summary', params] as const,
  categoryStats: (from?: string, to?: string) =>
    ['expenses', 'stats-by-category', { from, to }] as const,
  categories: () => ['categories'] as const,
  budgets: (year?: number, month?: number) => ['budgets', 'list', { year, month }] as const,
  budgetUsage: (year?: number, month?: number) =>
    ['budgets', 'usage', { year, month }] as const,
  users: (search: string, page: number, size: number) =>
    ['users', 'list', { search, page, size }] as const,
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories(),
    queryFn: () => categoryApi.list(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useCreateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CategoryRequest) => categoryApi.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export function useUpdateCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CategoryRequest }) =>
      categoryApi.update(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['categories'] })
      void client.invalidateQueries({ queryKey: ['expenses'] })
      void client.invalidateQueries({ queryKey: ['incomes'] })
      void client.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

export function useDeleteCategory() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => categoryApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['categories'] })
      void client.invalidateQueries({ queryKey: ['expenses'] })
      void client.invalidateQueries({ queryKey: ['incomes'] })
      void client.invalidateQueries({ queryKey: ['budgets'] })
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

export function useExpenses(filter: ExpenseFilterParams) {
  return useQuery({
    queryKey: queryKeys.expenses(filter),
    queryFn: () => expenseApi.list(filter),
    placeholderData: (previous) => previous,
  })
}

export function useRecentExpenses(limit = 5) {
  return useQuery({
    queryKey: queryKeys.recentExpenses(limit),
    queryFn: () => expenseApi.recent(limit),
  })
}

export function useExpenseSummary(params: SummaryParams) {
  return useQuery({
    queryKey: queryKeys.summary(params),
    queryFn: () => expenseApi.summary(params),
  })
}

export function useDashboardExpenses(from: string, to: string) {
  return useQuery({
    queryKey: ['expenses', 'dashboard', { from, to }],
    queryFn: ({ signal }) => fetchDashboardExpenses(from, to, signal),
  })
}

export function useCategoryStats(from?: string, to?: string) {
  return useQuery({
    queryKey: queryKeys.categoryStats(from, to),
    queryFn: () => expenseApi.statsByCategory(from, to),
  })
}

export function useCreateExpense() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: ExpenseRequest) => expenseApi.create(body),
    onSuccess: () => invalidateExpenseDerived(client),
  })
}

export function useUpdateExpense() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseRequest }) =>
      expenseApi.update(id, body),
    onSuccess: () => invalidateExpenseDerived(client),
  })
}

export function useDeleteExpense() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => expenseApi.remove(id),
    onSuccess: () => invalidateExpenseDerived(client),
  })
}

/**
 * Any expense write changes the aggregates too (summaries, category stats,
 * Category projections are refreshed alongside the income queries.
 */
function invalidateExpenseDerived(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ['monthly-finances'] })
  void client.invalidateQueries({ queryKey: ['expenses'] })
  void client.invalidateQueries({ queryKey: ['budgets'] })
  void client.invalidateQueries({ queryKey: ['categories'] })
}

/* -------------------------------------------------------------------------- */
/* Budgets                                                                    */
/* -------------------------------------------------------------------------- */

export function useBudgetUsage(year?: number, month?: number) {
  const now = new Date()
  const budgetYear = year ?? now.getFullYear()
  const budgetMonth = month ?? now.getMonth() + 1
  return useQuery({
    queryKey: queryKeys.budgetUsage(budgetYear, budgetMonth),
    queryFn: async ({ signal }) => {
      const usage = await budgetApi.usage(budgetYear, budgetMonth)
      if (!usage.length) return []
      const from = toIsoDate(new Date(budgetYear, budgetMonth - 1, 1))
      const to = toIsoDate(new Date(budgetYear, budgetMonth, 0))
      const expenses = await fetchDashboardExpenses(from, to, signal)
      return calculateBudgetUsage(usage, expenses)
    },
  })
}

export function useSaveBudget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: BudgetRequest) => budgetApi.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useUpdateBudget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: BudgetRequest }) => budgetApi.update(id, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

export function useDeleteBudget() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => budgetApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['budgets'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Users (admin)                                                              */
/* -------------------------------------------------------------------------- */

export function useUsers(search: string, page: number, size: number) {
  return useQuery({
    queryKey: queryKeys.users(search, page, size),
    queryFn: (): Promise<Page<UserResponse>> => userApi.list(search, page, size),
    placeholderData: (previous) => previous,
    enabled: search !== undefined,
  })
}

export function useCreateUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateUserRequest) => userApi.create(body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const client = useQueryClient()
  const { user, refreshUser } = useAuth()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateUserRequest }) =>
      userApi.update(id, body),
    onSuccess: async (_data, variables) => {
      void client.invalidateQueries({ queryKey: ['users'] })
      // Editing your own account changes your own authorities, and the access
      // token in hand still carries the old ones. Re-issue the pair so the
      // navigation and guards react immediately instead of on the next reload.
      if (variables.id === user?.id) {
        await refreshUser().catch(() => {
          // A failed refresh is surfaced by the next request that needs a token.
        })
      }
    },
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      userApi.resetPassword(id, password),
  })
}

export function useDeleteUser() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => userApi.remove(id),
    onSuccess: () => client.invalidateQueries({ queryKey: ['users'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export type CategoryWithTotal = CategoryResponse

/** Recomputed helper kept next to the hooks so pages stay declarative. */
export function totalOf<T>(items: T[] | undefined, pick: (item: T) => number): number {
  if (!items) return 0
  return items.reduce((sum, item) => sum + pick(item), 0)
}

export type { BudgetUsageResponse, CategoryStatResponse, ExpenseSummaryResponse, ExpenseResponse }

export function useIncomes(filter: IncomeFilterParams) {
  return useQuery({
    queryKey: ['incomes', 'list', filter],
    queryFn: () => incomeApi.list(filter),
    placeholderData: (previous) => previous,
  })
}

export function useRecentIncome(limit = 5) {
  return useQuery({
    queryKey: ['incomes', 'recent', limit],
    queryFn: () => incomeApi.recent(limit),
  })
}

export function useIncomeSummary(params: SummaryParams) {
  return useQuery({
    queryKey: ['incomes', 'summary', params],
    queryFn: () => incomeApi.summary(params),
  })
}

export function useIncomeCategoryStats(from?: string, to?: string) {
  return useQuery({
    queryKey: ['incomes', 'stats-by-category', { from, to }],
    queryFn: () => incomeApi.statsByCategory(from, to),
  })
}

export function useCreateIncome() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: IncomeRequest) => incomeApi.create(body),
    onSuccess: () => invalidateIncomeDerived(client),
  })
}

export function useUpdateIncome() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: IncomeRequest }) =>
      incomeApi.update(id, body),
    onSuccess: () => invalidateIncomeDerived(client),
  })
}

export function useDeleteIncome() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => incomeApi.remove(id),
    onSuccess: () => invalidateIncomeDerived(client),
  })
}

/**
 * Income writes invalidate listings, summaries and category statistics.
 * Category projections are refreshed alongside the income queries.
 */
function invalidateIncomeDerived(client: ReturnType<typeof useQueryClient>) {
  void client.invalidateQueries({ queryKey: ['monthly-finances'] })
  void client.invalidateQueries({ queryKey: ['incomes'] })

  void client.invalidateQueries({ queryKey: ['categories'] })
}
