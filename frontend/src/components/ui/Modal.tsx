import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
} as const

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }: ModalProps) {
  useLanguage()
  const panelRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      // Keep Tab cycling inside the dialog while it owns the screen.
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null)
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !panelRef.current.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previouslyFocused = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    const viewport = window.visualViewport
    function syncViewport() {
      const container = viewportRef.current
      if (!container) return
      const mobile = window.matchMedia('(max-width: 639px)').matches
      container.style.setProperty('--modal-height', mobile ? `${viewport?.height ?? window.innerHeight}px` : '100dvh')
      container.style.setProperty('--modal-top', mobile ? `${viewport?.offsetTop ?? 0}px` : '0px')
    }
    syncViewport()
    viewport?.addEventListener('resize', syncViewport)
    viewport?.addEventListener('scroll', syncViewport)
    window.addEventListener('resize', syncViewport)

    // Focus the first control so keyboard users land inside the dialog.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (window.matchMedia('(max-width: 639px)').matches) {
        panel?.focus({ preventScroll: true })
      } else {
        (panel?.querySelector<HTMLElement>('form input, form select, form textarea') ??
          panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true })
      }
    }, 0)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      viewport?.removeEventListener('resize', syncViewport)
      viewport?.removeEventListener('scroll', syncViewport)
      window.removeEventListener('resize', syncViewport)
      document.body.style.overflow = overflow
      window.clearTimeout(focusTimer)
      previouslyFocused?.focus?.({ preventScroll: true })
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div ref={viewportRef} className="app-modal-viewport fixed left-0 z-50 flex w-full items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4">
      <div
        className="glass-overlay fixed inset-0 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        data-size={size}
        className={cn(
          'app-modal-panel glass-dialog relative z-10 flex min-w-0 w-full flex-col outline-none sm:rounded-3xl',
          SIZES[size],
        )}
      >
        <div className="glass-divider flex shrink-0 items-start justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <div className="ml-auto hidden sm:block"><LanguageSwitcher /></div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close dialog")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 sm:-mt-1 sm:-mr-1 sm:h-8 sm:w-8"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="app-modal-body min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>

        {footer && (
          <div className="glass-footer glass-divider flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
