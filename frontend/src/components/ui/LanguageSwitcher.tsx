import { useLanguage } from '@/context/LanguageContext'
import type { Language } from '@/lib/language'

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <select
      aria-label={t('Language')}
      title={t('Language')}
      value={language}
      onChange={event => setLanguage(event.target.value as Language)}
      className="max-w-32 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700"
    >
      <option value="en" lang="en">English</option>
      <option value="km" lang="km">ភាសាខ្មែរ</option>
    </select>
  )
}
