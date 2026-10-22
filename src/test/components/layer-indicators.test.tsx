import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LayerTreeRow, LayerVisibility } from '../../components/LayerTreeRow'
import { LayerActionsProvider } from '../../components/LayerActionsMenu'
import { createLayerActions } from '../../utils/layer-row-state'

afterEach(cleanup)
describe('layer identification and conditional controls', () => {
  it('shows boundary and disabled mask separately and releases their DOM when absent', () => {
    const base = { name: '線画', depth: 0, kind: 'layer' as const, visibility: <LayerVisibility hidden={false} readOnly /> }
    const { container, rerender } = render(<LayerTreeRow {...base} metadata={{ kind: 'vector', paletteColor: '#ff8000',
      effects: { edge: { radius: 2, color: [255, 255, 255] } }, mask: 'disabled' }} />)
    expect(screen.getByRole('img', { name: 'ベクター' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '境界効果（フチ）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'マスク無効' })).toHaveAttribute('data-layer-mask', 'disabled')
    expect(container.querySelector('[data-palette-color]')).toHaveStyle({ backgroundColor: '#ff8000' })
    rerender(<LayerTreeRow {...base} metadata={{ kind: 'raster' }} />)
    expect(container.querySelector('[data-layer-column="indicators"]')).toBeNull()
    expect(container.querySelector('[data-layer-mask]')).toBeNull()
    expect(container.querySelector('[data-palette-color]')).toBeNull()
  })

  it('keeps the cell role while showing the native artwork kind', () => {
    render(<LayerTreeRow name="1" depth={0} kind="cell" metadata={{ kind: 'raster' }} visibility={<span />} />)
    expect(screen.getByRole('img', { name: 'セル（ラスター）' })).toHaveAttribute('data-layer-content-kind', 'raster')
  })

  it('invokes existing actions through the compact menu and closes it even when actions stop bubbling', () => {
    const animation = vi.fn(), individual = vi.fn(), rename = vi.fn()
    render(<LayerActionsProvider><LayerTreeRow name="エフェクト" depth={0} kind="folder" visibility={<span />} controls={{
      actions: createLayerActions({ rename, toggleAnimation: animation, toggleIndividual: individual, isAnimation: false, canAssignAnimation: true }),
    }} /></LayerActionsProvider>)
    fireEvent.contextMenu(screen.getByText('エフェクト'))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitemcheckbox', { name: 'このフォルダを手動でアニメーションフォルダとして扱う' }))
    expect(animation).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu')).toBeNull()
    fireEvent.contextMenu(screen.getByText('エフェクト'))
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: '出力名を編集' }))
    expect(rename).toHaveBeenCalledOnce()
    expect(individual).not.toHaveBeenCalled()
  })

  it('ignores a queued scroll at the opening position but closes when its anchor moves', () => {
    render(<LayerActionsProvider><LayerTreeRow name="背景" depth={0} kind="folder" visibility={<span />} controls={{ actions: [{ id: 'rename', label: '出力名を編集', run: vi.fn() }] }} /></LayerActionsProvider>)
    const trigger = screen.getByText('背景').closest('[data-layer-kind]')!
    fireEvent.contextMenu(trigger)
    fireEvent.scroll(document)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 20, 19, 22))
    fireEvent.scroll(document)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
