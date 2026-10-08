import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { useCategories, useCreateExpense, useUpdateExpense } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { ExpenseRequest, ExpenseResponse, PaymentMethod } from '@/lib/api/types'
import { PAYMENT_METHODS } from '@/lib/api/types'
import { paymentMethodLabel, resolveColor, todayIso } from '@/lib/utils'

/** Common ISO-4217 codes; the backend accepts any 3-letter code. */
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'VND', 'CAD', 'AUD', 'INR'] as const

interface ExpenseFormValues {
  amount: string
  currency: string
  description: string
  expenseDate: string
  paymentMethod: PaymentMethod
  categoryId: string
  receiptUrl: string
  tags: string
}

function toFormValues(expense: ExpenseResponse): ExpenseFormValues {
  return {
    amount: String(expense.amount),
    currency: expense.currency || 'USD',
    description: expense.description ?? '',
    expenseDate: expense.expenseDate,
    paymentMethod: expense.paymentMethod,
    categoryId: expense.categoryId ?? '',
    receiptUrl: expense.receiptUrl ?? '',
    tags: (expense.tags ?? []).join(', '),
  }
}

interface ExpenseFormProps {
  /** Omit to create a new expense. */
  expense?: ExpenseResponse | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function ExpenseForm({ expense, onSuccess, onCancel }: ExpenseFormProps) {
  const isEditing = Boolean(expense)
  const { data: categories } = useCategories()
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()

  const mutation = isEditing ? updateExpense : createExpense

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormValues>({
    defaultValues: expense
      ? toFormValues(expense)
      : {
          amount: '',
          currency: 'USD',
          description: '',
          expenseDate: todayIso(),
          paymentMethod: 'CASH',
          categoryId: '',
          receiptUrl: '',
          tags: '',
        },
  })

  // Re-seed the form when the caller switches rows (edit A, then edit B).
  useEffect(() => {
    reset(expense ? toFormValues(expense) : undefined)
  }, [expense, reset])

  const selectedCategoryId = watch('categoryId')

  const categoryOptions = useMemo(
    () =>
      (categories ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories],
  )

  // Live total hint: shows the amount in the selected currency.
  const amount = watch('amount')
  const currency = watch('currency')
  const parsedAmount = Number.parseFloat(amount)
  const amountPreview =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(parsedAmount)
      : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const body: ExpenseRequest = {
        amount: parsedAmount,
        currency: values.currency,
        // Empty optional fields are omitted so the backend keeps them null
        // instead of storing empty strings.
        ...(values.description.trim() ? { description: values.description.trim() } : {}),
        expenseDate: values.expenseDate,
        paymentMethod: values.paymentMethod,
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
      } else {
        await createExpense.mutateAsync(body)
      }
      reset()
      onSuccess?.()
    } catch (error) {
      if (error instanceof ApiError) {
        // Map backend field errors back onto the matching inputs.
        for (const detail of error.details ?? []) {
          const field =
            detail.field === 'categoryId'
              ? 'categoryId'
              : detail.field === 'expenseDate'
                ? 'expenseDate'
                : detail.field
          if (field in values) {
            setError(field as keyof ExpenseFormValues, { message: detail.message })
          }
        }
      }
    }
  })

  const error = mutation.error instanceof ApiError ? mutation.error : null
  const selectedCategory = (categories ?? []).find((c) => c.id === selectedCategoryId)

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {error && (
        <Alert tone="error" title={error.message}>
          {error.code === 'NOT_FOUND' && <p>That category no longer exists. Pick another one.</p>}
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min="0.01"
          inputMode="decimal"
          placeholder="0.00"
          required
          autoFocus
          {...register('amount', {
            required: 'Amount is required',
            validate: (value) => {
              const parsed = Number.parseFloat(value)
              if (!Number.isFinite(parsed)) return 'Enter a valid amount'
              if (parsed <= 0) return 'Amount must be greater than 0'
              return true
            },
          })}
          error={errors.amount?.message}
          hint={amountPreview ?? undefined}
        />

        <Select
          label="Currency"
          options={CURRENCIES.map((code) => ({ value: code, label: code }))}
          {...register('currency', { required: true })}
          error={errors.currency?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          required
          {...register('expenseDate', { required: 'Date is required' })}
          error={errors.expenseDate?.message}
        />

        <Select
          label="Payment method"
          options={PAYMENT_METHODS.map((method) => ({
            value: method,
            label: paymentMethodLabel(method),
          }))}
          {...register('paymentMethod', { required: true })}
          error={errors.paymentMethod?.message}
        />
      </div>

      <Select
        label="Category"
        placeholder="No category"
        options={categoryOptions}
        {...register('categoryId')}
        error={errors.categoryId?.message}
        hint={
          selectedCategory
            ? `Colour ${resolveColor(selectedCategory.colorHex, selectedCategory.id)}`
            : 'Expenses may exist without a category'
        }
      />

      <Textarea
        label="Description"
        placeholder="Weekly groceries run"
        {...register('description', { maxLength: { value: 500, message: 'Must be at most 500 characters' } })}
        error={errors.description?.message}
      />

      <Input
        label="Tags"
        placeholder="recurring, shared"
        {...register('tags')}
        error={errors.tags?.message}
        hint="Comma separated, up to 20 tags"
      />

      <Input
        label="Receipt URL"
        type="url"
        placeholder="https://..."
        {...register('receiptUrl', {
          maxLength: { value: 500, message: 'Must be at most 500 characters' },
          pattern: {
            value: /^$|^https?:\/\/\S+$/,
            message: 'Enter a valid http(s) URL',
          },
        })}
        error={errors.receiptUrl?.message}
      />

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {isEditing ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  )
}
