import { useEffect, useRef, useState } from 'react'
import type { OutputPreviewEntry } from '../hooks/useOutputPreview'
import { useAppStore } from '../store'
import { previewGrid } from '../utils/preview-grid'
import { OutputPreviewImage } from './OutputPreviewImage'
import { Tooltip } from './Tooltip'
import styles from './OutputPreview.module.css'

export function TiledOutputPreview({ entries, transparent }: { entries: OutputPreviewEntry[]; transparent: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(1)
  const selectedCount = useAppStore(s => Math.min(8, s.selectedOutputIds.size))
  const aspect = useAppStore(s => s.docWidth / Math.max(1, s.docHeight))
  const structure = useAppStore(s => s.outputConfig.structure)
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const observer = new ResizeObserver(() => {
      // A hidden pane must not overwrite the last useful layout.
      if (element.clientWidth && element.clientHeight) setSize({ width: element.clientWidth, height: element.clientHeight })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = viewport.current
    if (!element) return
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return
      event.preventDefault()
      setZoom(value => Math.max(.2, Math.min(8, value * (event.deltaY < 0 ? 1.15 : 1 / 1.15))))
    }
    let distance = 0
    const pinch = (event: TouchEvent) => {
      if (event.touches.length !== 2) { distance = 0; return }
      event.preventDefault()
      const [a, b] = event.touches
      const next = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      const factor = distance > 0 ? next / distance : 1
      setZoom(value => Math.max(.2, Math.min(8, value * factor)))
      distance = next
    }
    element.addEventListener('wheel', wheel, { passive: false })
    element.addEventListener('touchstart', pinch, { passive: false })
    element.addEventListener('touchmove', pinch, { passive: false })
    element.addEventListener('touchend', pinch)
    element.addEventListener('touchcancel', pinch)
    return () => {
      element.removeEventListener('wheel', wheel)
      element.removeEventListener('touchstart', pinch)
      element.removeEventListener('touchmove', pinch)
      element.removeEventListener('touchend', pinch)
      element.removeEventListener('touchcancel', pinch)
    }
  }, [])
  const layout = previewGrid(size.width, size.height, selectedCount, aspect, zoom)
  return <div className={styles.gallery} data-testid="tiled-preview">
    <div className={styles.galleryToolbar}>
      <span>並べて表示 · {selectedCount}件</span>
      <Tooltip content="ホイール・ピンチで画像の大きさと列数を変更"><span data-tooltip="ホイール・ピンチで画像の大きさと列数を変更">{Math.round(zoom * 100)}%</span></Tooltip>
      <button type="button" aria-label="並べた画像を画面に収める" onClick={() => { setZoom(1); viewport.current?.scrollTo({ left: 0, top: 0 }) }}>画面に収める</button>
    </div>
    <div ref={viewport} className={styles.galleryViewport} tabIndex={0} aria-label="並べて表示した画像" data-testid="tiled-viewport">
      <div className={styles.galleryGrid} data-columns={layout.columns} style={{ gridTemplateColumns: `repeat(${layout.columns}, ${layout.tileWidth}px)`, gap: layout.gap }}>
        {entries.map(entry => <figure key={entry.outputId ?? entry.path} className={styles.galleryItem}>
          <OutputPreviewImage entry={entry} transparent={transparent} />
          <Tooltip content={structure === 'hierarchy' ? entry.path : entry.flatName}><figcaption>{structure === 'hierarchy' ? entry.path : entry.flatName}</figcaption></Tooltip>
        </figure>)}
      </div>
    </div>
  </div>
}
