import { useState, useRef, useCallback, useLayoutEffect, useEffect, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import styles from './Tooltip.module.css'

interface TooltipProps {
  content: string
  children: React.ReactElement
  /** 表示遅延 ms（デフォルト 300） */
  delay?: number
  /** ツールチップの配置（デフォルト top） */
  placement?: 'top' | 'bottom'
  /** 説明を重ねない領域（出力例など） */
  avoidRef?: RefObject<HTMLElement | null>
  /** true の間はツールチップを表示しない */
  disabled?: boolean
}

export function Tooltip({ content, children, delay = 300, placement = 'top', avoidRef, disabled = false }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number>(0)
  const wrapRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleEnter = useCallback(() => {
    if (disabled) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }, [delay, disabled])

  const handleLeave = useCallback(() => {
    clearTimeout(timer.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!disabled) return
    clearTimeout(timer.current)
  }, [disabled])

  useEffect(() => () => clearTimeout(timer.current), [])

  const isTooltipVisible = visible && !disabled

  // 実寸で配置する。画面端で反転するときも出力例を避ける。
  useLayoutEffect(() => {
    const tip = tooltipRef.current
    // display:contents のラッパー自身は box を持たない。
    const anchor = wrapRef.current?.firstElementChild
    if (!isTooltipVisible || !tip || !anchor) return
    const MARGIN = 8
    const position = () => {
      const rect = anchor.getBoundingClientRect()
      const { width, height } = tip.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const left = Math.max(MARGIN, Math.min(centerX - width / 2, window.innerWidth - width - MARGIN))
      const avoid = avoidRef?.current?.getBoundingClientRect()
      const above = rect.top - height - MARGIN
      const below = rect.bottom + MARGIN
      const candidates = placement === 'top' ? [above, below] : [below, above]
      if (avoid) candidates.push(avoid.top - height - MARGIN, avoid.bottom + MARGIN)
      const clearsExample = (top: number) => !avoid
        || left >= avoid.right + MARGIN || left + width <= avoid.left - MARGIN
        || top + height <= avoid.top - MARGIN || top >= avoid.bottom + MARGIN
      const fitsScreen = (top: number) => top >= MARGIN && top + height <= window.innerHeight - MARGIN
      const top = candidates.find(top => fitsScreen(top) && clearsExample(top))
        ?? (avoid ? candidates.find(clearsExample) : undefined)
        ?? Math.max(MARGIN, Math.min(candidates[0], window.innerHeight - height - MARGIN))
      tip.dataset.placement = top < rect.top ? 'top' : 'bottom'
      tip.style.left = `${left}px`
      tip.style.top = `${top}px`
      tip.style.setProperty('--tooltip-arrow-left', `${Math.max(8, Math.min(centerX - left, width - 8))}px`)
      tip.style.visibility = 'visible'
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', position, true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(position)
    observer?.observe(tip)
    observer?.observe(anchor)
    if (avoidRef?.current) observer?.observe(avoidRef.current)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', position, true)
      observer?.disconnect()
    }
  }, [isTooltipVisible, placement, avoidRef, content])

  return (
    <span ref={wrapRef} onMouseEnter={handleEnter} onMouseLeave={handleLeave} style={{ display: 'contents' }}>
      {children}
      {isTooltipVisible && createPortal(
        <div
          ref={tooltipRef}
          role="tooltip"
          className={styles.tooltip}
          style={{ visibility: 'hidden' }}
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  )
}
