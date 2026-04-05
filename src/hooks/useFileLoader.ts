import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useCspb } from './useCspb'

export interface UseFileLoaderResult {
  isLoading: boolean
  error: string | null
  notification: string | null
  loadPsdFile: (file: File) => Promise<void>
  loadXdtsFile: (file: File) => Promise<void>
  loadCspbFile: (file: File) => Promise<void>
  saveCspb: () => void
  clearError: () => void
}

export function useFileLoader(): UseFileLoaderResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadPsd = useAppStore(s => s.loadPsd)
  const loadXdts = useAppStore(s => s.loadXdts)
  const cspb = useCspb()
  const { loadCspbFile: loadCspb, notification } = cspb

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

  const loadCspbFile = useCallback(async (file: File) => {
    setError(null)
    try {
      await loadCspb(file)
    } catch (e) {
      setError(e instanceof Error ? e.message : '設定ファイルの読み込みに失敗しました')
    }
  }, [loadCspb])

  const clearError = useCallback(() => setError(null), [])

  return { isLoading, error, notification, loadPsdFile, loadXdtsFile, loadCspbFile, saveCspb: cspb.saveCspb, clearError }
}
