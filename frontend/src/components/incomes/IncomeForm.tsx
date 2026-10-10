import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Field'
import { useCategories, useCreateIncome, useUpdateIncome } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { IncomeRequest, IncomeResponse, PaymentMethod } from '@/lib/api/types'
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/api/types'
import { formatMoney, paymentMethodLabel, resolveColor, todayIso } from '@/lib/utils'

interface IncomeFormValues {
  amount: string
  currency: string
  description: string
  incomeDate: string
  paymentMethod: PaymentMethod
  categoryId: string
  receiptUrl: string
  tags: string
}

function toFormValues(income: IncomeResponse): IncomeFormValues {
  return {
    amount: String(income.amount),
    currency: income.currency || 'USD',
    description: income.description ?? '',
    incomeDate: income.incomeDate,
    paymentMethod: income.paymentMethod,
    categoryId: income.categoryId ?? '',
    receiptUrl: income.receiptUrl ?? '',
    tags: (income.tags ?? []).join(', '),
  }
}

interface IncomeFormProps {
  /** Omit to create a new income. */
  income?: IncomeResponse | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function IncomeForm({ income, onSuccess, onCancel }: IncomeFormProps) {
  const isEditing = Boolean(income)
  const { data: categories } = useCategories()
  const createIncome = useCreateIncome()
  const updateIncome = useUpdateIncome()

  const mutation = isEditing ? updateIncome : createIncome

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<IncomeFormValues>({
    defaultValues: income
      ? toFormValues(income)
      : {
          amount: '',
          currency: 'USD',
          description: '',
          incomeDate: todayIso(),
          paymentMethod: 'BANK_TRANSFER',
          categoryId: '',
          receiptUrl: '',
          tags: '',
        },
  })

  // Re-seed the form when the caller switches rows (edit A, then edit B).
  useEffect(() => {
    reset(income ? toFormValues(income) : undefined)
  }, [income, reset])

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
      ? formatMoney(parsedAmount, currency)
      : null

  const onSubmit = handleSubmit(async (values) => {
    try {
      const body: IncomeRequest = {
        amount: parsedAmount,
        currency: values.currency,
        // Empty optional fields clear their previous values on replacement
        // including descriptions, receipts and tags.
        description: values.description.trim(),
        incomeDate: values.incomeDate,
        paymentMethod: values.paymentMethod,
        // PUT is a full replacement, so an empty selection detaches the category.
        categoryId: values.categoryId || null,
        receiptUrl: values.receiptUrl.trim(),
        tags: values.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      }

      if (income) {
        await updateIncome.mutateAsync({ id: income.id, body })
      } else {
        await createIncome.mutateAsync(body)
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
              : detail.field === 'incomeDate'
                ? 'incomeDate'
                : detail.field
          if (field in values) {
            setError(field as keyof IncomeFormValues, { message: detail.message })
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
          {...register('currency', {
            required: 'Currency is required',
            validate: (value) => CURRENCIES.some((code) => code === value) || 'Currency must be USD or KHR',
          })}
          error={errors.currency?.message}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Date"
          type="date"
          required
          {...register('incomeDate', { required: 'Date is required' })}
          error={errors.incomeDate?.message}
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
            : 'Income may exist without a category'
        }
      />

      <Textarea
        label="Description"
        placeholder="Monthly salary"
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
          {isEditing ? 'Save changes' : 'Add income'}
        </Button>
      </div>
    </form>
  )
}
