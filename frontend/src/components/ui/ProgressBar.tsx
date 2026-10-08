import { cn } from '@/lib/utils'

interface ProgressBarProps {
  /** 0-100, may exceed 100 when a budget is exceeded. */
  percentage: number
  tone?: 'auto' | 'brand' | 'success' | 'warning' | 'danger'
  className?: string
  label?: string
}

const BAR_TONES = {
  brand: 'bg-brand-600',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
} as const

export function ProgressBar({ percentage, tone = 'auto', className, label }: ProgressBarProps) {
  const safe = Number.isFinite(percentage) ? Math.max(0, percentage) : 0
  const width = Math.min(safe, 100)
  const resolved =
    tone === 'auto' ? (safe > 100 ? BAR_TONES.danger : safe > 85 ? BAR_TONES.warning : BAR_TONES.brand) : BAR_TONES[tone]

  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}
      role="progressbar"
      aria-valuenow={Math.round(safe)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', resolved)}
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
