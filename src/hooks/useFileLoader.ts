import { useState, useCallback } from 'react'
import { useAppStore } from '../store'

export interface UseFileLoaderResult {
  isLoading: boolean
  error: string | null
  loadPsdFile: (file: File) => Promise<void>
  loadXdtsFile: (file: File) => Promise<void>
  clearError: () => void
}

export function useFileLoader(): UseFileLoaderResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadPsd = useAppStore(s => s.loadPsd)
  const loadXdts = useAppStore(s => s.loadXdts)

  const loadPsdFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const buffer = await file.arrayBuffer()
      loadPsd(buffer, file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PSDの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [loadPsd])

  const loadXdtsFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)
    try {
      const text = await file.text()
      loadXdts(text, file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'xdtsの読み込みに失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [loadXdts])

  const clearError = useCallback(() => setError(null), [])

  return { isLoading, error, loadPsdFile, loadXdtsFile, clearError }
}
