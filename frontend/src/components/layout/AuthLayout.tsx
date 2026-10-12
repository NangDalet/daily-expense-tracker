import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import type { ReactNode } from 'react'
import { ArrowUpRight, ChartNoAxesColumnIncreasing, Wallet, Moon, Sun, Target } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

/** Shared responsive presentation for sign-in and registration. */
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
  useLanguage()
  const { theme, toggleTheme } = useTheme()
  return (
    <div className="auth-shell min-h-dvh p-4 sm:p-6 lg:grid lg:grid-cols-2 lg:gap-6">
      <aside className="auth-hero relative hidden flex-col justify-between overflow-hidden rounded-[2rem] p-10 text-white lg:flex xl:p-14" aria-hidden="true">
        <div className="relative z-10 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><Wallet className="h-5 w-5" /></span>
          <span className="text-lg font-semibold">{t('Expense Tracker')}</span>
        </div>
        <div className="relative z-10 mx-auto w-full max-w-lg py-12">
          <p className="mb-5 text-xs font-medium uppercase tracking-[0.18em] text-indigo-200">{t('Make every day add up')}</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">{t('A clearer view of your money.')}</h2>
          <p className="mt-5 max-w-sm text-sm leading-7 text-indigo-100/75">{t('Track expenses, plan budgets, and see your month in USD or KHR.')}</p>
          <div className="auth-preview mt-10 rounded-3xl border border-white/15 p-6">
            <div className="flex items-center justify-between text-xs text-indigo-100/75"><span>{t('Example overview')}</span><ArrowUpRight className="h-4 w-4" /></div>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-3xl font-semibold tracking-tight">$120.00</p><p className="mt-1 text-xs text-indigo-100/65">480,000 KHR</p></div>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-medium">USD + KHR</span>
            </div>
            <div className="mt-7 flex h-20 items-end gap-2">
              {[38, 62, 46, 78, 55, 92, 70].map((height, index) => <div key={index} className="flex-1 rounded-t-lg bg-indigo-300/40 last:bg-emerald-300" style={{ height: `${height}%` }} />)}
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 text-xs text-indigo-100/65">{t('One total. Two currencies.')}</p>
          </div>
        </div>
        <div className="relative z-10 flex flex-wrap gap-x-6 gap-y-3 text-xs text-indigo-100/75">
          <span className="flex items-center gap-2"><ChartNoAxesColumnIncreasing className="h-4 w-4" />{t('Monthly insights')}</span>
          <span className="flex items-center gap-2"><Target className="h-4 w-4" />{t('Simple budgeting')}</span>
        </div>
      </aside>
      <main className="flex min-h-[calc(100dvh-2rem)] flex-col sm:min-h-[calc(100dvh-3rem)]">
        <div className="mb-8 flex items-center justify-end gap-3">
          <LanguageSwitcher />
          <button type="button" onClick={toggleTheme} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-brand-50"
            aria-label={theme === 'light' ? t('Switch to dark mode') : t('Switch to light mode')}>
            {theme === 'light' ? <Moon className="h-4 w-4" aria-hidden /> : <Sun className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center pb-8 lg:px-6">
          <div className="card auth-card mx-auto w-full max-w-md p-7 sm:p-10">
            <div className="mb-8 flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Wallet className="h-5 w-5" aria-hidden />
              </span>
              <div><p className="text-sm font-semibold text-slate-900">{t('Expense Tracker')}</p><p className="mt-0.5 text-xs text-slate-500">{t('Your daily money companion')}</p></div>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-7 border-t border-slate-200 pt-6 text-center text-sm leading-relaxed text-slate-500">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}
