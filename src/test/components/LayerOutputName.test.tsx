import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LayerTreePanel } from '../../components/LayerTreePanel'
import { useAppStore } from '../../store'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

const state = () => useAppStore.getState()
function load() {
  state().loadParsedPsd(makePsd({ children: [makeFolder('_BG', [makeLayer({ name: 'body' })])] }), 'test.psd')
  render(<LayerTreePanel />)
  const layer = state().layerTree[0]
  const name = () => document.querySelector<HTMLElement>(`[data-layer-id="${layer.id}"] [data-layer-name]`)!
  return { layer, name }
}
beforeEach(resetTestStore)
afterEach(() => { cleanup(); resetTestStore() })

describe('inline output name editing', () => {
  it('keeps drafts local, commits once with Enter, and shows aliases without changing source names', () => {
    const { layer, name } = load()
    fireEvent.click(name())
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.doubleClick(name())
    const input = screen.getByRole('textbox', { name: '_BGの出力名' })
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: '背景/昼' } })
    expect(state().outputAliases.size).toBe(0)
    expect(screen.getByRole('status')).toHaveTextContent('背景_昼.jpg')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(state().outputAliases.get(layer.id)).toBe('背景_昼')
    expect(state()._past).toHaveLength(1)
    expect(name()).toHaveTextContent('背景_昼')
    expect(name().parentElement).toHaveAttribute('data-output-alias', 'true')
    expect(layer.originalName).toBe('_BG')
    expect(screen.getByTestId('layer-tree')).toHaveFocus()
    act(() => state().undo())
    expect(name()).toHaveTextContent('_BG')
  })

  it('supports F2, Escape, valid blur, empty cancellation and menu focus transfer/reset', () => {
    const { layer, name } = load()
    fireEvent.click(name())
    fireEvent.keyDown(screen.getByTestId('layer-tree'), { key: 'F2' })
    let input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'cancelled' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(state().outputAliases.size).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: '素材レイヤーのメニュー' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '出力名を指定…' }))
    input = screen.getByRole('textbox')
    expect(input).toHaveFocus()
    fireEvent.change(input, { target: { value: '新規' } })
    fireEvent.blur(input)
    expect(state().outputAliases.get(layer.id)).toBe('新規')
    fireEvent.doubleClick(name())
    input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: ' ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(input)
    expect(state().outputAliases.get(layer.id)).toBe('新規')
    fireEvent.click(screen.getByRole('button', { name: '素材レイヤーのメニュー' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '元の名前を使う' }))
    expect(state().outputAliases.size).toBe(0)
    expect(state()._past).toHaveLength(2)
  })

  it('does not commit a Japanese conversion Enter or navigate on Shift+wheel while editing', () => {
    const { layer, name } = load()
    fireEvent.doubleClick(name())
    const input = screen.getByRole('textbox')
    fireEvent.compositionStart(input)
    fireEvent.change(input, { target: { value: '背景' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(state().outputAliases.size).toBe(0)
    const selection = state().selectedLayerId
    fireEvent.wheel(input, { shiftKey: true, deltaY: 100 })
    expect(state().selectedLayerId).toBe(selection)
    fireEvent.compositionEnd(input)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(state().outputAliases.get(layer.id)).toBe('背景')
    expect(state()._past).toHaveLength(1)
  })

  it('discards a draft when a new document reuses the same layer ID', () => {
    const { layer, name } = load()
    fireEvent.doubleClick(name())
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'old draft' } })
    act(() => {
      state().loadParsedPsd(makePsd({ children: [makeFolder('_BG', [makeLayer()])] }), 'next.psd')
      // CLIP source IDs are deterministic, unlike generated PSD IDs.
      useAppStore.setState({ layerTree: [{ ...state().layerTree[0], id: layer.id }] })
    })
    expect(state().layerTree[0].id).toBe(layer.id)
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(state().outputAliases.size).toBe(0)
  })
})
