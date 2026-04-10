import { createContext, useContext } from 'react'
import { en } from './en'
import { ja, type Translations } from './ja'

export type Locale = 'ja' | 'en'

export const translations: Record<Locale, Translations> = { ja, en }

export function detectLocale(): Locale {
  const lang = typeof navigator !== 'undefined' ? navigator.language ?? '' : ''
  return lang.startsWith('ja') ? 'ja' : 'en'
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
