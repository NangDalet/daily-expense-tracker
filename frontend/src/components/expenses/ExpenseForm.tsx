import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { useCategories, useCreateExpense, useCreateExpenses, useUpdateExpense } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { ExpenseRequest, ExpenseResponse, PaymentMethod } from '@/lib/api/types'
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/api/types'
import { formatMoney, paymentMethodLabel, resolveColor, todayIso } from '@/lib/utils'
import { convertMoney } from '@/lib/currency'
import { useCashBalances } from '@/hooks/cash'

interface ExpenseFormValues {
  amount: string
  currency: string
  description: string
  expenseDate: string
  paymentMethod: PaymentMethod | 'TOPUP'
  categoryId: string
  receiptUrl: string
  tags: string
  items: { description: string; amount: string }[]
}

function toFormValues(expense: ExpenseResponse): ExpenseFormValues {
  return {
    amount: String(expense.amount),
    currency: expense.currency || 'USD',
    description: expense.description ?? '',
    expenseDate: expense.expenseDate,
    paymentMethod: expense.useTopupBalance ? 'TOPUP' : expense.paymentMethod,
    categoryId: expense.categoryId ?? '',
    receiptUrl: expense.receiptUrl ?? '',
    tags: (expense.tags ?? []).join(', '),
    items: [],
  }
}

interface ExpenseFormProps {
  /** Omit to create a new expense. */
  expense?: ExpenseResponse | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  useLanguage()
  const isEditing = Boolean(expense)
  const balances = useCashBalances()
  const initializedCashDefault = useRef(Boolean(balances.data) || isEditing)
  const categoryQuery = useCategories()
  const { data: categories } = categoryQuery
  const [multiple, setMultiple] = useState(false)
  const [categoryNotice, setCategoryNotice] = useState(false)
  const createExpense = useCreateExpense()
  const createExpenses = useCreateExpenses()
  const updateExpense = useUpdateExpense()

