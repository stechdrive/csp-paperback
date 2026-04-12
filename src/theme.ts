export const APP_THEMES = ['midnight', 'graphite', 'paper'] as const

export type AppTheme = (typeof APP_THEMES)[number]

export const DEFAULT_APP_THEME: AppTheme = 'midnight'

export const APP_THEME_SWATCHES: Record<AppTheme, readonly [string, string, string, string]> = {
  midnight: ['#11111b', '#1e1e2e', '#6366f1', '#89b4fa'],
  graphite: ['#101419', '#192028', '#4d8dff', '#5fd0d6'],
  paper: ['#eef3f8', '#ffffff', '#2563eb', '#0f766e'],
}

export function isAppTheme(value: unknown): value is AppTheme {
  return typeof value === 'string' && APP_THEMES.includes(value as AppTheme)
}
