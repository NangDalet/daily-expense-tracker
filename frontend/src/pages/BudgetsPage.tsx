import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
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
import { CURRENCIES } from '@/lib/api/types'
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
  useLanguage()
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
  const overallBudgets = usage?.filter((entry) => !entry.budget.categoryId) ?? []
  const perCategory = usage?.filter((entry) => entry.budget.categoryId) ?? []
  const categorySummary = CURRENCIES.map((currency) => {
    const entries = perCategory.filter((entry) => entry.budget.currency === currency)
    if (!entries.length) return null
    return t("{0} spent of {1}", [formatMoney(entries.reduce((sum, entry) => sum + entry.spentAmount, 0), currency), formatMoney(entries.reduce((sum, entry) => sum + entry.budget.monthlyLimit, 0), currency)])
  }).filter(Boolean).join(' | ')

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t("Budgets")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("Monthly limits overall and per category.")}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          {t("Set budget")}</Button>
      </div>

      <p className="mb-4 text-xs text-slate-500">{t('Includes USD and KHR at 1 USD = 4,000 KHR.')}</p>
      <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <Button
          variant="outline"
          size="sm"
          onClick={() => shiftPeriod(-1)}
          aria-label={t("Previous month")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{t("Previous")}</span>
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-900">
            {formatMonthYear(period.year, period.month)}
          </span>
          {isCurrentMonth && <Badge tone="brand">{t("Current")}</Badge>}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => shiftPeriod(1)}
          disabled={period.year >= YEAR_CEIL && period.month === 12}
          aria-label={t("Next month")}
        >
          <span className="hidden sm:inline">{t("Next")}</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      {isError ? (
        <Card>
          <ErrorState
            title={t("Could not load budgets")}
            message={error instanceof Error ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : isPending ? (
        <Card>
          <LoadingBlock label={t("Loading budgets")} />
        </Card>
      ) : (usage?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            icon={<Target className="h-6 w-6" aria-hidden />}
            title={t("No budgets for {0}", [formatMonthYear(period.year, period.month)])}
            description={t("Set an overall limit or a per-category limit to start tracking.")}
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                {t("Set budget")}</Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {overallBudgets.map((overall) => (
            <Card key={overall.budget.id}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-slate-400" aria-hidden />
                    {t("Overall budget")}</span>
                }
                description={t("{0} spent of {1} across {2} expenses", [formatMoney(overall.spentAmount, overall.budget.currency), formatMoney(
                  overall.budget.monthlyLimit, overall.budget.currency,
                ), formatNumber(overall.expenseCount)])}
                action={
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(overall)}
                      aria-label={t("Edit overall budget")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setDeletingUsage(overall)}
                      aria-label={t("Delete overall budget")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                }
              />
              <CardBody className="space-y-2">
                <ProgressBar
                  percentage={overall.usagePercentage}
                  label={t("Overall budget usage")}
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
                      ? t("Over budget by {0}", [formatMoney(Math.abs(overall.remainingAmount), overall.budget.currency)])
                      : t("{0} remaining", [formatMoney(overall.remainingAmount, overall.budget.currency)])}
                  </span>
                  <span className="tabular-nums text-slate-500">
                    {formatPercent(overall.usagePercentage)}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}

          {perCategory.length > 0 && (
            <Card>
              <CardHeader
                title={t("Category budgets")}
                description={categorySummary}
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
                              {entry.budget.category?.name ?? t("Unknown category")}
                            </span>
                            <span className="text-xs tabular-nums text-slate-500">
                              <span
                                className={cn(
                                  'font-semibold',
                                  entry.exceeded ? 'text-red-600' : 'text-slate-800',
                                )}
                              >
                                {formatMoney(entry.spentAmount, entry.budget.currency)}
                              </span>
                              {' / '}
                              {formatMoney(entry.budget.monthlyLimit, entry.budget.currency)}
                            </span>
                          </div>

                          <ProgressBar
                            percentage={entry.usagePercentage}
                            label={t("{0} usage", [entry.budget.category?.name ?? 'Category'])}
                            className="mt-2"
                          />

                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {formatNumber(entry.expenseCount)}{' '}
                              {entry.expenseCount === 1 ? t("expense") : t("expenses")} ·{' '}
                              {formatPercent(entry.usagePercentage)} {t("used")}</span>
                            <span className={cn(entry.exceeded && 'font-medium text-red-600')}>
                              {entry.exceeded
                                ? t("{0} over", [formatMoney(Math.abs(entry.remainingAmount), entry.budget.currency)])
                                : t("{0} left", [formatMoney(entry.remainingAmount, entry.budget.currency)])}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => openEdit(entry)}
                            aria-label={t("Edit {0} budget", [entry.budget.category?.name ?? 'category'])}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingUsage(entry)}
                            aria-label={t("Delete {0} budget", [entry.budget.category?.name ?? 'category'])}
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
        title={formSeed ? t("Edit budget") : t("Set a budget")}
        description={
          formSeed
            ? t("The category of an existing budget is immutable; the currency, limit and period can change.")
            : t("Pick a category, or leave it empty for the overall limit.")
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
        title={t("Delete budget")}
        description={t("The {0} budget for {1} will be removed. Recorded expenses are not affected.", [formatMonthYear(
          deletingUsage?.budget.year ?? period.year,
          deletingUsage?.budget.month ?? period.month,
        ), deletingUsage?.budget.category?.name ?? t("the overall limit")])}
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
  currency: string
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
  useLanguage()
  const isEditing = Boolean(seed)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    defaultValues: {
      currency: seed?.budget.currency ?? 'USD',
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
          currency: values.currency,
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
        label={t("Category")}
        placeholder={t("Overall budget (no category)")}
        options={(categories ?? []).map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        disabled={isEditing}
        {...register('categoryId')}
        error={errors.categoryId?.message}
        hint={isEditing ? t("The category of an existing budget cannot be changed.") : undefined}
      />

      <Select
        label={t("Currency")}
        options={CURRENCIES.map((code) => ({ value: code, label: code }))}
        {...register('currency', { required: true })}
        hint={t("Only spending in this currency counts toward this budget.")}
      />

      <Input
        label={t("Monthly limit")}
        type="number"
        step="0.01"
        min="0.01"
        inputMode="decimal"
        placeholder="400.00"
        required
        autoFocus={!isEditing}
        {...register('monthlyLimit', {
          required: "A monthly limit is required",
          validate: (value) => {
            const parsed = Number(value)
            if (!Number.isFinite(parsed)) return t("Enter a valid amount")
            if (parsed <= 0) return t("The limit must be greater than 0")
            return true
          },
        })}
        error={errors.monthlyLimit?.message}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label={t("Month")}
          options={MONTH_NAMES.map((name, index) => ({ value: String(index + 1), label: t(name) }))}
          {...register('month', { required: true })}
          error={errors.month?.message}
        />
        <Select
          label={t("Year")}
          options={years.map((value) => ({ value: String(value), label: String(value) }))}
          {...register('year', { required: true })}
          error={errors.year?.message}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          {t("Cancel")}</Button>
        <Button type="submit" isLoading={isPending}>
          {isEditing ? t("Save changes") : t("Save budget")}
        </Button>
      </div>
    </form>
  )
}
