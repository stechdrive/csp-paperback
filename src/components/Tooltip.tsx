import { cloneElement, useId, useState, useRef, useCallback, useLayoutEffect, useEffect, type RefObject, type HTMLAttributes, type Ref, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import styles from './Tooltip.module.css'

function attachRef(ref: Ref<HTMLElement> | undefined, node: HTMLElement | null) {
  if (typeof ref === 'function') {
    const cleanup = ref(node)
    return () => { if (typeof cleanup === 'function') cleanup(); else ref(null) }
  }
  if (ref) ref.current = node
  return () => { if (ref) ref.current = null }
}

interface TooltipProps {
  content: string | undefined
  children: ReactElement<HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }>
  /** 表示遅延 ms（デフォルト 300） */
  delay?: number
  /** ツールチップの配置（デフォルト top） */
  placement?: 'top' | 'bottom'
  /** 説明を重ねない領域（出力例など） */
  avoidRef?: RefObject<HTMLElement | null>
  /** true の間はツールチップを表示しない */
  disabled?: boolean
  /** 警告など、タッチでも説明を開閉するボタン */
  toggleOnClick?: boolean
}

export function Tooltip({ content, children, delay = 300, placement = 'top', avoidRef, disabled = false, toggleOnClick = false }: TooltipProps) {
  const id = useId()
  const [portal, setPortal] = useState<{ target: Element; hoverable: boolean } | null>(null)
  const timer = useRef<number>(0)
  const anchorRef = useRef<HTMLElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const pinned = useRef(false)
  const originalRef = children.props.ref
  const setAnchor = useCallback((node: HTMLElement | null) => {
    anchorRef.current = node
    const detach = attachRef(originalRef, node)
    return () => {
      anchorRef.current = null
      detach()
    }
  }, [originalRef])

  const show = useCallback((hoverable: boolean) => setPortal({ target: anchorRef.current?.closest('dialog[open]') ?? document.body, hoverable }), [])
  const handleEnter = useCallback((hoverable: boolean) => {
    if (disabled || !content) return
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => show(hoverable), delay)
  }, [delay, disabled, content, show])

  const close = useCallback(() => {
    clearTimeout(timer.current)
    pinned.current = false
    setPortal(null)
  }, [])
  const handleLeave = () => {
    clearTimeout(timer.current)
    if (!pinned.current) timer.current = window.setTimeout(close, 100)
  }

  useEffect(() => {
    if (!disabled) return
    close()
  }, [disabled, close])

  useEffect(() => () => clearTimeout(timer.current), [])

  const isTooltipVisible = !!portal && !disabled && !!content
  useDismissableLayer({ open: isTooltipVisible, content: tooltipRef, trigger: anchorRef, tooltip: true,
    closeOnScroll: true, closeOnResize: true, onDismiss: close })

  // Keep descriptions readable under the pointer without intercepting adjacent controls.
  // Pointer events pass through ordinary tips, so track their visible bounds directly.
  useEffect(() => {
    if (!isTooltipVisible || !portal?.hoverable || toggleOnClick) return
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.buttons) return
      const inside = [anchorRef.current, tooltipRef.current].some(element => {
        const rect = element?.getBoundingClientRect()
        return rect && event.clientX >= rect.left && event.clientX <= rect.right
          && event.clientY >= rect.top && event.clientY <= rect.bottom
      })
      clearTimeout(timer.current)
      if (!inside) timer.current = window.setTimeout(close, 100)
    }
    document.addEventListener('pointermove', move)
    return () => document.removeEventListener('pointermove', move)
  }, [isTooltipVisible, portal?.hoverable, toggleOnClick, close])

  // 実寸で配置する。画面端で反転するときも出力例を避ける。
  useLayoutEffect(() => {
    const tip = tooltipRef.current
    const anchor = anchorRef.current
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
    <>
      {/* cloneElement only forwards these ref/event callbacks; it does not call them during render. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {cloneElement(children, {
        ref: setAnchor,
        title: undefined,
        'aria-describedby': [children.props['aria-describedby'], isTooltipVisible ? id : undefined].filter(Boolean).join(' ') || undefined,
        onPointerEnter: event => { children.props.onPointerEnter?.(event); if (event.pointerType !== 'touch' && !event.buttons) handleEnter(true) },
        onPointerLeave: event => { children.props.onPointerLeave?.(event); handleLeave() },
        onFocus: event => { children.props.onFocus?.(event); if (toggleOnClick || event.target.matches(':focus-visible')) handleEnter(false) },
        onBlur: event => { children.props.onBlur?.(event); if (!tooltipRef.current?.contains(event.relatedTarget)) close() },
        onPointerDown: event => { if (!toggleOnClick) close(); children.props.onPointerDown?.(event) },
        onClick: event => {
          children.props.onClick?.(event)
          if (toggleOnClick && !disabled) {
            clearTimeout(timer.current)
            if (pinned.current) close()
            else { pinned.current = true; show(true) }
          }
        },
      })}
      {isTooltipVisible && portal && createPortal(
        <div
          id={id}
          ref={tooltipRef}
          role="tooltip"
          className={styles.tooltip}
          // Only explicitly opened descriptions capture input. Plain hover/focus
          // tips must never make a nearby layer button unclickable.
          style={{ visibility: 'hidden', pointerEvents: toggleOnClick && portal.hoverable ? 'auto' : 'none' }}
          onMouseEnter={() => clearTimeout(timer.current)} onMouseLeave={handleLeave}
        >
          {content}
        </div>,
        portal.target
      )}
    </>
  )
}
