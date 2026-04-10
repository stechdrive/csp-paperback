import type { ReactNode } from 'react'
import { detectLocale, LocaleContext, translations } from './locale'

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = detectLocale()

  return (
    <LocaleContext.Provider value={{ locale, t: translations[locale] }}>
      {children}
    </LocaleContext.Provider>
  )
}
