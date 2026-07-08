import { isDesktopRuntime } from './runtime'

export const DESKTOP_RELEASES_URL = 'https://github.com/stechdrive/csp-paperback/releases'

export async function openDesktopReleasesPage(): Promise<void> {
  if (isDesktopRuntime()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(DESKTOP_RELEASES_URL)
    return
  }

  window.open(DESKTOP_RELEASES_URL, '_blank', 'noopener,noreferrer')
}
