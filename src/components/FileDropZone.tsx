import { useState, useCallback, useEffect, type ReactNode, type DragEvent } from 'react'
import { useLocale } from '../i18n/locale'
import { loadableFilesFromPaths, type LoadableFile } from '../platform/files'
import { isDesktopRuntime } from '../platform/runtime'
import styles from './FileDropZone.module.css'

interface FileDropZoneProps {
  onFiles: (files: LoadableFile[]) => Promise<void>
  children: ReactNode
}

export function FileDropZone({ onFiles, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)
  const { t } = useLocale()
  const isDesktop = isDesktopRuntime()

  useEffect(() => {
    if (!isDesktopRuntime()) return

    let unlisten: (() => void) | undefined
    let disposed = false

    void (async () => {
      const { getCurrentWebview } = await import('@tauri-apps/api/webview')
      unlisten = await getCurrentWebview().onDragDropEvent(event => {
        const payload = event.payload
        if (payload.type === 'enter' || payload.type === 'over') {
          setDragCounter(1)
          setIsDragging(true)
          return
        }
        if (payload.type === 'leave') {
          setDragCounter(0)
          setIsDragging(false)
          return
        }

        setDragCounter(0)
        setIsDragging(false)
        void loadableFilesFromPaths(payload.paths)
          .then(files => {
            if (files.length > 0) return onFiles(files)
          })
          .catch(error => {
            console.error('Failed to load dropped desktop files', error)
          })
      })

      if (disposed) {
        unlisten()
      }
    })().catch(error => {
      console.error('Failed to register desktop file drop handler', error)
    })

    return () => {
      disposed = true
      unlisten?.()
    }
  }, [onFiles])

  const isFileDrag = useCallback((e: DragEvent) => {
    return !isDesktop && e.dataTransfer.types.includes('Files')
  }, [isDesktop])

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragCounter(c => c + 1)
    setIsDragging(true)
  }, [isFileDrag])

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragCounter(c => {
      const next = c - 1
      if (next <= 0) setIsDragging(false)
      return next
    })
  }, [isFileDrag])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
  }, [isFileDrag])

  const handleDrop = useCallback(async (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setIsDragging(false)
    setDragCounter(0)

    await onFiles(Array.from(e.dataTransfer.files))
  }, [isFileDrag, onFiles])

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ height: '100%' }}
    >
      {children}
      {isDragging && (
        <div className={styles.overlay}>
          <div className={styles.message}>
            {t.dropZone.message}
            <div className={styles.subMessage}>{t.dropZone.subMessage}</div>
          </div>
        </div>
      )}
    </div>
  )
}
