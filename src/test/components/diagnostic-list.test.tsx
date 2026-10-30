import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { DiagnosticList } from '../../components/DiagnosticList'
import { buildLayerTree } from '../../engine/tree-builder'
import { resetTestStore } from '../helpers/store-reset'
import type { RenderIssue } from '../../utils/render-diagnostics'

afterEach(() => { cleanup(); resetTestStore() })

it.each(['saved', 'not-saved', 'unknown'] as const)('shows guidance once above grouped warnings with compatibility=%s', compatibility => {
  const tree = buildLayerTree({ width: 8, height: 8, children: [{ name: 'A', children: [{ name: 'line' }] }, { name: 'B', children: [{ name: 'line' }] }] })
  resetTestStore({ layerTree: tree, clipDocument: { width: 8, height: 8, dpi: 72, layers: [], timelines: [], defaultTimelineId: null, diagnostics: [], compatibility } })
  const issues: RenderIssue[] = tree.map(folder => ({ layerId: folder.children[0].id, layerName: 'line', message: '「line」: 線幅に差があります。',
    code: 'APPROXIMATE_VECTOR', part: 'material', materialKind: 'vector', outcome: 'approximate' }))
  const inspect = vi.fn(), { container } = render(<DiagnosticList issues={issues} onInspect={inspect} />)
  expect(screen.getAllByText('ベクターの近似描画')).toHaveLength(1)
  expect(screen.getByText('2レイヤー')).toBeInTheDocument()
  expect(screen.getByText('A / line')).toBeInTheDocument()
  expect(screen.getByText('B / line')).toBeInTheDocument()
  expect(container.querySelector('ul > li > details')).not.toHaveAttribute('open')
  expect(container.querySelectorAll('aside')).toHaveLength(1)
  if (compatibility === 'saved') expect(screen.queryByText('クリスタでの保存手順')).toBeNull()
  else {
    expect(screen.getAllByText('クリスタでの保存手順')).toHaveLength(1)
    expect(container.querySelector('aside details')).not.toHaveAttribute('open')
    expect(container.querySelector('aside')).toHaveTextContent('［別名で保存］')
  }
  fireEvent.click(screen.getAllByText('素材を確認')[0])
  expect(inspect).toHaveBeenCalledWith(issues[0].layerId)
})

it('does not suggest compatibility saving for effect-only or unrelated failures', () => {
  const issues: RenderIssue[] = [{ layerId: '', layerName: '', message: 'トーンには未対応です。', code: 'UNSUPPORTED_TONE', part: 'effect', outcome: 'missing-effect' }]
  const { container } = render(<DiagnosticList issues={issues} onInspect={vi.fn()} />)
  expect(container.querySelector('aside')).toBeNull()
  expect(screen.getByText('トーンが未対応')).toBeInTheDocument()
})
