import { createContext, useContext, type ReactNode } from 'react'
import { ja, type Translations } from './ja'
import { en } from './en'

export type Locale = 'ja' | 'en'

const translations: Record<Locale, Translations> = { ja, en }

function detectLocale(): Locale {
  const lang = navigator.language ?? ''
  return lang.startsWith('ja') ? 'ja' : 'en'
}

interface LocaleContextValue {
  locale: Locale
  t: Translations
}

const defaultLocale = detectLocale()

const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  t: translations[defaultLocale],
})

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = detectLocale()

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale] }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}
