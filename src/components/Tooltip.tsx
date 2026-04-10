import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

interface TooltipProps {
  content: string
  children: React.ReactElement
  /** 表示遅延 ms（デフォルト 300） */
  delay?: number
  /** ツールチップの配置（デフォルト top） */
  placement?: 'top' | 'bottom'
}

export function Tooltip({ content, children, delay = 300, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom'>(placement)
  const timer = useRef<number>(0)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleEnter = useCallback(() => {
    // display:contents な span は自身の box を持たないため firstElementChild から rect を取る
    const child = wrapRef.current?.firstElementChild ?? wrapRef.current
    const r = child?.getBoundingClientRect()
    if (r) {
      setRect(r)
      const TOOLTIP_HEIGHT = 80
      const fitsTop = r.top > TOOLTIP_HEIGHT
      setResolvedPlacement(placement === 'bottom' || !fitsTop ? 'bottom' : 'top')
    }
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }, [delay, placement])

  const handleLeave = useCallback(() => {
    clearTimeout(timer.current)
    setVisible(false)
  }, [])

  // ツールチップ描画後に実際の幅を測ってX位置を確定する
  useLayoutEffect(() => {
    if (!visible || !rect || !tooltipRef.current) return
    const MARGIN = 8
    const vw = window.innerWidth
    const tip = tooltipRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    // transform: translateX(-50%) 適用後の left/right を再現して確認
    const tipLeft = centerX - tip.width / 2
    const tipRight = centerX + tip.width / 2
    let adjusted = centerX
    if (tipRight > vw - MARGIN) adjusted = vw - MARGIN - tip.width / 2
    if (tipLeft < MARGIN) adjusted = MARGIN + tip.width / 2
    tooltipRef.current.style.left = `${adjusted}px`
    tooltipRef.current.style.visibility = 'visible'
  }, [visible, rect])

  const baseLeft = rect ? rect.left + rect.width / 2 : 0
  const tooltipStyle = rect ? {
    left: baseLeft,
    top: resolvedPlacement === 'top' ? rect.top : rect.bottom,
    // 測定前は非表示（位置ズレしてちらつかないように）
    visibility: 'hidden' as const,
  } : {}

  return (
    <span ref={wrapRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={{ display: 'contents' }}>
      {children}
      {visible && rect && createPortal(
        <div
          ref={tooltipRef}
          className={`${styles.tooltip} ${resolvedPlacement === 'bottom' ? styles.bottom : styles.top}`}
          style={tooltipStyle}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  )
}
