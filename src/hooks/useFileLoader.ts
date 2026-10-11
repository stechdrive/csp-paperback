import { useState, useCallback, useEffect, useRef } from 'react'
import type { LoadableFile } from '../platform/files'
import { loadProjectFiles } from '../utils/project-loader'

export interface UseFileLoaderResult {
  isLoading: boolean
  error: string | null
  notification: string | null
  loadFiles: (files: LoadableFile[]) => Promise<void>
  loadPsdFile: (file: LoadableFile) => Promise<void>
  loadXdtsFile: (file: LoadableFile) => Promise<void>
  clearError: () => void
}

export function useFileLoader(): UseFileLoaderResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notification, setNotification] = useState<string | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (!notification) return
    const timer = setTimeout(() => setNotification(null), 5000)
    return () => clearTimeout(timer)
  }, [notification])

  const loadFiles = useCallback((files: LoadableFile[]) => {
    const job = queue.current.then(async () => {
      if (files.length === 0) return

      setIsLoading(true)
      setError(null)
      setNotification(null)
      try {
        const message = await loadProjectFiles(files)
        setNotification(message)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'ファイルの読み込みに失敗しました')
      } finally {
        setIsLoading(false)
      }
    })
    queue.current = job
    return job
  }, [])

  const loadPsdFile = useCallback((file: LoadableFile) => loadFiles([file]), [loadFiles])
  const loadXdtsFile = useCallback((file: LoadableFile) => loadFiles([file]), [loadFiles])
  const clearError = useCallback(() => setError(null), [])

  return { isLoading, error, notification, loadFiles, loadPsdFile, loadXdtsFile, clearError }
}
