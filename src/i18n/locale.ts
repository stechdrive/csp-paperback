import { createContext, useContext } from 'react'
import { ja, type Translations } from './ja'

export type Locale = 'ja'

export const translations: Record<Locale, Translations> = { ja }

export function detectLocale(): Locale {
  return 'ja'
}

export interface LocaleContextValue {
  locale: Locale
  t: Translations
}

const defaultLocale = detectLocale()

export const LocaleContext = createContext<LocaleContextValue>({
  locale: defaultLocale,
  t: translations[defaultLocale],
})

export function useLocale() {
  return useContext(LocaleContext)
}
