import { useEffect, useState } from 'react'
import { Filter, RotateCcw, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Field'
import { useCategories } from '@/hooks/queries'
import type { IncomeFilterParams, PaymentMethod } from '@/lib/api/types'
import { PAYMENT_METHODS } from '@/lib/api/types'
import { paymentMethodLabel } from '@/lib/utils'

export interface IncomeFilterState {
  search: string
  categoryId: string
  fromDate: string
  toDate: string
  minAmount: string
  maxAmount: string
  paymentMethods: PaymentMethod[]
}

export const EMPTY_FILTERS: IncomeFilterState = {
  search: '',
  categoryId: '',
  fromDate: '',
  toDate: '',
  minAmount: '',
  maxAmount: '',
  paymentMethods: [],
}

export function countActiveFilters(filters: IncomeFilterState): number {
  let count = 0
  if (filters.search.trim()) count += 1
  if (filters.categoryId) count += 1
  if (filters.fromDate) count += 1
  if (filters.toDate) count += 1
  if (filters.minAmount) count += 1
  if (filters.maxAmount) count += 1
  count += filters.paymentMethods.length
  return count
}

/** Serialises the form state into query params, dropping blank values. */
export function toFilterParams(
  filters: IncomeFilterState,
  page: number,
  size: number,
  sort: string,
): IncomeFilterParams {
  return {
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.fromDate ? { fromDate: filters.fromDate } : {}),
    ...(filters.toDate ? { toDate: filters.toDate } : {}),
    ...(filters.minAmount ? { minAmount: Number(filters.minAmount) } : {}),
    ...(filters.maxAmount ? { maxAmount: Number(filters.maxAmount) } : {}),
    ...(filters.paymentMethods.length ? { paymentMethods: filters.paymentMethods } : {}),
    page,
    size,
    sort,
  }
}

interface IncomeFiltersProps {
  value: IncomeFilterState
  onChange: (next: IncomeFilterState) => void
  onReset: () => void
}

export function IncomeFilters({ value, onChange, onReset }: IncomeFiltersProps) {
  const { data: categories } = useCategories()
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchDraft, setSearchDraft] = useState(value.search)

  // The search box is debounced separately from the rest of the filters so
  // typing does not fire a request per keystroke.
  useEffect(() => {
    if (searchDraft === value.search) return
    const timer = window.setTimeout(() => {
      onChange({ ...value, search: searchDraft })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [searchDraft, value, onChange])

  useEffect(() => {
    setSearchDraft(value.search)
  }, [value.search])

  const activeCount = countActiveFilters(value)

  function togglePaymentMethod(method: PaymentMethod) {
    const next = value.paymentMethods.includes(method)
      ? value.paymentMethods.filter((m) => m !== method)
      : [...value.paymentMethods, method]
    onChange({ ...value, paymentMethods: next })
  }

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search descriptions or amounts"
            aria-label="Search income"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsExpanded((open) => !open)}
            aria-expanded={isExpanded}
          >
            <Filter className="h-4 w-4" aria-hidden />
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-600 px-1.5 text-[11px] leading-4 font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>

          {activeCount > 0 && (
            <Button variant="ghost" onClick={onReset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Clear
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4 border-t border-slate-200 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Select
              label="Category"
              placeholder="All categories"
              value={value.categoryId}
              onChange={(event) => onChange({ ...value, categoryId: event.target.value })}
              options={(categories ?? []).map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
            <Input
              label="From date"
              type="date"
              value={value.fromDate}
              onChange={(event) => onChange({ ...value, fromDate: event.target.value })}
            />
            <Input
              label="To date"
              type="date"
              value={value.toDate}
              onChange={(event) => onChange({ ...value, toDate: event.target.value })}
              error={
                value.fromDate && value.toDate && value.toDate < value.fromDate
                  ? 'Must not be earlier than the from date'
                  : undefined
              }
            />
            <Input
              label="Min amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="0.00"
              value={value.minAmount}
              onChange={(event) => onChange({ ...value, minAmount: event.target.value })}
            />
            <Input
              label="Max amount"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="500.00"
              value={value.maxAmount}
              onChange={(event) => onChange({ ...value, maxAmount: event.target.value })}
            />
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-slate-700">Payment methods</legend>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const active = value.paymentMethods.includes(method)
                return (
                  <button
                    key={method}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePaymentMethod(method)}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {paymentMethodLabel(method)}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>
      )}
    </div>
  )
}
