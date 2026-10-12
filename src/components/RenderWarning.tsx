import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import styles from './RenderWarning.module.css'

export function RenderWarning({ vector = false, unavailable = false, unsupported3D = false }: { vector?: boolean; unavailable?: boolean; unsupported3D?: boolean }) {
  const [open, setOpen] = useState(false)
  const id = useId(), button = useRef<HTMLButtonElement>(null), tip = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!open) return
    const position = () => {
      if (!button.current || !tip.current) return
      const b = button.current.getBoundingClientRect(), t = tip.current.getBoundingClientRect()
      const left = Math.max(8, Math.min(b.left, window.innerWidth - t.width - 8))
      const top = b.bottom + 8 + t.height <= window.innerHeight - 8 ? b.bottom + 8 : Math.max(8, b.top - t.height - 8)
      Object.assign(tip.current.style, { left: `${left}px`, top: `${top}px`, visibility: 'visible' })
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true) }
  }, [open])
  useEffect(() => {
    if (!open) return
    const outside = (e: Event) => {
      if (e.target instanceof Node && !button.current?.contains(e.target) && !tip.current?.contains(e.target)) setOpen(false)
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('focusin', outside)
    document.addEventListener('keydown', escape, true)
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); document.removeEventListener('keydown', escape, true) }
  }, [open])
  return <>
    <button ref={button} type="button" className={styles.button} aria-label={vector ? 'ベクター描画の制限' : '3D描画の制限'}
      aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => { if (document.activeElement !== button.current) setOpen(false) }}
      onPointerDown={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); setOpen(true) }}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 3 22 21H2Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M12 9v5m0 3v1" stroke="currentColor" strokeWidth="2"/></svg>
    </button>
    {open && createPortal(<div id={id} ref={tip} role="tooltip" className={styles.tip} style={{ visibility: 'hidden' }}>
      {vector && <>{unavailable ? '描画できないベクターレイヤーがあります。' : 'ベクターレイヤーを近似描画しています。'}<br />
        線幅・濃さ・ブラシ形状などに差や欠落が生じる場合があります。<br /></>}
      {unsupported3D && <>描画できない3Dレイヤーがあり、出力に含まれません。<br /></>}
      クリスタと同じ出力が必要な場合は、同じ保存状態からクリスタで書き出したPSDを追加してください。
    </div>, document.body)}
  </>
}
