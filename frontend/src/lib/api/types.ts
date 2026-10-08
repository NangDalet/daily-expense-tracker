/**
 * Wire types mirroring the backend DTOs in
 * `com.example.expensetracker.dto`.
 *
 * The backend is configured with `default-property-inclusion: non_null`, so
 * nullable fields are simply absent from the JSON. Every optional field here is
 * therefore declared with `?` rather than `| null`.
 */

/** Envelope returned by every successful backend response. */
export interface ApiResponse<T> {
  data: T
  page?: number
  size?: number
  totalElements?: number
  totalPages?: number
  message?: string
  timestamp?: string
}

/** Envelope returned by every backend failure. */
export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  details?: ApiErrorDetail[]
  timestamp?: string
  path?: string
}

export interface ApiErrorDetail {
  field: string
  message: string
  rejectedValue?: unknown
}

/**
 * Stable machine readable codes from `exception.ErrorCode`. The backend
 * contract says these string constants must not change without a coordinated
 * release, so switching on them is safe.
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'MALFORMED_JSON'
  | 'MISSING_PARAMETER'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'CONFLICT'
  | 'DUPLICATE_RESOURCE'
  | 'BUSINESS_RULE_VIOLATION'
  | 'INTERNAL_ERROR'
  | 'DATABASE_ERROR'
  | 'SERVICE_UNAVAILABLE'

/**
 * Privilege ladder, mirroring `com.example.expensetracker.domain.Role`. The
 * order is significant: the backend compares `Role.rank()`, which is the enum
 * ordinal, so the UI can reproduce the same comparisons to decide what to show.
 */
export const ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_RANK: Record<Role, number> = {
  USER: 0,
  ADMIN: 1,
  SUPER_ADMIN: 2,
}

/** Most privileged role held by the list, defaulting to `USER`. */
export function highestRole(roles: readonly Role[] | undefined): Role {
  let highest: Role = 'USER'
  for (const role of roles ?? []) {
    if (ROLE_RANK[role] > ROLE_RANK[highest]) highest = role
  }
  return highest
}

/** True for `ADMIN` and `SUPER_ADMIN` alike. */
export function hasAdminRole(roles: readonly Role[] | undefined): boolean {
  return ROLE_RANK[highestRole(roles)] >= ROLE_RANK.ADMIN
}

export function hasSuperAdminRole(roles: readonly Role[] | undefined): boolean {
  return highestRole(roles) === 'SUPER_ADMIN'
}

export const PAYMENT_METHODS = [
  'CASH',
  'CREDIT_CARD',
  'DEBIT_CARD',
  'BANK_TRANSFER',
  'E_WALLET',
  'OTHER',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface UserResponse {
  id: string
  username: string
  email: string
  fullName?: string
  roles: Role[]
  enabled: boolean
  createdAt?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  /** Access token lifetime in seconds. */
  expiresIn: number
  user: UserResponse
}

export interface CategoryResponse {
  id: string
  name: string
  description?: string
  /** lucide-react icon name, e.g. `ShoppingCart`. */
  iconName?: string
  /** Badge colour as a hex string, e.g. `#22c55e`. */
  colorHex?: string
  userId?: string
  expenseCount?: number
  createdAt?: string
  updatedAt?: string
}

export interface ExpenseResponse {
  id: string
  amount: number
  currency: string
  description?: string
  /** ISO date, e.g. `2026-01-30`. */
  expenseDate: string
  paymentMethod: PaymentMethod
  categoryId?: string
  /** Denormalised category, absent when the expense has no category. */
  category?: CategoryResponse
  userId?: string
  receiptUrl?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export interface BudgetResponse {
  id: string
  /** Absent for the overall budget of the month. */
  categoryId?: string
  category?: CategoryResponse
  monthlyLimit: number
  month: number
  year: number
  createdAt?: string
  updatedAt?: string
}

export interface BudgetUsageResponse {
  budget: BudgetResponse
  spentAmount: number
  expenseCount: number
  /** `monthlyLimit - spentAmount`, negative when exceeded. */
  remainingAmount: number
  /** `spentAmount / monthlyLimit * 100`, rounded to 2 decimals. */
  usagePercentage: number
  exceeded: boolean
}

export interface CategoryStatResponse {
  categoryId?: string
  categoryName?: string
  categoryColor?: string
  categoryIcon?: string
  totalAmount: number
  expenseCount: number
  averageAmount: number
  percentage: number
}

export interface ExpenseSummaryResponse {
  /** First day of the bucket. */
  periodStart: string
  totalAmount: number
  expenseCount: number
  averageAmount: number
}

export type SummaryGroupBy = 'daily' | 'weekly' | 'monthly'

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  email: string
  password: string
  fullName?: string
}

export interface ExpenseRequest {
  amount: number
  currency: string
  description?: string
  expenseDate: string
  paymentMethod: PaymentMethod
  categoryId?: string | null
  receiptUrl?: string
  tags?: string[]
}

export interface CategoryRequest {
  name: string
  description?: string
  iconName: string
  colorHex: string
}

export interface BudgetRequest {
  categoryId?: string | null
  monthlyLimit: number
  month: number
  year: number
}

export interface UpdateUserRequest {
  email?: string
  fullName?: string
  roles?: Role[]
  enabled?: boolean
}

/** Super administrators only - `POST /users`. */
export interface CreateUserRequest {
  username: string
  email: string
  password: string
  fullName?: string
  roles?: Role[]
  enabled?: boolean
}

/** Super administrators only - `PUT /users/{id}/password`. */
export interface ResetPasswordRequest {
  password: string
}

/** Query parameters of `GET /expenses`. */
export interface ExpenseFilterParams {
  categoryId?: string
  fromDate?: string
  toDate?: string
  minAmount?: number
  maxAmount?: number
  search?: string
  paymentMethods?: PaymentMethod[]
  page?: number
  size?: number
  /** e.g. `expenseDate,desc`. */
  sort?: string
}

export interface SummaryParams {
  groupBy: SummaryGroupBy
  from?: string
  to?: string
  categoryId?: string
  paymentMethod?: PaymentMethod
}
