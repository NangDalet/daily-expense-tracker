import { http, type QueryParams } from './client'
import type {
  BudgetRequest,
  BudgetResponse,
  BudgetUsageResponse,
  CategoryRequest,
  CategoryResponse,
  CategoryStatResponse,
  CreateUserRequest,
  ExpenseFilterParams,
  ExpenseRequest,
  ExpenseResponse,
  ExpenseSummaryResponse,
  LoginRequest,
  RegisterRequest,
  SummaryParams,
  TokenResponse,
  UpdateUserRequest,
  UserResponse,
} from './types'

/** Paged payload, mirroring the page fields of the response envelope. */
export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export const authApi = {
  login: (body: LoginRequest) => http.post<TokenResponse>('/auth/login', body, true),
  register: (body: RegisterRequest) => http.post<TokenResponse>('/auth/register', body, true),
  // `skipRefresh`: a 401 here must not trigger another refresh attempt.
  refresh: (refreshToken: string) =>
    http.post<TokenResponse>('/auth/refresh', { refreshToken }, true),
}

function toExpenseQuery(filter: ExpenseFilterParams = {}): QueryParams {
  return {
    categoryId: filter.categoryId,
    fromDate: filter.fromDate,
    toDate: filter.toDate,
    minAmount: filter.minAmount,
    maxAmount: filter.maxAmount,
    search: filter.search,
    paymentMethods: filter.paymentMethods,
    page: filter.page,
    size: filter.size,
    sort: filter.sort,
  }
}

export const expenseApi = {
  async list(filter: ExpenseFilterParams = {}): Promise<Page<ExpenseResponse>> {
    const envelope = await http.getEnvelope<ExpenseResponse[]>(
      '/expenses',
      toExpenseQuery(filter),
    )
    return {
      items: envelope.data ?? [],
      page: envelope.page ?? 0,
      size: envelope.size ?? 20,
      totalElements: envelope.totalElements ?? 0,
      totalPages: envelope.totalPages ?? 0,
    }
  },
  get: (id: string) => http.get<ExpenseResponse>(`/expenses/${id}`),
  create: (body: ExpenseRequest) => http.post<ExpenseResponse>('/expenses', body),
  update: (id: string, body: ExpenseRequest) => http.put<ExpenseResponse>(`/expenses/${id}`, body),
  remove: (id: string) => http.delete<void>(`/expenses/${id}`),
  summary: (params: SummaryParams) =>
    http.get<ExpenseSummaryResponse[]>('/expenses/summary', {
      groupBy: params.groupBy,
      from: params.from,
      to: params.to,
      categoryId: params.categoryId,
      paymentMethod: params.paymentMethod,
    }),
  statsByCategory: (from?: string, to?: string) =>
    http.get<CategoryStatResponse[]>('/expenses/stats/by-category', { from, to }),
  recent: (limit = 5) => http.get<ExpenseResponse[]>('/expenses/recent', { limit }),
}

export const categoryApi = {
  list: () => http.get<CategoryResponse[]>('/categories'),
  get: (id: string) => http.get<CategoryResponse>(`/categories/${id}`),
  create: (body: CategoryRequest) => http.post<CategoryResponse>('/categories', body),
  update: (id: string, body: CategoryRequest) => http.put<CategoryResponse>(`/categories/${id}`, body),
  remove: (id: string) => http.delete<void>(`/categories/${id}`),
}

export const budgetApi = {
  list: (year?: number, month?: number) => http.get<BudgetResponse[]>('/budgets', { year, month }),
  usage: (year?: number, month?: number) =>
    http.get<BudgetUsageResponse[]>('/budgets/usage', { year, month }),
  create: (body: BudgetRequest) => http.post<BudgetResponse>('/budgets', body),
  update: (id: string, body: BudgetRequest) => http.put<BudgetResponse>(`/budgets/${id}`, body),
  remove: (id: string) => http.delete<void>(`/budgets/${id}`),
}

export const userApi = {
  async list(search?: string, page = 0, size = 20): Promise<Page<UserResponse>> {
    const envelope = await http.getEnvelope<UserResponse[]>('/users', { search, page, size })
    return {
      items: envelope.data ?? [],
      page: envelope.page ?? 0,
      size: envelope.size ?? 20,
      totalElements: envelope.totalElements ?? 0,
      totalPages: envelope.totalPages ?? 0,
    }
  },
  get: (id: string) => http.get<UserResponse>(`/users/${id}`),
  /** Super administrators only; 403 for a plain ADMIN. */
  create: (body: CreateUserRequest) => http.post<UserResponse>('/users', body),
  update: (id: string, body: UpdateUserRequest) => http.put<UserResponse>(`/users/${id}`, body),
  /** Super administrators only; 403 for a plain ADMIN. */
  resetPassword: (id: string, password: string) =>
    http.put<void>(`/users/${id}/password`, { password }),
  remove: (id: string) => http.delete<void>(`/users/${id}`),
}
