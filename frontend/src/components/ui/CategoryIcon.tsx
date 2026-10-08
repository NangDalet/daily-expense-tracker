import {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  Trees,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Curated subset of lucide icon names a category can reference. The backend
 * stores the name as a free string (`CategoryRequest.iconName`), so unknown
 * names must degrade to a default rather than crash the render.
 */
const ICONS: Record<string, LucideIcon> = {
  Baby,
  Banknote,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Clapperboard,
  Coffee,
  CreditCard,
  Dumbbell,
  Ellipsis,
  Film,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Scissors,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tag,
  Ticket,
  Trees,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  Zap,
}

export const CATEGORY_ICON_NAMES = Object.keys(ICONS).sort()

export function CategoryIcon({
  name,
  className,
  fallback = Tag,
}: {
  name?: string
  className?: string
  fallback?: LucideIcon
}) {
  const Icon = (name && ICONS[name]) || fallback
  return <Icon className={cn('h-4 w-4', className)} aria-hidden />
}

/** Circular swatch showing a category's icon on its own colour. */
export function CategorySwatch({
  iconName,
  color,
  className,
  size = 'md',
}: {
  iconName?: string
  color: string
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <CategoryIcon name={iconName} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  )
}
