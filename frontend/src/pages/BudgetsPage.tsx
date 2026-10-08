import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { ChevronLeft, ChevronRight, Pencil, Plus, Target, Trash2, Wallet } from 'lucide-react'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { CategorySwatch } from '@/components/ui/CategoryIcon'
import {
  useBudgetUsage,
  useCategories,
  useDeleteBudget,
  useSaveBudget,
  useUpdateBudget,
} from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { BudgetRequest, BudgetUsageResponse } from '@/lib/api/types'
import {
  MONTH_NAMES,
  cn,
  formatMoney,
  formatMonthYear,
  formatNumber,
  formatPercent,
  resolveColor,
} from '@/lib/utils'

const YEAR_FLOOR = 2000
const YEAR_CEIL = 2100

function currentPeriod() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

export default function BudgetsPage() {
  const { year, month } = currentPeriod()
  const [period, setPeriod] = useState({ year, month })
  const [deletingUsage, setDeletingUsage] = useState<BudgetUsageResponse | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formSeed, setFormSeed] = useState<BudgetUsageResponse | null>(null)

  const { data: usage, isPending, isError, error, refetch } = useBudgetUsage(period.year, period.month)
  const { data: categories } = useCategories()
  const saveBudget = useSaveBudget()
  const updateBudget = useUpdateBudget()
  const deleteBudget = useDeleteBudget()

  const isCurrentMonth = period.year === year && period.month === month

  function shiftPeriod(delta: number) {
    setPeriod((current) => {
      const zeroBased = current.year * 12 + (current.month - 1) + delta
      return { year: Math.floor(zeroBased / 12), month: (zeroBased % 12) + 1 }
    })
  }

  function openCreate() {
    setFormSeed(null)
    setIsFormOpen(true)
  }

  function openEdit(entry: BudgetUsageResponse) {
    setFormSeed(entry)
    setIsFormOpen(true)
  }

  async function handleDelete() {
    if (!deletingUsage) return
    try {
      await deleteBudget.mutateAsync(deletingUsage.budget.id)
      setDeletingUsage(null)
    } catch {
      // Surfaced inside the dialog.
    }
  }

  // The backend lists the overall (category-less) budget first.
  const overall = usage?.find((entry) => !entry.budget.categoryId)
  const perCategory = usage?.filter((entry) => entry.budget.categoryId) ?? []
  const totalLimit = (usage ?? []).reduce((sum, e) => sum + e.budget.monthlyLimit, 0)
  const totalSpent = (usage ?? []).reduce((sum, e) => sum + e.spentAmount, 0)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Budgets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Monthly limits overall and per category.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          Set budget
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={() => shiftPeriod(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {formatMonthYear(period.year, period.month)}
          </span>
          {isCurrentMonth && <Badge tone="brand">Current</Badge>}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => shiftPeriod(1)}
          disabled={period.year >= YEAR_CEIL && period.month === 12}
          aria-label="Next month"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {isError ? (
        <Card>
          <ErrorState
            title="Could not load budgets"
            message={error instanceof ApiError ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : isPending ? (
        <Card>
          <LoadingBlock label="Loading budgets" />
        </Card>
      ) : (usage?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-6 w-6" aria-hidden />}
            title={`No budgets for ${formatMonthYear(period.year, period.month)}`}
            description="Set an overall limit or a per-category limit to start tracking."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                Set budget
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {overall && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-400" aria-hidden />
                    Overall budget
                  </span>
                }
                description={`${formatMoney(overall.spentAmount)} spent of ${formatMoney(
                  overall.budget.monthlyLimit,
                )} across ${formatNumber(overall.expenseCount)} expenses`}
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(overall)}
                      aria-label="Edit overall budget"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setDeletingUsage(overall)}
                      aria-label="Delete overall budget"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
              <CardBody className="space-y-2">
                <ProgressBar
                  percentage={overall.usagePercentage}
                  label="Overall budget usage"
                  className="h-2.5"
                />
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      'font-medium',
                      overall.exceeded ? 'text-red-600' : 'text-slate-600',
                    )}
                  >
                    {overall.exceeded
                      ? `Over budget by ${formatMoney(Math.abs(overall.remainingAmount))}`
                      : `${formatMoney(overall.remainingAmount)} remaining`}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {formatPercent(overall.usagePercentage)}
                  </span>
                </div>
              </CardBody>
            </Card>
          )}

          {perCategory.length > 0 && (
            <Card>
              <CardHeader
                title="Category budgets"
                description={`${formatMoney(totalSpent)} spent of ${formatMoney(totalLimit)} combined`}
              />
              <ul className="divide-y divide-slate-100">
                {perCategory.map((entry) => {
                  const color = resolveColor(entry.budget.category?.colorHex, entry.budget.categoryId)
                  return (
                    <li key={entry.budget.id} className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <CategorySwatch
                          iconName={entry.budget.category?.iconName}
                          color={color}
                          size="sm"
                          className="mt-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <span className="truncate text-sm font-medium text-slate-900">
                              {entry.budget.category?.name ?? 'Unknown category'}
                            </span>
                            <span className="text-xs tabular-nums text-slate-500">
                              <span
                                className={cn(
                                  'font-semibold',
                                  entry.exceeded ? 'text-red-600' : 'text-slate-800',
                                )}
                              >
                                {formatMoney(entry.spentAmount)}
                              </span>
                              {' / '}
                              {formatMoney(entry.budget.monthlyLimit)}
                            </span>
                          </div>

                          <ProgressBar
                            percentage={entry.usagePercentage}
                            label={`${entry.budget.category?.name ?? 'Category'} usage`}
                            className="mt-2"
                          />

                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {formatNumber(entry.expenseCount)}{' '}
                              {entry.expenseCount === 1 ? 'expense' : 'expenses'} ·{' '}
                              {formatPercent(entry.usagePercentage)} used
                            </span>
                            <span className={cn(entry.exceeded && 'font-medium text-red-600')}>
                              {entry.exceeded
                                ? `${formatMoney(Math.abs(entry.remainingAmount))} over`
                                : `${formatMoney(entry.remainingAmount)} left`}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(entry)}
                            aria-label={`Edit ${entry.budget.category?.name ?? 'category'} budget`}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingUsage(entry)}
                            aria-label={`Delete ${entry.budget.category?.name ?? 'category'} budget`}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}
        </div>
      )}

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={formSeed ? 'Edit budget' : 'Set a budget'}
        description={
          formSeed
            ? 'The category of an existing budget is immutable; only the limit and period can change.'
            : 'Pick a category, or leave it empty for the overall limit.'
        }
        size="md"
      >
        <BudgetForm
          key={formSeed?.budget.id ?? 'new'}
          seed={formSeed}
          categories={categories}
          defaultPeriod={period}
          isPending={saveBudget.isPending || updateBudget.isPending}
          error={
            saveBudget.error instanceof ApiError
              ? saveBudget.error
              : updateBudget.error instanceof ApiError
                ? updateBudget.error
                : null
          }
          onSubmit={async (values) => {
            if (formSeed) {
              await updateBudget.mutateAsync({ id: formSeed.budget.id, body: values })
            } else {
              // POST is the convergent upsert for (user, category, period).
              await saveBudget.mutateAsync(values)
            }
            setIsFormOpen(false)
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deletingUsage !== null}
        title="Delete budget"
        description={`The ${formatMonthYear(
          deletingUsage?.budget.year ?? period.year,
          deletingUsage?.budget.month ?? period.month,
        )} budget for ${
          deletingUsage?.budget.category?.name ?? 'the overall limit'
        } will be removed. Recorded expenses are not affected.`}
        isPending={deleteBudget.isPending}
        error={deleteBudget.error instanceof ApiError ? deleteBudget.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingUsage(null)}
      />
    </div>
  )
}

