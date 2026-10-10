import { cn } from '@/lib/utils'

const SIZES = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-9 w-9 text-sm',
  lg: 'h-12 w-12 text-base',
} as const

const PALETTE = [
  'bg-brand-100 text-brand-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
]

/** Initials avatar with a colour picked deterministically from the name. */
export function Avatar({
  name,
  size = 'md',
  className,
  src,
}: {
  name?: string
  size?: keyof typeof SIZES
  className?: string
  src?: string | null
}) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  let hash = 0
  for (let i = 0; i < (name ?? '').length; i += 1) {
    hash = (hash * 31 + name!.charCodeAt(i)) >>> 0
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold select-none',
        SIZES[size],
        PALETTE[hash % PALETTE.length],
        className,
      )}
    >
      {src ? <img src={src} alt="" className="h-full w-full rounded-full object-cover" /> : initials || '?'}
    </span>
  )
}
