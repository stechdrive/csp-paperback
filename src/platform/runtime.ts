import { isTauri } from '@tauri-apps/api/core'

export function isDesktopRuntime(): boolean {
  try {
    return isTauri()
  } catch {
    return false
  }
}

export function createAbortError(message = 'ユーザ操作によりキャンセルされました'): DOMException {
  return new DOMException(message, 'AbortError')
}