/** The inputs are text controls, so the numeric DTO fields arrive as strings. */
interface BudgetFormValues {
  categoryId: string
  monthlyLimit: string
  month: string
  year: string
}

interface BudgetFormProps {
  seed: BudgetUsageResponse | null
  categories: { id: string; name: string }[] | undefined
  defaultPeriod: { year: number; month: number }
  isPending: boolean
  error: ApiError | null
  onSubmit: (values: BudgetRequest) => Promise<void>
  onCancel: () => void
}

function BudgetForm({
  seed,
  categories,
  defaultPeriod,
  isPending,
  error,
  onSubmit,
  onCancel,
}: BudgetFormProps) {
  const isEditing = Boolean(seed)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    defaultValues: {
      categoryId: seed?.budget.categoryId ?? '',
      monthlyLimit: seed ? String(seed.budget.monthlyLimit) : '',
      month: String(seed?.budget.month ?? defaultPeriod.month),
      year: String(seed?.budget.year ?? defaultPeriod.year),
    },
  })

  const years = Array.from({ length: YEAR_CEIL - YEAR_FLOOR + 1 }, (_, i) => YEAR_FLOOR + i)

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          // `monthlyLimit` is a number in the DTO, but the input yields a string.
          monthlyLimit: Number(values.monthlyLimit),
          month: Number(values.month),
          year: Number(values.year),
          // Null (not "") addresses the overall budget.
          categoryId: values.categoryId || null,
        })
      })}
      noValidate
      className="space-y-4"
    >
      {error && (
        <Alert tone="error" title={error.message}>
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <Select
        label="Category"
        placeholder="Overall budget (no category)"
        options={(categories ?? []).map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        disabled={isEditing}
        {...register('categoryId')}
        error={errors.categoryId?.message}
        hint={isEditing ? 'The category of an existing budget cannot be changed.' : undefined}
      />

      <Input
        label="Monthly limit"
        type="number"
        step="0.01"
        min="0.01"
        inputMode="decimal"
        placeholder="400.00"
        required
        autoFocus={!isEditing}
        {...register('monthlyLimit', {
          required: 'A monthly limit is required',
          validate: (value) => {
            const parsed = Number(value)
            if (!Number.isFinite(parsed)) return 'Enter a valid amount'
            if (parsed <= 0) return 'The limit must be greater than 0'
            return true
          },
        })}
        error={errors.monthlyLimit?.message}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Month"
          options={MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: name }))}
          {...register('month', { required: true })}
          error={errors.month?.message}
        />
        <Select
          label="Year"
          options={years.map((value) => ({ value: String(value), label: String(value) }))}
          {...register('year', { required: true })}
          error={errors.year?.message}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending}>
          {isEditing ? 'Save changes' : 'Save budget'}
        </Button>
      </div>
    </form>
  )
}
