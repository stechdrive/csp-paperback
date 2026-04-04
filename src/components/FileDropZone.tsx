import { useState, useCallback, type ReactNode, type DragEvent } from 'react'
import { useLocale } from '../i18n'
import styles from './FileDropZone.module.css'

interface FileDropZoneProps {
  onPsdFile: (file: File) => Promise<void>
  onXdtsFile: (file: File) => Promise<void>
  children: ReactNode
}

export function FileDropZone({ onPsdFile, onXdtsFile, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)
  const { t } = useLocale()

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragCounter(c => c + 1)
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragCounter(c => {
      const next = c - 1
      if (next <= 0) setIsDragging(false)
      return next
    })
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setDragCounter(0)

    const files = Array.from(e.dataTransfer.files)
    const psdFiles = files.filter(f => f.name.toLowerCase().endsWith('.psd'))
    const xdtsFiles = files.filter(f => f.name.toLowerCase().endsWith('.xdts'))

    // xdts を先に読み込むことで PSD 解析時にアニメーションフォルダ検出が効く
    for (const file of xdtsFiles) await onXdtsFile(file)
    for (const file of psdFiles) await onPsdFile(file)
  }, [onPsdFile, onXdtsFile])

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
          <div className={styles.message}>{t.dropZone.message}</div>
        </div>
      )}
    </div>
  )
}
