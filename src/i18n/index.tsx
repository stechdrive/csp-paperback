import { createContext, useContext, useState, type ReactNode } from 'react'
import { ja, type Translations } from './ja'
import { en } from './en'

export type Locale = 'ja' | 'en'

const STORAGE_KEY = 'cspb-locale'
const translations: Record<Locale, Translations> = { ja, en }

interface LocaleContextValue {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'ja',
  t: ja,
  setLocale: () => {},
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'en' ? 'en' : 'ja'
  })

  const setLocale = (l: Locale) => {
    localStorage.setItem(STORAGE_KEY, l)
    setLocaleState(l)
  }

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