  const mutation = isEditing ? updateExpense : multiple ? createExpenses : createExpense

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    setValue,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    defaultValues: expense
      ? toFormValues(expense)
      : {
          amount: '',
          currency: 'USD',
          description: '',
          expenseDate: todayIso(),
          paymentMethod: balances.data?.some(balance => balance.totalTopups > 0) ? 'TOPUP' : 'CASH',
          categoryId: '',
          receiptUrl: '',
          tags: '',
          items: [],
        },
  })
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' })

  // Re-seed the form when the caller switches rows (edit A, then edit B).
  useEffect(() => {
    reset(expense ? toFormValues(expense) : undefined)
  }, [expense, reset])

  const selectedCategoryId = watch('categoryId')

  useEffect(() => {
    if (categories && selectedCategoryId && !categories.some(category => category.id === selectedCategoryId)) {
      setValue('categoryId', '', { shouldDirty: true })
      setCategoryNotice(true)
    }
  }, [categories, selectedCategoryId, setValue])

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  )

  // Preview both currencies while preserving the entered amount on save.
  const amount = watch('amount')
  const items = watch('items')
  const currency = watch('currency')
  const paymentMethod = watch('paymentMethod')
  useEffect(() => {
    if (!initializedCashDefault.current && balances.data) {
      initializedCashDefault.current = true
      if (!getFieldState('paymentMethod').isDirty && paymentMethod === 'CASH' && balances.data.some(balance => balance.totalTopups > 0)) {
        setValue('paymentMethod', 'TOPUP')
      }
    }
  }, [balances.data, paymentMethod, getFieldState, setValue])
  const useTopupBalance = paymentMethod === 'TOPUP'
  const cashBalance = balances.data?.find(balance => balance.currency === currency)
  const availableCash = cashBalance ? cashBalance.remainingAmount +
    (expense?.useTopupBalance && expense.currency === currency ? expense.amount : 0) : undefined
  const parsedAmount = multiple
    ? items.reduce((sum, item) => sum + Math.round((Number(item.amount) || 0) * 100), 0) / 100
    : Number(amount)
  const amountPreview =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? `${formatMoney(parsedAmount, currency)} ≈ ${formatMoney(convertMoney(parsedAmount, currency, currency === 'USD' ? 'KHR' : 'USD'), currency === 'USD' ? 'KHR' : 'USD')}`
      : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      mutation.reset()
      // Recheck at save time in case the category was deleted in another tab.
      if (values.categoryId) {
        const refreshed = await categoryQuery.refetch()
        if (refreshed.isError) {
          setError('categoryId', { message: t('Could not load categories. Please try again.') })
          return
        }
        if (!refreshed.data?.some(category => category.id === values.categoryId)) {
          setValue('categoryId', '', { shouldDirty: true })
          setCategoryNotice(true)
          return
        }
      }
      const body: ExpenseRequest = {
        amount: parsedAmount,
        currency: values.currency,
        // Empty optional fields are omitted so the backend keeps them null
        // instead of storing empty strings.
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        expenseDate: values.expenseDate,
        paymentMethod: values.paymentMethod === 'TOPUP' ? 'CASH' : values.paymentMethod,
        useTopupBalance: values.paymentMethod === 'TOPUP',
        // PUT is a full replacement, so an empty selection detaches the category.
        categoryId: values.categoryId || null,
        ...(values.receiptUrl.trim() ? { receiptUrl: values.receiptUrl.trim() } : {}),
        ...(values.tags.trim()
          ? {
              tags: values.tags
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean),
            }
          : {}),
      }

      if (expense) {
        await updateExpense.mutateAsync({ id: expense.id, body })
      } else if (multiple) {
        await createExpenses.mutateAsync(values.items.map(item => ({
          ...body,
          amount: Number(item.amount),
          description: [values.description.trim(), item.description.trim()].filter(Boolean).join(' — '),
        })))
      } else {
        await createExpense.mutateAsync(body)
      }
      reset()
      onSuccess?.()
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'NOT_FOUND' && error.message.startsWith('Category not found:')) {
          setValue('categoryId', '', { shouldDirty: true })
          setCategoryNotice(true)
          void categoryQuery.refetch()
        }
        // Map backend field errors back onto the matching inputs.
        for (const detail of error.details ?? []) {
          const itemField = detail.field.match(/^expenses\[(\d+)\]\.(amount|description)$/)
          if (multiple && itemField) {
            setError(`items.${Number(itemField[1])}.${itemField[2] as 'amount' | 'description'}`, { message: detail.message })
          } else {
            const field = detail.field.replace(/^expenses\[\d+\]\./, '')
            if (field in values) setError(field as keyof ExpenseFormValues, { message: detail.message })
          }
        }
      }
    }
  })

  const error = mutation.error
  const selectedCategory = (categories ?? []).find((c) => c.id === selectedCategoryId)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && (
        <Alert tone="error" title={error.message}>
          <FieldErrorList details={error instanceof ApiError ? error.details : undefined} />
        </Alert>
      )}

      {categoryNotice && <Alert tone="info" title={t('That category no longer exists. Pick another one.')}>
        <p>{t('Choose a category or save with No category.')}</p>
      </Alert>}

      {!isEditing && <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
        <input type="checkbox" checked={multiple} disabled={isSubmitting} onChange={event => {
          setMultiple(event.target.checked)
          mutation.reset()
          if (event.target.checked) replace([
            { description: '', amount: amount || '' }, { description: '', amount: '' },
          ])
          else replace([])
        }} />
        {t('Add multiple expenses')}
      </label>}

      {multiple && <div className="space-y-3 rounded-xl border border-slate-200 p-3">
        <p className="text-sm text-slate-500">{t('For example: sandwich and coffee for breakfast. Each item is saved as a separate expense.')}</p>
        {fields.map((field, index) => <div key={field.id} className="grid items-start gap-2 sm:grid-cols-[1fr_8rem_auto]">
          <Input label={t('Item {0}', [index + 1])} placeholder={index === 0 ? t('Sandwich') : t('Coffee')}
            {...register(`items.${index}.description`, {
              validate: value => !value.trim() ? t('Item name is required')
                : [watch('description').trim(), value.trim()].filter(Boolean).join(' — ').length <= 500 || t('Must be at most 500 characters'),
            })} error={errors.items?.[index]?.description?.message} />
          <Input label={t('Item amount {0}', [index + 1])} type="number" step="0.01" min="0.01" inputMode="decimal"
            {...register(`items.${index}.amount`, {
              validate: value => (Number.isFinite(Number(value)) && Number(value) >= 0.01) || t('Amount must be greater than 0'),
            })} error={errors.items?.[index]?.amount?.message} />
          <Button type="button" variant="ghost" disabled={fields.length <= 1 || isSubmitting}
            aria-label={t('Remove item {0}', [index + 1])} onClick={() => remove(index)} className="sm:mt-7">{t('Remove')}</Button>
        </div>)}
        <Button type="button" variant="outline" size="sm" disabled={fields.length >= 20 || isSubmitting}
          onClick={() => append({ description: '', amount: '' })}>{t('Add item')}</Button>
        <p className="text-sm font-semibold" aria-live="polite">{t('Total')}: {formatMoney(parsedAmount, currency)}</p>
      </div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {!multiple && <Input
          label={t("Amount")}
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          placeholder="0.00"
          required
          autoFocus
          {...register('amount', {
            required: "Amount is required",
            validate: (value) => {
              const parsed = Number.parseFloat(value)
              if (!Number.isFinite(parsed)) return 'Enter a valid amount'
              if (parsed <= 0) return 'Amount must be greater than 0'
              return true
            },
          })}
          error={errors.amount?.message}
          hint={amountPreview ?? undefined}
        />}

        <Select
          label={t("Currency")}
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          {...register('currency', {
            required: "Currency is required",
            validate: (value) => CURRENCIES.some((code) => code === value) || 'Currency must be USD or KHR',
          })}
          error={errors.currency?.message}
          hint={t('Fixed rate: 1 USD = 4,000 KHR')}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("Date")}
          type="date"
          required
          {...register('expenseDate', { required: "Date is required" })}
          error={errors.expenseDate?.message}
        />

        <Select
          label={t("Payment method")}
          options={[{ value: 'TOPUP', label: t('Top-up balance') }, ...PAYMENT_METHODS.map((method) => ({
            value: method,
            label: paymentMethodLabel(method),
          }))]}
          {...register('paymentMethod', { required: true })}
          error={errors.paymentMethod?.message}
        />
      </div>

      {useTopupBalance && <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
        {balances.isPending && <p className="text-xs text-slate-500">{t('Loading cash balance...')}</p>}
        {balances.isError && <p role="alert" className="text-xs text-red-600">{t('Could not load cash balance')}</p>}
        {availableCash !== undefined && <p className="text-xs text-slate-500">{t('Available cash')}: {formatMoney(availableCash, currency)}</p>}
        {useTopupBalance && availableCash !== undefined && parsedAmount > availableCash &&
          <p role="alert" className="text-xs text-red-600">{t('Not enough cash. Add a top-up or reduce the amount.')}</p>}
      </div>}

      <Select
        label={t("Category")}
        placeholder={t("No category")}
        options={categoryOptions}
        {...register('categoryId', { onChange: () => { setCategoryNotice(false); mutation.reset() } })}
        disabled={categoryQuery.isPending || isSubmitting}
        error={errors.categoryId?.message}
        hint={
          selectedCategory
            ? t("Colour {0}", [resolveColor(selectedCategory.colorHex, selectedCategory.id)])
            : t("Expenses may exist without a category")
        }
      />

      <Textarea
        label={t("Description")}
        rows={2}
        placeholder={multiple ? t('Breakfast') : t("Weekly groceries run")}
        {...register('description', { maxLength: { value: 500, message: "Must be at most 500 characters" } })}
        error={errors.description?.message}
      />

      <details className="rounded-xl border border-slate-200 p-3" open={Boolean(expense?.tags?.length || expense?.receiptUrl)}>
      <summary className="cursor-pointer text-sm font-medium text-slate-700">{t('More details')}</summary>
      <div className="mt-3 space-y-4">
      <Input
        label={t("Tags")}
        placeholder={t("recurring, shared")}
        {...register('tags')}
        error={errors.tags?.message}
        hint={t("Comma separated, up to 20 tags")}
      />

      <Input
        label={t("Receipt URL")}
        type="url"
        placeholder="https://..."
        {...register('receiptUrl', {
          maxLength: { value: 500, message: "Must be at most 500 characters" },
          pattern: {
            value: /^$|^https?:\/\/\S+$/,
            message: "Enter a valid http(s) URL",
          },
        })}
        error={errors.receiptUrl?.message}
      />

      </div>
      </details>

      <div className="expense-form-actions flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            {t("Cancel")}</Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {isEditing ? t("Save changes") : multiple ? t(fields.length === 1 ? 'Add {0} expense' : 'Add {0} expenses', [fields.length]) : t("Add expense")}
        </Button>
      </div>
    </form>
  )
}
