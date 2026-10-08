import type { ReactNode } from 'react'
import { Wallet } from 'lucide-react'

/** Shared split-screen shell for the sign-in and sign-up screens. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col justify-center px-6 py-12 sm:px-12 lg:w-[46%] lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-base font-semibold text-slate-900">Expense Tracker</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-6 text-sm text-slate-500">{footer}</div>}
        </div>
      </div>

      <div
        className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:w-[54%] lg:items-center lg:justify-center"
        aria-hidden
      >
        <div className="absolute -top-24 -right-16 h-96 w-96 rounded-full bg-brand-600/25 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative max-w-md px-12">
          <blockquote className="text-2xl leading-relaxed font-medium text-white">
            Track every dollar, keep every category honest, and never wonder where the month went.
          </blockquote>
          <p className="mt-6 text-sm text-slate-400">
            Budgets, categories, trends and receipts in one place.
          </p>
        </div>
      </div>
    </div>
  )
}
