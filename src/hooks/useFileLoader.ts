import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../store'

export interface UseFileLoaderResult {
  isLoading: boolean
  error: string | null
  notification: string | null
  loadFiles: (files: File[]) => Promise<void>
  loadPsdFile: (file: File) => Promise<void>
  loadXdtsFile: (file: File) => Promise<void>
  clearError: () => void
}

function ext(file: File): string {
  return file.name.toLowerCase().split('.').pop() ?? ''
}

export function useFileLoader(): UseFileLoaderResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const loadPsd = useAppStore(s => s.loadPsd)
  const loadXdts = useAppStore(s => s.loadXdts)
  const resetProject = useAppStore(s => s.resetProject)
  const importSettings = useAppStore(s => s.importSettings)

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 5000)
    return () => clearTimeout(timer)
  }, [notification])

  const loadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)
    setNotification(null)
    try {
      const jsonFiles = files.filter(f => ext(f) === 'json')
      const psdFile = files.filter(f => ext(f) === 'psd').at(-1)
      const xdtsFile = files.filter(f => ext(f) === 'xdts').at(-1)
      const hasProjectFile = Boolean(psdFile || xdtsFile)
      const state = useAppStore.getState()
      const shouldResetProject = hasProjectFile && (
        Boolean(psdFile && xdtsFile) ||
        Boolean(psdFile && state.rawPsd) ||
        Boolean(xdtsFile && state.xdtsData) ||
        Boolean((psdFile || xdtsFile) && state.rawPsd && state.xdtsData)
      )

      if (shouldResetProject) resetProject()

      for (const file of jsonFiles) {
        importSettings(await file.text())
        setNotification('工程設定を読み込みました')
      }

      // XDTS を先に保持してから PSD を解析する。PSD 側の XDTS 検出を一度で確定させるため。
      if (xdtsFile) loadXdts(await xdtsFile.text(), xdtsFile.name)
      if (psdFile) loadPsd(await psdFile.arrayBuffer(), psdFile.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [importSettings, loadPsd, loadXdts, resetProject])

  const loadPsdFile = useCallback((file: File) => loadFiles([file]), [loadFiles])
  const loadXdtsFile = useCallback((file: File) => loadFiles([file]), [loadFiles])
  const clearError = useCallback(() => setError(null), [])

  return { isLoading, error, notification, loadFiles, loadPsdFile, loadXdtsFile, clearError }
}
