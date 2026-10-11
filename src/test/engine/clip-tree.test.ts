import { describe, expect, it } from 'vitest'
import type { Psd } from 'ag-psd'
import { buildClipLayerTree, clipRenderingSource } from '../../engine/clip-tree'
import { findTimelineCellChildIndex } from '../../utils/anim-cell-selection'
import type { ClipDocument, ClipLayer } from '../../utils/clip/types'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'

function layer(id: string, name: string, children?: ClipLayer[]): ClipLayer {
  return { id, name, isFolder: children !== undefined, isAnimationFolder: false,
    expanded: true, hidden: false, opacity: 1, blendMode: 'normal', clipping: false, children: children ?? [] }
}

function fixture() {
  // Numeric folders inside a cel are artwork containers, including duplicate names.
  const content = layer('group', '6', [layer('upper', '線'), layer('lower', '線')])
  const cel = layer('cel', '5', [content, layer('group-copy', '6', [layer('copy-upper', '線'), layer('copy-lower', '線')])])
  const animation = { ...layer('animation', 'C', [cel]), isAnimationFolder: true }
  const clip: ClipDocument = { width: 16, height: 16, dpi: 72, layers: [layer('process', '作監', [animation])],
    timelines: [{ id: 1, bindings: { animation: 7 }, diagnostics: [], data: {
      version: 10, header: { cut: '', scene: '' }, timeTableName: 'test', duration: 12, fps: 24,
      tracks: [{ name: 'C', trackNo: 7, cellNames: ['5'], frames: [{ frameIndex: 0, cellName: '5' }] }],
    } }], defaultTimelineId: 1, diagnostics: [] }
  return { clip, animation, cel, content }
}

function build(clip: ClipDocument, psd: Psd = clipRenderingSource(clip)) {
  return buildClipLayerTree(clip, psd, clip.timelines[0], DEFAULT_PROJECT_SETTINGS)
}

describe('CLIP and PSD pairing within animation cels', () => {
  it('preserves repeated artwork names and stacking order without treating internal folders as cels', () => {
    const { clip } = fixture()
    const psd = clipRenderingSource(clip)
    const tree = build(clip, psd)
    const animation = tree[0].children[0]
    const cel = animation.children[0]
    const content = cel.children[0]
    const sourceCel = psd.children![0].children![0].children![0]
    const sourceGroup = sourceCel.children![1]

    expect(animation.animationFolder).toEqual({ detectedBy: 'clip', trackName: 'C', trackNo: 7 })
    expect(findTimelineCellChildIndex(animation, '5')).toBe(0)
    expect(findTimelineCellChildIndex(animation, '6')).toBe(-1)
    expect([cel, ...cel.children, ...content.children].every(l => !l.isAnimationFolder && l.animationFolder === null)).toBe(true)
    expect(content.children.map(l => l.id)).toEqual(['clip:upper', 'clip:lower'])
    expect(content.children[0].agPsdRef).toBe(sourceGroup.children![1])
    expect(content.children[1].agPsdRef).toBe(sourceGroup.children![0])
    expect(cel.children[1].id).toBe('clip:group-copy')
  })

  it('still rejects indistinguishable sibling cels and animation folders', () => {
    const a = fixture()
    a.animation.children.push({ ...a.cel, id: 'other-cel' })
    expect(() => build(a.clip)).toThrow('同名レイヤー')
    const b = fixture()
    b.clip.layers[0].children.push({ ...b.animation, id: 'other-animation' })
    expect(() => build(b.clip)).toThrow('同名レイヤー')
  })

  it('still validates names, folder types, counts and order inside cels', () => {
    const { clip, content } = fixture()
    content.children[1].name = '色'
    const source = () => clipRenderingSource(clip)
    const group = (psd: Psd) => psd.children![0].children![0].children![0].children![1]
    const renamed = source(); group(renamed).children![0].name = 'changed'
    const reordered = source(); group(reordered).children!.reverse()
    const removed = source(); group(removed).children!.pop()
    const converted = source(); group(converted).children![0].children = []
    for (const psd of [renamed, reordered, removed, converted]) expect(() => build(clip, psd)).toThrow('一致しません')
  })
})
