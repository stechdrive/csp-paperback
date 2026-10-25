import { act, cleanup, renderHook } from '@testing-library/react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelPendingPointerDrag, getActiveDragPayload, useDragSource, useInternalDropTarget } from '../../hooks/useDragDrop'

vi.mock('../../platform/runtime', () => ({ isDesktopRuntime: () => true }))
beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null })
})
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.runAllTimers(); vi.useRealTimers(); vi.restoreAllMocks() })

function down(currentTarget: HTMLElement, target: HTMLElement = currentTarget): ReactPointerEvent {
  return { button: 0, pointerId: 1, clientX: 10, clientY: 10, currentTarget, target } as unknown as ReactPointerEvent
}
function pointer(type: string, x = 40) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 40 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  document.dispatchEvent(event)
}
function source() {
  const row = document.createElement('div'), button = document.createElement('button')
  row.append(button); document.body.append(row)
  const hook = renderHook(() => useDragSource({ type: 'layer', layerId: 'ink' }))
  return { row, button, ...hook }
}

describe('desktop pointer drag event isolation', () => {
  it('opening a context menu cancels a pending press before it can turn into a drop', () => {
    const { row, result } = source()
    const onDrop = vi.fn(), target = document.createElement('div')
    document.body.append(target)
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target })
    const drop = renderHook(() => useInternalDropTarget({ canDrop: () => true, onDrop }))
    act(() => {
      drop.result.current.dropRef(target)
      result.current.onPointerDown(down(row))
      cancelPendingPointerDrag()
      pointer('pointermove'); pointer('pointerup')
    })
    expect(onDrop).not.toHaveBeenCalled()
    expect(getActiveDragPayload()).toBeNull()
    expect(document.body).not.toHaveClass('is-csp-dragging')
  })
  it('does not start a row drag from an eye or another interactive descendant', () => {
    const { row, button, result } = source()
    act(() => { result.current.onPointerDown(down(row, button)); pointer('pointermove') })
    expect(getActiveDragPayload()).toBeNull()
    expect(document.body).not.toHaveClass('is-csp-dragging')
  })
  it.each(['pointercancel', 'blur', 'unmount', 'escape'])('cleans up a drag on %s', cause => {
    const { row, result, unmount } = source()
    act(() => { result.current.onPointerDown(down(row)); pointer('pointermove') })
    expect(getActiveDragPayload()).toEqual({ type: 'layer', layerId: 'ink' })
    act(() => {
      if (cause === 'unmount') unmount()
      else if (cause === 'blur') window.dispatchEvent(new Event('blur'))
      else if (cause === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      else pointer('pointercancel')
    })
    expect(getActiveDragPayload()).toBeNull()
    expect(document.body).not.toHaveClass('is-csp-dragging')
  })
  it('drops once, suppresses the resulting click, and leaves the next drag intact when an old source unmounts', () => {
    const a = source(), b = source(), onDrop = vi.fn()
    const target = document.createElement('div'); document.body.append(target)
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => target })
    const drop = renderHook(() => useInternalDropTarget({ canDrop: () => true, onDrop }))
    act(() => drop.result.current.dropRef(target))
    const click = vi.fn()
    target.addEventListener('click', click)
    act(() => { a.result.current.onPointerDown(down(a.row)); pointer('pointermove'); pointer('pointerup') })
    expect(onDrop).toHaveBeenCalledTimes(1)
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(click).not.toHaveBeenCalled()
    act(() => { b.result.current.onPointerDown(down(b.row)); pointer('pointermove'); a.unmount() })
    expect(getActiveDragPayload()).not.toBeNull()
    expect(document.body).toHaveClass('is-csp-dragging')
    act(() => pointer('pointercancel'))
  })
})
