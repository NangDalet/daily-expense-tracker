import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useAuth } from '@/context/AuthContext'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FileDown, FileSpreadsheet, Plus, Receipt } from 'lucide-react'
import { PageHeading } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { ExpenseForm } from '@/components/expenses/ExpenseForm'
import { CashBalancePanel } from '@/components/expenses/CashBalancePanel'
import { ExpenseList, SortableHeader } from '@/components/expenses/ExpenseList'
import {
  EMPTY_FILTERS,
  ExpenseFilters,
  toFilterParams,
  type ExpenseFilterState,
} from '@/components/expenses/ExpenseFilters'
import { useCategories, useDeleteExpense, useExpenses, useExpenseTotals } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { ExpenseResponse } from '@/lib/api/types'
import { formatMoney, formatNumber, paymentMethodLabel } from '@/lib/utils'
import {
  describeExportFilters,
  downloadExpenseExport,
  fetchExpensesForExport,
  type ExpenseExportFormat,
} from '@/lib/expenseExport'

const DEFAULT_SORT = 'expenseDate,desc'
const DEFAULT_SIZE = 20

export default function ExpensesPage() {
  useLanguage()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<ExpenseFilterState>(EMPTY_FILTERS)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [sort, setSort] = useState(DEFAULT_SORT)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<ExpenseResponse | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<ExpenseResponse | null>(null)

  const deleteExpense = useDeleteExpense()
  const { data: categories } = useCategories()
  const [exporting, setExporting] = useState<ExpenseExportFormat | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportStatus, setExportStatus] = useState('')

  async function handleExport(format: ExpenseExportFormat) {
    if (exporting) return
    setExporting(format)
    setExportError(null)
    setExportStatus(t("Preparing export..."))
    const selectedFilters = toFilterParams(filters, 0, 100, sort)
    const categoryName = categories?.find((category) => category.id === selectedFilters.categoryId)?.name
    try {
      const expenses = await fetchExpensesForExport(selectedFilters, (loaded, total) => {
        setExportStatus(t("Preparing ") + formatNumber(loaded) + t(" of ") + formatNumber(total) + t(" expenses..."))
      })
      await downloadExpenseExport(format, expenses, describeExportFilters(selectedFilters, categoryName), user?.fullName?.trim() || user?.username || '')
      setExportStatus(t("Downloaded ") + formatNumber(expenses.length) + t(" expenses as ") + (format === 'xlsx' ? 'Excel' : 'PDF') + '.')
    } catch (error) {
      setExportStatus('')
      setExportError(error instanceof Error ? error.message : t("Please try again."))
    } finally {
      setExporting(null)
    }
  }

  const filterParams = useMemo(
    () => toFilterParams(filters, page, size, sort),
    [filters, page, size, sort],
  )

  const { data, isPending, isError, error, refetch } = useExpenses(filterParams)
  const totals = useExpenseTotals(filterParams)

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
        title={t("Expenses")}
        description={
          isPending && !data
            ? t("Loading your expenses...")
            : t("{0} {1} recorded", [formatNumber(pageTotal), pageTotal === 1 ? t("expense") : t("expenses")])
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport('pdf')}
              disabled={Boolean(exporting) || isPending || isError || pageTotal === 0}
              isLoading={exporting === 'pdf'}
              title={t("Export all expenses matching the current filters")}
            >
              <FileDown className="h-4 w-4" aria-hidden />
              {t("Export PDF")}</Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleExport('xlsx')}
              disabled={Boolean(exporting) || isPending || isError || pageTotal === 0}
              isLoading={exporting === 'xlsx'}
              title={t("Export all expenses matching the current filters")}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden />
              {t("Export Excel")}</Button>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("Add expense")}</Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="space-y-4 p-4 sm:p-5">
          <h2 className="flex h-8 items-center font-semibold text-slate-900">{t('Total expenses')}</h2>
          {totals.isPending && <p role="status" className="text-sm text-slate-500">{t('Loading expense totals...')}</p>}
          {totals.isError && <Alert tone="error" title={t('Could not load expense totals')}>
            <p>{totals.error.message}</p><Button variant="outline" size="sm" onClick={() => void totals.refetch()}>{t('Try again')}</Button>
          </Alert>}
          {!totals.isError && <div className="grid grid-cols-2 gap-4">
            {totals.data?.map((total, index) => <div key={total.currency} className={index > 0 ? 'min-w-0 border-l border-slate-200 pl-4' : 'min-w-0'}>
              <p className="text-xs font-medium text-slate-500">{total.currency}</p>
              <p className="mt-1 break-words text-xl font-semibold tabular-nums text-slate-900 sm:text-2xl">{formatMoney(total.totalAmount, total.currency)}</p>
              <p className="mt-1 text-xs text-slate-500">{t('{0} {1} recorded', [formatNumber(total.expenseCount), total.expenseCount === 1 ? t('expense') : t('expenses')])}</p>
            </div>)}
          </div>}
          <p className="flex min-h-10 items-center border-t border-slate-200 pt-2 text-xs text-slate-500" title={t('All matching expenses across every page, including spending from top-ups.')}>{t('All payment methods · Current filters')}</p>
        </Card>
        <CashBalancePanel />
        </div>
        {exportError && <Alert tone="error" title={t("Could not export expenses")}>{exportError}</Alert>}
        {exportStatus && <p role="status" aria-live="polite" className="text-sm text-slate-600">{exportStatus}</p>}
        <ExpenseFilters
          value={filters}
          onChange={applyFilters}
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />

        <Card className="overflow-hidden">
          {isError ? (
            <ErrorState
              title={t("Could not load expenses")}
              message={error instanceof ApiError ? error.message : undefined}
              onRetry={() => void refetch()}
            />
          ) : isPending && !data ? (
            <LoadingBlock label={t("Loading expenses")} />
          ) : showOutOfRange ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title={t("No expenses on this page")}
              description={t("The result set shrank while you were viewing it.")}
              action={
                <Button variant="outline" size="sm" onClick={() => setPage(0)}>
                  {t("Back to first page")}</Button>
              }
            />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Receipt className="h-6 w-6" aria-hidden />}
              title={t("No expenses found")}
              description={t("Record your first expense or loosen the filters.")}
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
                        label={t("Date")}
                        sort={sort}
                        onSortChange={handleSortChange}
                      />
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        {t("Description")}</th>
                      <th
                        scope="col"
                        className="px-4 py-3 text-left text-sm font-medium text-slate-500"
                      >
                        {t("Category")}</th>
                      <SortableHeader
                        field="paymentMethod"
                        label={t("Payment")}
                        sort={sort}
                        onSortChange={handleSortChange}
                      />
                      <SortableHeader
                        field="amount"
                        label={t("Amount")}
                        sort={sort}
                        onSortChange={handleSortChange}
                        className="text-right"
                      />
                      <th scope="col" className="w-20 px-4 py-3">
                        <span className="sr-only">{t("Actions")}</span>
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
                          <span className="line-clamp-1">{expense.description || t("No description")}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {expense.category?.name ?? <span className="text-slate-400">{t("None")}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">
                          {paymentMethodLabel(expense.paymentMethod)}
                          {expense.useTopupBalance && <span className="ml-2 text-xs text-brand-600">{t('From top-up')}</span>}
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
                              aria-label={t("Edit {0}", [expense.description || 'expense'])}
                            >
                              {t("Edit")}</Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-red-600"
                              onClick={() => setDeletingExpense(expense)}
                              aria-label={t("Delete {0}", [expense.description || 'expense'])}
                            >
                              {t("Delete")}</Button>
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
        title={editingExpense ? t("Edit expense") : t("Add expense")}
        description={editingExpense ? undefined : t("Record a new outgoing payment.")}
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
        title={t("Delete expense")}
        description={t("This permanently removes \"{0}\" ({1}). This cannot be undone.", [deletingExpense?.description || t("this expense"), formatMoney(deletingExpense?.amount ?? 0, deletingExpense?.currency)])}
        isPending={deleteExpense.isPending}
        error={deleteExpense.error instanceof ApiError ? deleteExpense.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingExpense(null)}
      />
    </div>
  )
}
