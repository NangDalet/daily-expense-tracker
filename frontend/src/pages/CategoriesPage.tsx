import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { Alert, FieldErrorList } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card, CardBody } from '@/components/ui/Card'
import { Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState, ErrorState, LoadingBlock } from '@/components/ui/States'
import { CategoryIcon, CategorySwatch, CATEGORY_ICON_NAMES } from '@/components/ui/CategoryIcon'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/queries'
import { ApiError } from '@/lib/api/client'
import type { CategoryRequest, CategoryResponse } from '@/lib/api/types'
import { cn, formatNumber, resolveColor } from '@/lib/utils'

/** Curated swatches; the backend accepts any hex, this keeps the UI tidy. */
const SWATCHES = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#14b8a6',
  '#64748b',
  '#6366f1',
  '#0ea5e9',
  '#a855f7',
  '#84cc16',
]

export default function CategoriesPage() {
  const { data: categories, isPending, isError, error, refetch } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryResponse | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryResponse | null>(null)

  function openCreate() {
    setEditingCategory(null)
    setIsFormOpen(true)
  }

  function openEdit(category: CategoryResponse) {
    setEditingCategory(category)
    setIsFormOpen(true)
  }

  async function handleDelete() {
    if (!deletingCategory) return
    try {
      await deleteCategory.mutateAsync(deletingCategory.id)
      setDeletingCategory(null)
    } catch {
      // Surfaced inside the dialog.
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Categories</h1>
          <p className="mt-1 text-sm text-slate-500">
            Group your expenses and give each one an icon and colour.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New category
        </Button>
      </div>

      {isError ? (
        <Card>
          <ErrorState
            title="Could not load categories"
            message={error instanceof ApiError ? error.message : undefined}
            onRetry={() => void refetch()}
          />
        </Card>
      ) : isPending ? (
        <Card>
          <LoadingBlock label="Loading categories" />
        </Card>
      ) : (categories?.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="No categories yet"
            description="Create one to start organising your expenses."
            action={
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-4 w-4" aria-hidden />
                New category
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories?.map((category) => {
            const color = resolveColor(category.colorHex, category.id)
            return (
              <Card key={category.id} className="group transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start gap-3">
                    <CategorySwatch iconName={category.iconName} color={color} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {category.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatNumber(category.expenseCount ?? 0)}{' '}
                        {(category.expenseCount ?? 0) === 1 ? 'expense' : 'expenses'}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={() => openEdit(category)}
                        aria-label={`Edit ${category.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingCategory(category)}
                        aria-label={`Delete ${category.name}`}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {category.description && (
                    <p className="mt-3 line-clamp-2 text-xs text-slate-500">
                      {category.description}
                    </p>
                  )}
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingCategory ? 'Edit category' : 'New category'}
        description={editingCategory ? undefined : 'Categories are visible only to you.'}
        size="md"
      >
        <CategoryForm
          key={editingCategory?.id ?? 'new'}
          category={editingCategory}
          isPending={createCategory.isPending || updateCategory.isPending}
          error={
            createCategory.error instanceof ApiError
              ? createCategory.error
              : updateCategory.error instanceof ApiError
                ? updateCategory.error
                : null
          }
          onSubmit={async (values) => {
            if (editingCategory) {
              await updateCategory.mutateAsync({ id: editingCategory.id, body: values })
            } else {
              await createCategory.mutateAsync(values)
            }
            setIsFormOpen(false)
          }}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deletingCategory !== null}
        title="Delete category"
        description={
          (deletingCategory?.expenseCount ?? 0) > 0
            ? `"${deletingCategory?.name}" still has ${deletingCategory?.expenseCount} linked expenses. The backend refuses this so historical data is never orphaned - reassign those expenses first.`
            : `"${deletingCategory?.name}" has no linked expenses and can be deleted.`
        }
        isPending={deleteCategory.isPending}
        error={deleteCategory.error instanceof ApiError ? deleteCategory.error : null}
        onConfirm={handleDelete}
        onCancel={() => setDeletingCategory(null)}
      />
    </div>
  )
}

interface CategoryFormProps {
  category: CategoryResponse | null
  isPending: boolean
  error: ApiError | null
  onSubmit: (values: CategoryRequest) => Promise<void>
  onCancel: () => void
}

function CategoryForm({ category, isPending, error, onSubmit, onCancel }: CategoryFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryRequest>({
    defaultValues: {
      name: category?.name ?? '',
      description: category?.description ?? '',
      iconName: category?.iconName ?? 'Tag',
      colorHex: category?.colorHex ?? SWATCHES[0],
    },
  })

  const selectedIcon = watch('iconName')
  const selectedColor = watch('colorHex')

  // The colour input only emits a value while being dragged, so mirror the
  // swatch selection into it to keep both controls in sync.
  useEffect(() => {
    setValue('colorHex', selectedColor)
  }, [selectedColor, setValue])

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({
          ...values,
          ...(values.description?.trim() ? { description: values.description.trim() } : {}),
        })
      })}
      noValidate
      className="space-y-4"
    >
      {error && (
        <Alert tone="error" title={error.message}>
          {error.code === 'DUPLICATE_RESOURCE' && (
            <p>You already have a category with that name.</p>
          )}
          <FieldErrorList details={error.details} />
        </Alert>
      )}

      <Input
        label="Name"
        placeholder="Groceries"
        required
        autoFocus
        {...register('name', {
          required: 'Name is required',
          minLength: { value: 1, message: 'Must not be empty' },
          maxLength: { value: 80, message: 'Must be at most 80 characters' },
        })}
        error={errors.name?.message}
      />

      <Textarea
        label="Description"
        placeholder="Supermarket and farmers market runs"
        {...register('description', {
          maxLength: { value: 255, message: 'Must be at most 255 characters' },
        })}
        error={errors.description?.message}
      />

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Icon</legend>
        <input type="hidden" {...register('iconName')} />
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {CATEGORY_ICON_NAMES.map((name) => {
            const active = selectedIcon === name
            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                aria-pressed={active}
                onClick={() => setValue('iconName', name, { shouldValidate: true })}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
                )}
              >
                <CategoryIcon name={name} className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-slate-700">Colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((color) => {
            const active = selectedColor?.toLowerCase() === color.toLowerCase()
            return (
              <button
                key={color}
                type="button"
                aria-label={`Colour ${color}`}
                aria-pressed={active}
                onClick={() => setValue('colorHex', color, { shouldValidate: true })}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 transition-all',
                  active ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200',
                )}
                style={{ backgroundColor: color }}
              >
                {active && <Check className="h-3.5 w-3.5 text-white" aria-hidden />}
              </button>
            )
          })}
        </div>
        <input
          type="hidden"
          {...register('colorHex', {
            pattern: {
              value: /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/,
              message: 'Must be a hex colour such as #22c55e',
            },
          })}
        />
        {errors.colorHex && (
          <p role="alert" className="mt-1.5 text-xs text-red-600">
            {errors.colorHex.message}
          </p>
        )}
      </fieldset>

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        <CategorySwatch iconName={selectedIcon} color={selectedColor || SWATCHES[0]} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {watch('name') || 'Category name'}
          </p>
          <p className="text-xs text-slate-500">Preview</p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" isLoading={isPending}>
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </div>
    </form>
  )
}
