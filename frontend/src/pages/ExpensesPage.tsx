import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Receipt } from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { ExpenseList, SortableHeader } from '@/components/expenses/ExpenseList'
import {
  EMPTY_FILTERS,
  ExpenseFilters,
  toFilterParams,
  type ExpenseFilterState,
} from '@/components/expenses/ExpenseFilters'
import { useDeleteExpense, useExpenses } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { ExpenseResponse } from '@/lib/api/types'
import { formatMoney, formatNumber } from '@/lib/utils'

const DEFAULT_SORT = 'expenseDate,desc'
const DEFAULT_SIZE = 20

export default function ExpensesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<ExpenseFilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<ExpenseResponse | null>(null)

  const deleteExpense = useDeleteExpense()

  const filterParams = useMemo(
    () => toFilterParams(filters, page, size, sort),
    [filters, page, size, sort],
  )

  const { data, isPending, isError, error, refetch } = useExpenses(filterParams)

  // Deep-linking: the layout's "Add expense" button navigates to ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingExpense(null)
      setIsFormOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Any filter change invalidates the current page offset.
  function applyFilters(next: ExpenseFilterState) {
    setFilters(next)
    setPage(0)
  }

  function handleSortChange(next: string) {
    setSort(next)
    setPage(0)
  }

  function openCreate() {
    setEditingExpense(null)
    setIsFormOpen(true)
  }

  function openEdit(expense: ExpenseResponse) {
    setEditingExpense(expense)
    setIsFormOpen(true)
  }

  async function handleDelete() {
    if (!deletingExpense) return
    try {
      await deleteExpense.mutateAsync(deletingExpense.id)
      setDeletingExpense(null)
    } catch {
      // The error is surfaced inside the dialog.
    }
  }

  const pageTotal = data?.totalElements ?? 0
  // The API returns at most 100 per page, so a page beyond the last one would
  // come back empty; fall back to the first page instead of showing a void.
  const showOutOfRange = !isPending && data !== undefined && data.items.length === 0 && page > 0

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Expenses"
        description={
          isPending && !data
            ? 'Loading your expenses...'
            : `${formatNumber(pageTotal)} ${pageTotal === 1 ? 'expense' : 'expenses'} recorded`
        }
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add expense
          </Button>
        }
      />

      <div className="space-y-4">
        <ExpenseFilters
          value={filters}
          onChange={applyFilters}
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />

        <Card className="overflow-hidden">
          {isError ? (
            <ErrorState
              title="Could not load expenses"
              message={error instanceof ApiError ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          ) : isPending && !data ? (
            <LoadingBlock label="Loading expenses" />
          ) : showOutOfRange ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No expenses on this page"
              description="The result set shrank while you were viewing it."
              action={
                <Button variant="outline" size="sm" onClick={() => setPage(0)}>
                  Back to first page
                </Button>
              }
            />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No expenses found"
              description="Record your first expense or loosen the filters."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add expense
                </Button>
              }
            />
          ) : (
            <>
              {/* Table on wide screens, stacked list on narrow ones. */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <SortableHeader
                        field="expenseDate"
                        label="Date"
                        sort={sort}
                        onSortChange={handleSortChange}
                      />
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        Description
                      </th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        Category
                      </th>
                      <SortableHeader
                        field="paymentMethod"
                        label="Payment"
                        sort={sort}
                        onSortChange={handleSortChange}
                      />
                      <SortableHeader
                        field="amount"
                        label="Amount"
                        sort={sort}
                        onSortChange={handleSortChange}
                        className="text-right"
                      />
                      <th scope="col" className="w-20 px-4 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data?.items.map((expense) => (
                      <tr
                        key={expense.id}
                        className="transition-colors hover:bg-slate-50"
                        aria-busy={isPending}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {expense.expenseDate}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-sm font-medium text-slate-900">
                          <span className="line-clamp-1">{expense.description || 'No description'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {expense.category?.name ?? <span className="text-slate-400">None</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {expense.paymentMethod.replace(/_/g, ' ')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatMoney(expense.amount, expense.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(expense)}
                              aria-label={`Edit ${expense.description || 'expense'}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => setDeletingExpense(expense)}
                              aria-label={`Delete ${expense.description || 'expense'}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ExpenseList
                expenses={data?.items ?? []}
                onEdit={openEdit}
                onDelete={setDeletingExpense}
                className="md:hidden"
              />

              <Pagination
                page={data?.page ?? page}
                totalPages={data?.totalPages ?? 0}
                totalElements={pageTotal}
                pageSize={size}
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setSize(next)
                  setPage(0)
                }}
              />
            </>
          )}
        </Card>
      </div>

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingExpense ? 'Edit expense' : 'Add expense'}
        description={editingExpense ? undefined : 'Record a new outgoing payment.'}
        size="md"
      >
        <ExpenseForm
          key={editingExpense?.id ?? 'new'}
          expense={editingExpense}
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deletingExpense !== null}
        title="Delete expense"
        description={`This permanently removes "${
          deletingExpense?.description || 'this expense'
        }" (${formatMoney(deletingExpense?.amount ?? 0, deletingExpense?.currency)}). This cannot be undone.`}
        isPending={deleteExpense.isPending}
        error={deleteExpense.error instanceof ApiError ? deleteExpense.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingExpense(null)}
      />
    </div>
  )
}
