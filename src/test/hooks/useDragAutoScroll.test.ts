import { act, cleanup, renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDragAutoScroll, useDragSource } from '../../hooks/useDragDrop'

describe('useDragAutoScroll', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    document.body.classList.remove('is-csp-dragging')
  })

  it('ポインターが領域を離れた時に予約済みの自動スクロールを止める', () => {
    const container = document.createElement('div')
    Object.defineProperties(container, {
      scrollTop: { configurable: true, value: 0, writable: true },
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 300 },
    })
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })

    const requestAnimationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockReturnValue(23)
    const cancelAnimationFrame = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined)
    const scrollRef = { current: container } as RefObject<HTMLDivElement>

    const { result } = renderHook(() => ({
      autoScroll: useDragAutoScroll(scrollRef),
      dragSource: useDragSource({ type: 'virtualSet', virtualSetId: 'set-1' }),
    }))

    act(() => {
      result.current.dragSource.onDragStart({
        dataTransfer: {
          effectAllowed: 'none',
          setData: vi.fn(),
        },
      } as unknown as React.DragEvent)
      result.current.autoScroll.onPointerMoveCapture({
        clientX: 50,
        clientY: 95,
      } as React.PointerEvent<HTMLElement>)
    })

    expect(requestAnimationFrame).toHaveBeenCalledOnce()
    expect(result.current.autoScroll).toHaveProperty('onPointerLeave')
    expect(result.current.autoScroll).not.toHaveProperty('onPointerLeaveCapture')

    act(() => result.current.autoScroll.onPointerLeave())
    expect(cancelAnimationFrame).toHaveBeenCalledWith(23)

    act(() => result.current.dragSource.onDragEnd({} as React.DragEvent))
  })
})
