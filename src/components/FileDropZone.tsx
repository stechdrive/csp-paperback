import { useState, useCallback, type ReactNode, type DragEvent } from 'react'
import styles from './FileDropZone.module.css'

interface FileDropZoneProps {
  onPsdFile: (file: File) => void
  onXdtsFile: (file: File) => void
  children: ReactNode
}

export function FileDropZone({ onPsdFile, onXdtsFile, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [, setDragCounter] = useState(0)

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

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    setDragCounter(0)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      if (file.name.toLowerCase().endsWith('.psd')) {
        onPsdFile(file)
      } else if (file.name.toLowerCase().endsWith('.xdts')) {
        onXdtsFile(file)
      }
    }
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
          <div className={styles.message}>PSD / xdts をドロップ</div>
        </div>
      )}
    </div>
  )
}
