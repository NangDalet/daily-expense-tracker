import { khmer } from './khmer'
import { constructionKhmer } from './constructionLanguage'

export type Language = 'en' | 'km'
export const LANGUAGE_STORAGE_KEY = 'expense-tracker.language'
const translations = { ...constructionKhmer, ...khmer }

export function readLanguage(): Language {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved !== null) return saved === 'km' ? 'km' : 'en'
    return localStorage.getItem('construction.language') === 'km' ? 'km' : 'en'
  } catch { return 'en' }
}

let currentLanguage = readLanguage()
export const getLanguage = () => currentLanguage
export const getLocale = () => currentLanguage === 'km' ? 'km-KH' : 'en-US'
export function updateLanguage(language: Language) {
  currentLanguage = language
  document.documentElement.lang = language
  document.documentElement.dir = 'ltr'
  try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language) } catch { /* Still usable without browser storage. */ }
}

/** Translate only application-owned strings; unknown server messages retain their original text. */
export function t(text: string, values: (string | number | undefined | null)[] = []): string {
  const translated = currentLanguage === 'km' && Object.hasOwn(translations, text) ? translations[text] : text
  return translated.replace(/\{(\d+)\}/g, (placeholder, index) => Number(index) < values.length ? String(values[Number(index)] ?? '') : placeholder)
}
