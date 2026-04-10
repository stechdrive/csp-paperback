import { useState, useCallback, type ReactNode, type DragEvent } from 'react'
import { useLocale } from '../i18n'
import styles from './FileDropZone.module.css'

interface FileDropZoneProps {
  onFiles: (files: File[]) => Promise<void>
  children: ReactNode
}

export function FileDropZone({ onFiles, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)
  const { t } = useLocale()

  const isFileDrag = (e: DragEvent) => e.dataTransfer.types.includes('Files')

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragCounter(c => c + 1)
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setDragCounter(c => {
      const next = c - 1
      if (next <= 0) setIsDragging(false)
      return next
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    if (!isFileDrag(e)) return
    e.preventDefault()
    setIsDragging(false)
    setDragCounter(0)

    await onFiles(Array.from(e.dataTransfer.files))
  }, [onFiles])

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
