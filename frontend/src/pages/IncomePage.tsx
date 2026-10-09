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
import { IncomeForm } from '@/components/incomes/IncomeForm'
import { IncomeList, SortableHeader } from '@/components/incomes/IncomeList'
import {
  EMPTY_FILTERS,
  IncomeFilters,
  toFilterParams,
  type IncomeFilterState,
} from '@/components/incomes/IncomeFilters'
import { useDeleteIncome, useIncomes, useIncomeSummary } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { IncomeResponse } from '@/lib/api/types'
import { formatMoney, formatNumber, todayIso } from '@/lib/utils'

const DEFAULT_SORT = 'incomeDate,desc'
const DEFAULT_SIZE = 20

export default function IncomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<IncomeFilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState<IncomeResponse | null>(null)
  const [deletingIncome, setDeletingIncome] = useState<IncomeResponse | null>(null)

  const deleteIncome = useDeleteIncome()
  const today = todayIso()
  const monthlySummary = useIncomeSummary({ groupBy: 'monthly', from: today.slice(0, 7) + '-01', to: today })

  const filterParams = useMemo(
    () => toFilterParams(filters, page, size, sort),
    [filters, page, size, sort],
  )

  const { data, isPending, isError, error, refetch } = useIncomes(filterParams)

  // Deep-linking: the layout's "Add income" button navigates to ?new=1.
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingIncome(null)
      setIsFormOpen(true)
      searchParams.delete('new')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Any filter change invalidates the current page offset.
  function applyFilters(next: IncomeFilterState) {
    setFilters(next)
    setPage(0)
  }

  function handleSortChange(next: string) {
    setSort(next)
    setPage(0)
  }

  function openCreate() {
    setEditingIncome(null)
    setIsFormOpen(true)
  }

  function openEdit(income: IncomeResponse) {
    setEditingIncome(income)
    setIsFormOpen(true)
  }

  async function handleDelete() {
    if (!deletingIncome) return
    try {
      await deleteIncome.mutateAsync(deletingIncome.id)
      setDeletingIncome(null)
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
        title="Income"
        description={
          isPending && !data
            ? 'Loading your income...'
            : `${formatNumber(pageTotal)} ${pageTotal === 1 ? 'income record' : 'income records'} recorded`
        }
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden />
            Add income
          </Button>
        }
      />

      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-slate-900">Income this month</h2>
          {monthlySummary.isError ? (
            <ErrorState title="Could not load income totals" onRetry={() => void monthlySummary.refetch()} />
          ) : monthlySummary.isPending ? (
            <LoadingBlock label="Loading income totals" />
          ) : monthlySummary.data.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">No income recorded this month.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-6">
              {monthlySummary.data.map((row) => (
                <div key={row.currency}>
                  <p className="text-xl font-semibold tabular-nums text-emerald-700">{formatMoney(row.totalAmount, row.currency)}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatNumber(row.incomeCount)} records &middot; {row.currency}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
        <IncomeFilters
          value={filters}
          onChange={applyFilters}
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />

        <Card className="overflow-hidden">
          {isError ? (
            <ErrorState
              title="Could not load income"
              message={error instanceof ApiError ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          ) : isPending && !data ? (
            <LoadingBlock label="Loading income" />
          ) : showOutOfRange ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title="No income on this page"
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
              title="No income found"
              description="Record your first income or loosen the filters."
              action={
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Add income
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
                        field="incomeDate"
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
                    {data?.items.map((income) => (
                      <tr
                        key={income.id}
                        className="transition-colors hover:bg-slate-50"
                        aria-busy={isPending}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {income.incomeDate}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-sm font-medium text-slate-900">
                          <span className="line-clamp-1">{income.description || 'No description'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {income.category?.name ?? <span className="text-slate-400">None</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {income.paymentMethod.replace(/_/g, ' ')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">
                          {formatMoney(income.amount, income.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(income)}
                              aria-label={`Edit ${income.description || 'income'}`}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => setDeletingIncome(income)}
                              aria-label={`Delete ${income.description || 'income'}`}
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

              <IncomeList
                incomes={data?.items ?? []}
                onEdit={openEdit}
                onDelete={setDeletingIncome}
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
        title={editingIncome ? 'Edit income' : 'Add income'}
        description={editingIncome ? undefined : 'Record a new incoming payment.'}
        size="md"
      >
        <IncomeForm
          key={editingIncome?.id ?? 'new'}
          income={editingIncome}
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deletingIncome !== null}
        title="Delete income"
        description={`This permanently removes "${
          deletingIncome?.description || 'this income'
        }" (${formatMoney(deletingIncome?.amount ?? 0, deletingIncome?.currency)}). This cannot be undone.`}
        isPending={deleteIncome.isPending}
        error={deleteIncome.error instanceof ApiError ? deleteIncome.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingIncome(null)}
      />
    </div>
  )
}
