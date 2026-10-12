import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LayerTreePanel } from '../../components/LayerTreePanel'
import { buildLayerTree } from '../../engine/tree-builder'
import { useAppStore } from '../../store'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import { resetTestStore } from '../helpers/store-reset'

beforeEach(() => {
  // This suite checks tree membership and selection, not browser scroll geometry.
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  cleanup()
  resetTestStore()
  vi.unstubAllGlobals()
})

function renderTree() {
  const tree = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', [
    makeFolder('1', [makeLayer({ name: 'body' }), makeFolder('作監', [makeLayer({ name: 'correction' })])]),
  ])] }))
  const anim = tree[0]
  anim.isAnimationFolder = true
  anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
  const cell = anim.children[0]
  const body = cell.children.find(layer => layer.originalName === 'body')!
  const process = cell.children.find(layer => layer.originalName === '作監')!
  const expanded = new Set<string>()
  const collapsed = new Set<string>()
  resetTestStore({ layerTree: tree, docWidth: 100, docHeight: 100, expandedFolders: expanded, userCollapsedFolders: collapsed })
  render(<LayerTreePanel />)
  return { anim, cell, body, process, expanded, collapsed }
}

function row(id: string) {
  return document.querySelector<HTMLElement>(`[data-layer-id="${id}"]`)
}

function wheel({ deltaY = 100, deltaX = 0, shiftKey = true } = {}) {
  const tree = screen.getByTestId('layer-tree')
  const event = createEvent.wheel(tree, { deltaY, deltaX, shiftKey, cancelable: true })
  fireEvent(tree, event)
  return event
}

describe('LayerTreePanel output navigation', () => {
  it('keeps the clicked body row visible after navigating to an unmarked process folder', () => {
    const { anim, cell, body, process, expanded, collapsed } = renderTree()
    expect(process.autoMarked).toBe(false)
    expect(row(body.id)).not.toBeInTheDocument()

    expect(wheel().defaultPrevented).toBe(true)
    expect(useAppStore.getState().selectedLayerId).toBe(cell.id)
    expect(row(anim.id)).toBeInTheDocument()
    wheel()
    expect(useAppStore.getState().selectedLayerId).toBe(process.id)
    expect(row(body.id)).toBeInTheDocument()

    fireEvent.click(row(body.id)!)
    expect(useAppStore.getState().selectedLayerId).toBe(body.id)
    expect(row(body.id)).toBeInTheDocument()
    expect(row(process.id)).toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toBe(expanded)
    expect(useAppStore.getState().userCollapsedFolders).toBe(collapsed)
  })

  it('preserves an explicitly collapsed cell while continuing to navigate its output images', () => {
    const { cell, body, process, expanded } = renderTree()
    wheel()
    wheel()
    expect(row(body.id)).toBeInTheDocument()

    fireEvent.click(row(cell.id)!.querySelector('button')!)
    const collapsed = useAppStore.getState().userCollapsedFolders
    expect(collapsed.has(cell.id)).toBe(true)
    expect(row(body.id)).not.toBeInTheDocument()
    expect(row(process.id)).not.toBeInTheDocument()

    wheel({ deltaY: -100 })
    expect(useAppStore.getState().selectedLayerId).toBe(cell.id)
    wheel()
    expect(useAppStore.getState().selectedLayerId).toBe(process.id)
    expect(row(cell.id)).toBeInTheDocument()
    expect(row(body.id)).not.toBeInTheDocument()
    expect(row(process.id)).not.toBeInTheDocument()
    expect(useAppStore.getState().expandedFolders).toEqual(expanded)
    expect(useAppStore.getState().userCollapsedFolders).toBe(collapsed)
  })

  it('leaves ordinary and zero-delta wheel events alone, and accepts Shift horizontal wheel events', () => {
    const { cell, process } = renderTree()
    expect(wheel({ shiftKey: false }).defaultPrevented).toBe(false)
    expect(wheel({ deltaY: 0 }).defaultPrevented).toBe(false)
    expect(useAppStore.getState().selectedLayerId).toBeNull()

    expect(wheel({ deltaY: 0, deltaX: 100 }).defaultPrevented).toBe(true)
    expect(useAppStore.getState().selectedLayerId).toBe(cell.id)
    expect(wheel({ shiftKey: false }).defaultPrevented).toBe(false)
    expect(useAppStore.getState().selectedLayerId).toBe(cell.id)
    wheel({ deltaY: 0, deltaX: 100 })
    expect(useAppStore.getState().selectedLayerId).toBe(process.id)
  })
})
