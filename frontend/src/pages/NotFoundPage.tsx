import { t } from '@/lib/language'
import { useLanguage } from '@/context/LanguageContext'
import { Link } from 'react-router-dom'
import { Compass, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export default function NotFoundPage() {
  useLanguage()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
        <Wallet className="h-7 w-7" aria-hidden />
      </span>

      <div className="mt-5"><LanguageSwitcher /></div>
      <p className="mt-6 text-sm font-semibold tracking-wide text-brand-600 uppercase">404</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t("Page not found")}</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        {t("That route does not exist. It may have been moved or the link is out of date.")}</p>

      <div className="mt-6 flex items-center gap-2">
        <Link to="/">
          <Button>
            <Compass className="h-4 w-4" aria-hidden />
            {t("Back to dashboard")}</Button>
        </Link>
        <Link to="/expenses">
          <Button variant="outline">{t("View expenses")}</Button>
        </Link>
      </div>
    </div>
  )
}
