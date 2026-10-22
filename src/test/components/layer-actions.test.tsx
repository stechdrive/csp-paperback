import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LayerTreePanel } from '../../components/LayerTreePanel'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { selectLayerTreeWithVisibility } from '../../store/selectors'
import { resolveLayerRowState } from '../../utils/layer-row-state'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => { cleanup(); resetTestStore(); vi.useRealTimers(); vi.unstubAllGlobals() })

function setup() {
  const rawPsd = makePsd({ children: [makeFolder('plain', [makeLayer({ name: 'drawing' })]),
    makeFolder('_empty', []), makeFolder('_asset', [makeLayer()]), makeFolder('_process', [makeFolder('_e', [])])] })
  const layerTree = buildLayerTree(rawPsd)
  resetTestStore({ rawPsd, layerTree, docWidth: 100, docHeight: 100 })
  render(<LayerTreePanel />)
  const row = (name: string) => screen.getByTestId('layer-tree').querySelector<HTMLElement>(`[data-layer-id="${layerTree.find(l => l.originalName === name)!.id}"]`)!
  return { row, layerTree }
}
function pointer(target: Element | Document, type: string, x = 10, y = 10) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y })
  Object.defineProperties(event, { pointerType: { value: 'touch' }, pointerId: { value: 1 } })
  fireEvent(target, event)
}

it('opens on the target row without changing output/preview/history and restores focus after Escape', () => {
  const { row } = setup()
  fireEvent.click(screen.getByRole('option', { name: '_asset.jpg' }))
  const before = useAppStore.getState()
  fireEvent.contextMenu(row('plain'))
  const after = useAppStore.getState()
  expect(after.selectedLayerId).toBe(row('plain').dataset.layerId)
  expect(after.selectedOutputSourceId).toBe(before.selectedOutputSourceId)
  expect(after.selectedCells).toBe(before.selectedCells)
  expect(after._past).toBe(before._past)
  expect(screen.getByRole('menuitemcheckbox', { name: /別画像として/ })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'End' })
  expect(screen.getByRole('menuitemcheckbox', { name: /手動でアニメーション/ })).toHaveFocus()
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  expect(screen.getByTestId('layer-tree')).toHaveFocus()
})

it('keeps auto origins read-only, omits the empty auto badge, and gives explicit empty output one Undo', () => {
  const { row } = setup()
  expect(row('_empty').querySelector('[data-layer-output-role]')).toBeNull()
  fireEvent.contextMenu(row('_asset'))
  expect(screen.getByRole('menuitemcheckbox', { name: /フォルダ名から自動/ })).toBeDisabled()
  fireEvent.contextMenu(row('_process'))
  expect(screen.getByRole('menuitemcheckbox', { name: /工程構成から自動/ })).toBeDisabled()
  expect(row('_process').querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
  fireEvent.contextMenu(row('_empty'))
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /別画像として/ }))
  expect(screen.getByRole('option', { name: '_empty.jpg' })).toBeInTheDocument()
  expect(row('_empty').querySelector('[data-output-origin]')).toHaveAttribute('data-output-origin', 'manual')
  expect(useAppStore.getState()._past).toHaveLength(1)
  act(() => useAppStore.getState().undo())
  expect(screen.queryByRole('option', { name: '_empty.jpg' })).toBeNull()
  expect(row('_empty').querySelector('[data-layer-output-role]')).toBeNull()
})

it('prioritizes animation without losing an existing individual mark, and restores that mark on undo', () => {
  const { row } = setup()
  fireEvent.contextMenu(row('plain'))
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /別画像として/ }))
  fireEvent.keyDown(screen.getByTestId('layer-tree'), { key: 'F10', shiftKey: true })
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: /手動でアニメーション/ }))
  expect(row('plain').querySelectorAll('[data-layer-output-role]')).toHaveLength(1)
  expect(row('plain').querySelector('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'animation')
  expect(useAppStore.getState().singleMarks.has(row('plain').dataset.layerId!)).toBe(true)
  act(() => useAppStore.getState().undo())
  expect(row('plain').querySelector('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'individual')
  const layer = selectLayerTreeWithVisibility(useAppStore.getState()).find(l => l.name === 'plain')!
  layer.isAnimationFolder = true
  layer.animationFolder = { detectedBy: 'clip', trackName: 'plain' }
  expect(resolveLayerRowState(layer, true).role).toBeUndefined()
})

it('opens on a stationary long press, cancels on move/scroll/cancel, and ignores the eye', () => {
  vi.useFakeTimers()
  const { row } = setup()
  for (const cancel of ['move', 'scroll', 'pointercancel']) {
    pointer(row('plain'), 'pointerdown')
    if (cancel === 'move') pointer(document, 'pointermove', 20)
    else if (cancel === 'scroll') fireEvent.scroll(window)
    else pointer(document, cancel)
    act(() => vi.advanceTimersByTime(600))
    expect(screen.queryByRole('menu')).toBeNull()
  }
  pointer(row('plain').querySelector('[data-layer-column="visibility"]')!, 'pointerdown')
  act(() => vi.advanceTimersByTime(600))
  expect(screen.queryByRole('menu')).toBeNull()
  pointer(row('plain'), 'pointerdown')
  pointer(document, 'pointermove', 11)
  act(() => vi.advanceTimersByTime(600))
  expect(screen.getByRole('menu')).toBeInTheDocument()
  expect(useAppStore.getState()._past).toHaveLength(0)
})

it('does not show a standalone star for stages or saved marks inside an animation folder', () => {
  const layerTree = buildLayerTree(makePsd({ children: [makeFolder('animation', [makeFolder('1', [makeFolder('_s', [makeLayer()])])])] }))
  const root = layerTree[0], cell = root.children[0], stage = cell.children[0]
  resetTestStore({ layerTree, docWidth: 100, docHeight: 100, expandedFolders: new Set([root.id, cell.id]),
    manualAnimFolderIds: new Set([root.id]), singleMarks: new Map([[stage.id, { layerId: stage.id, origin: 'manual' }]]) })
  render(<LayerTreePanel />)
  const row = document.querySelector(`[data-layer-id="${stage.id}"]`)!
  expect(row.querySelector('[data-layer-output-role]')).toBeNull()
  fireEvent.contextMenu(row)
  expect(screen.getByRole('menuitemcheckbox', { name: /セル内では無効/ })).toHaveAttribute('aria-checked', 'true')
  act(() => useAppStore.getState().toggleManualAnimFolder(root.id))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(row.querySelector('[data-layer-output-role]')).toHaveAttribute('data-layer-output-role', 'individual')
})

it('leaves text editing context menus native and closes the popup on a document replacement', () => {
  const { row } = setup()
  fireEvent.contextMenu(row('_asset'))
  fireEvent.click(screen.getByRole('menuitem', { name: '出力名を編集' }))
  const input = screen.getByRole('textbox', { name: '_assetの出力名' })
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
  fireEvent(input, event)
  expect(event.defaultPrevented).toBe(false)
  expect(screen.queryByRole('menu')).toBeNull()
  fireEvent.keyDown(input, { key: 'Escape' })
  fireEvent.contextMenu(row('_asset'))
  act(() => useAppStore.setState({ rawPsd: makePsd() }))
  expect(screen.queryByRole('menu')).toBeNull()
})
