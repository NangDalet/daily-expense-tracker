import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  Banknote,
  CreditCard,
  Landmark,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { PaymentMethod } from './api/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Per-currency fraction digits. Only the currencies the app can realistically
 * see are listed; anything else falls back to 2.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  JPY: 'ja-JP',
  VND: 'vi-VN',
}

export function formatMoney(amount: number, currency = 'USD'): string {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toFixed(2)}`
  }
}

/** Compact form for chart axes, where horizontal space is tight. */
export function formatMoneyCompact(amount: number, currency = 'USD'): string {
  const locale = CURRENCY_LOCALE[currency] ?? 'en-US'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return String(Math.round(amount))
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

/** `2026-01-30` -> `Jan 30, 2026`. Parsed as local time to dodge UTC shifting. */
export function formatDate(isoDate: string, style: 'short' | 'medium' = 'medium'): string {
  const date = parseIsoDate(isoDate)
  if (!date) return isoDate
  return date.toLocaleDateString('en-US', {
    month: style === 'short' ? 'short' : 'long',
    day: 'numeric',
    ...(style === 'medium' ? { year: 'numeric' } : {}),
  })
}

export function formatDateTime(isoDateTime?: string): string {
  if (!isoDateTime) return '-'
  const date = new Date(isoDateTime)
  if (Number.isNaN(date.getTime())) return isoDateTime
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Splits `YYYY-MM-DD` into a local `Date`, avoiding the UTC off-by-one day. */
export function parseIsoDate(isoDate: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function formatMonthYear(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  BANK_TRANSFER: 'Bank transfer',
  E_WALLET: 'E-wallet',
  OTHER: 'Other',
}

export const PAYMENT_METHOD_ICONS: Record<PaymentMethod, LucideIcon> = {
  CASH: Banknote,
  CREDIT_CARD: CreditCard,
  DEBIT_CARD: CreditCard,
  BANK_TRANSFER: Landmark,
  E_WALLET: Smartphone,
  OTHER: Wallet,
}

export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method] ?? method
}

/**
 * Colour a category from its `colorHex`, falling back to a stable hue derived
 * from the id so a category without a colour still looks intentional.
 */
export function resolveColor(hex: string | undefined, seed?: string): string {
  if (hex && /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) return hex
  const palette = [
    '#22c55e',
    '#3b82f6',
    '#f59e0b',
    '#8b5cf6',
    '#ec4899',
    '#ef4444',
    '#14b8a6',
    '#64748b',
  ]
  if (!seed) return palette[0]
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return palette[hash % palette.length]
}
