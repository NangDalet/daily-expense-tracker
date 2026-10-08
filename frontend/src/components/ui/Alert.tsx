import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type AlertTone = 'error' | 'success' | 'info'

const TONES: Record<AlertTone, { wrap: string; icon: React.ReactNode }> = {
  error: {
    wrap: 'border-red-200 bg-red-50 text-red-800',
    icon: <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />,
  },
  success: {
    wrap: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />,
  },
  info: {
    wrap: 'border-sky-200 bg-sky-50 text-sky-800',
    icon: <Info className="h-4 w-4 shrink-0 text-sky-500" aria-hidden />,
  },
}

interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: React.ReactNode
  className?: string
}

export function Alert({ tone = 'error', title, children, className }: AlertProps) {
  const { wrap, icon } = TONES[tone]

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex gap-2.5 rounded-lg border px-3.5 py-3 text-sm', wrap, className)}
    >
      {icon}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'break-words')}>{children}</div>}
      </div>
    </div>
  )
}

/** Renders the field-level `details` array of a backend validation error. */
export function FieldErrorList({
  details,
  className,
}: {
  details?: { field: string; message: string }[]
  className?: string
}) {
  if (!details || details.length === 0) return null

  return (
    <ul className={cn('mt-1.5 space-y-0.5 text-xs', className)}>
      {details.map((detail) => (
        <li key={detail.field}>
          <span className="font-medium">{detail.field}</span>
          <span className="text-red-700"> {detail.message}</span>
        </li>
      ))}
    </ul>
  )
}
