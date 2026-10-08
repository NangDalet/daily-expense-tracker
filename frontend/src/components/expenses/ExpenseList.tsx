import { ArrowUpDown, ExternalLink, Pencil, Receipt, Trash2 } from 'lucide-react'
import type { ExpenseResponse } from '@/lib/api/types'
import { Badge } from '@/components/ui/Badge'
import { CategorySwatch } from '@/components/ui/CategoryIcon'
import { PAYMENT_METHOD_ICONS, formatDate, formatMoney, paymentMethodLabel, resolveColor } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface ExpenseListProps {
  expenses: ExpenseResponse[]
  onEdit?: (expense: ExpenseResponse) => void
  onDelete?: (expense: ExpenseResponse) => void
  /** Hides the payment-method column on narrow layouts. */
  compact?: boolean
  className?: string
}

export function ExpenseList({ expenses, onEdit, onDelete, compact = false, className }: ExpenseListProps) {
  if (expenses.length === 0) return null

  return (
    <ul className={cn('divide-y divide-slate-100', className)}>
      {expenses.map((expense) => {
        const color = resolveColor(expense.category?.colorHex, expense.categoryId ?? expense.id)
        const MethodIcon = PAYMENT_METHOD_ICONS[expense.paymentMethod] ?? Receipt

        return (
          <li key={expense.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
            <CategorySwatch iconName={expense.category?.iconName} color={color} size="sm" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {expense.description || 'No description'}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{formatDate(expense.expenseDate, 'short')}</span>
                {expense.category && (
                  <>
                    <span aria-hidden>&middot;</span>
                    <span>{expense.category.name}</span>
                  </>
                )}
                {expense.tags?.map((tag) => (
                  <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {!compact && (
              <Badge
                className="hidden shrink-0 sm:inline-flex"
                title={paymentMethodLabel(expense.paymentMethod)}
              >
                <MethodIcon className="h-3 w-3" aria-hidden />
                {paymentMethodLabel(expense.paymentMethod)}
              </Badge>
            )}

            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {formatMoney(expense.amount, expense.currency)}
              </p>
              {expense.receiptUrl && (
                <a
                  href={expense.receiptUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  title="Open receipt"
                  onClick={(event) => event.stopPropagation()}
                  className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] text-slate-400 hover:text-brand-600"
                >
                  Receipt
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>

            {(onEdit || onDelete) && (
              <div className="flex shrink-0 items-center gap-0.5">
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(expense)}
                    aria-label={`Edit ${expense.description || 'expense'}`}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(expense)}
                    aria-label={`Delete ${expense.description || 'expense'}`}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export type ExpenseSortField =
  | 'expenseDate'
  | 'amount'
  | 'description'
  | 'paymentMethod'
  | 'currency'
  | 'createdAt'

interface SortableHeaderProps {
  field: ExpenseSortField
  label: string
  sort: string
  onSortChange: (next: string) => void
  className?: string
}

/**
 * Header cell that toggles `field,asc` / `field,desc`. These field names match
 * the whitelist documented on the backend list endpoint.
 */
export function SortableHeader({ field, label, sort, onSortChange, className }: SortableHeaderProps) {
  const [currentField, currentDir] = sort.split(',')
  const isActive = currentField === field
  const nextDir = isActive && currentDir === 'asc' ? 'desc' : 'asc'

  return (
    <th scope="col" className={cn('px-4 py-3 text-left font-medium', className)}>
      <button
        type="button"
        onClick={() => onSortChange(`${field},${nextDir}`)}
        aria-sort={isActive ? (currentDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-slate-900',
          isActive ? 'text-slate-900' : 'text-slate-500',
        )}
      >
        {label}
        <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
      </button>
    </th>
  )
}
