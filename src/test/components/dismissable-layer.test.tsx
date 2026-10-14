import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useDismissableLayer } from '../../hooks/useDismissableLayer'
import { Tooltip } from '../../components/Tooltip'

afterEach(() => { cleanup(); vi.useRealTimers() })

function Example({ outsideClick = () => {} }: { outsideClick?: () => void }) {
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null), content = useRef<HTMLDivElement>(null)
  useDismissableLayer({ open, content, trigger, onDismiss: () => setOpen(false) })
  return <>
    <button ref={trigger} onClick={() => setOpen(!open)}>開閉</button>
    <button onPointerDown={e => e.stopPropagation()} onClick={outsideClick}>外側の操作</button>
    {open && createPortal(<div ref={content} role="menu">
      <Tooltip content="子の説明" toggleOnClick><button>警告</button></Tooltip>
    </div>, document.body)}
  </>
}

it('再クリックで閉じ、伝播を止める外側の操作でも閉じてクリック自体は実行する', () => {
  const action = vi.fn()
  render(<Example outsideClick={action} />)
  const trigger = screen.getByText('開閉')
  fireEvent.click(trigger)
  fireEvent.pointerDown(trigger); fireEvent.click(trigger)
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  fireEvent.click(trigger)
  const outside = screen.getByText('外側の操作')
  fireEvent.pointerDown(outside); fireEvent.click(outside)
  expect(action).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

it('子のポータルは親の内側として扱い、Escは最前面だけを閉じる', () => {
  render(<Example />)
  fireEvent.click(screen.getByText('開閉'))
  fireEvent.click(screen.getByText('警告'))
  fireEvent.pointerDown(screen.getByRole('tooltip'))
  expect(screen.getByRole('menu')).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(screen.getByRole('menu')).toBeInTheDocument()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

it('ツールチップは既存のrefとイベントを保ち、標準titleと二重表示しない', () => {
  vi.useFakeTimers()
  const ref = vi.fn(), down = vi.fn()
  const rendered = render(<Tooltip content="説明"><button ref={ref} title="旧説明" onPointerDown={down}>操作</button></Tooltip>)
  const button = screen.getByRole('button')
  expect(ref).toHaveBeenCalledWith(button)
  expect(button).not.toHaveAttribute('title')
  fireEvent.pointerEnter(button, { pointerType: 'mouse' })
  act(() => vi.advanceTimersByTime(300))
  expect(button).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)
  fireEvent.pointerDown(button)
  expect(down).toHaveBeenCalledOnce()
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  rendered.unmount()
  expect(ref).toHaveBeenLastCalledWith(null)
})
