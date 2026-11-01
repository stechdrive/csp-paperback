import { describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { renderIssues, groupRenderIssues, type RenderIssue } from '../../utils/render-diagnostics'

const vector = (id: string, name = 'line'): RenderIssue => ({ layerId: id, layerName: name, code: 'APPROXIMATE_VECTOR',
  scope: 'raster', part: 'material', outcome: 'approximate', materialKind: 'vector', message: `「${name}」: ベクターレイヤーを近似描画しています。` })

describe('grouped rendering warnings', () => {
  it('groups repeated causes across same-name layers without losing layer identity', () => {
    const groups = groupRenderIssues([vector('a'), vector('b'), vector('c', '「別の線」'), vector('a')])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ title: 'ベクターの近似描画', message: 'ベクターレイヤーを近似描画しています。' })
    expect(groups[0].issues.map(issue => issue.layerId)).toEqual(['a', 'b', 'c'])
  })
  it('does not merge distinct failures, effects, parameter values or unidentified messages', () => {
    const base = vector('a')
    const groups = groupRenderIssues([base, { ...base, outcome: 'missing-content' }, { ...base, part: 'mask' },
      { ...base, code: 'MISSING_VECTOR_STROKE' }, { ...base, message: '別の原因' },
      { ...base, code: undefined, layerName: '', message: '「他のレイヤー」: タイル破損' }])
    expect(groups).toHaveLength(6)
    expect(groups.at(-1)!.message).toBe('「他のレイヤー」: タイル破損')
  })
})

it('keeps distinct render placements but removes their duplicate source warning', () => {
  const layer = buildLayerTree({ width: 1, height: 1, children: [{ name: 'ink' }] }, undefined, [], [])[0]
  layer.id = 'clip:source'
  const base = { scope: 'raster' as const, part: 'material' as const, code: 'APPROXIMATE_VECTOR',
    layerId: 'source', outcome: 'approximate' as const, message: 'approximate ink' }
  const issues = renderIssues([layer], [base, { ...base, message: '「ink」: approximate ink' },
    { ...base, data: { renderNodeId: 'one' } }, { ...base, data: { renderNodeId: 'two' } }])
  expect(issues.map(i => i.renderNodeId)).toEqual(['one', 'two'])
})
