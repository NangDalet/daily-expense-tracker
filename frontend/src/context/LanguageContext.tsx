import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getLanguage, LANGUAGE_STORAGE_KEY, t, updateLanguage, type Language } from '@/lib/language'

const LanguageContext = createContext({ language: getLanguage(), setLanguage: (_language: Language) => {}, t })

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setValue] = useState(getLanguage)
  function setLanguage(value: Language) {
    updateLanguage(value)
    setValue(value)
  }
  useEffect(() => {
    updateLanguage(language)
    function onStorage(event: StorageEvent) {
      if (event.key === LANGUAGE_STORAGE_KEY) setLanguage(event.newValue === 'km' ? 'km' : 'en')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [language])
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export const useLanguage = () => useContext(LanguageContext)
