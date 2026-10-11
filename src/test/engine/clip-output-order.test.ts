import { describe, expect, it } from 'vitest'
import { buildLayerTree } from '../../engine/tree-builder'
import { buildEffectiveAnimationAssignment } from '../../engine/cell-extractor'
import { computeDisplayNames } from '../../engine/anim-folder-display-name'
import { makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'
import type { AnimationFolderInfo, CspLayer } from '../../types'

function mark(layer: CspLayer, trackNo: number, detectedBy: AnimationFolderInfo['detectedBy'] = 'clip') {
  layer.isAnimationFolder = true
  layer.animationFolder = { detectedBy, trackName: layer.originalName, trackNo }
}
const names = (tree: CspLayer[]) => computeDisplayNames(tree, buildEffectiveAnimationAssignment(tree), new Map())
const folder = () => makeFolder('A', [makeLayer({ name: '1' })])

describe('CLIP output folder ordering', () => {
  it.each(['hidden', 'uiHidden'] as const)('does not let a %s ancestor take the visible output name', flag => {
    const tree = buildLayerTree(makePsd({ children: [makeFolder('archive', [folder()]), folder()] }))
    const visible = tree[0], archived = tree[1].children[0]
    tree[1][flag] = true
    mark(visible, 900); mark(archived, 10)
    const display = names(tree)
    expect(display.get(visible.id)).toBe('A')
    expect(display.get(archived.id)).toBe('A(2)')
    expect(visible.animationFolder?.trackNo).toBe(900)
    expect(archived.animationFolder?.trackNo).toBe(10)
  })

  it('numbers visible native folders from bottom to top, independently of internal track IDs', () => {
    const tree = buildLayerTree(makePsd({ children: [folder(), folder(), folder()] }))
    mark(tree[0], 1); mark(tree[1], 2); mark(tree[2], 3)
    tree[2].hidden = true
    const display = names(tree)
    expect(tree.map(l => display.get(l.id))).toEqual(['A(2)', 'A', 'A(3)'])
    tree[2].hidden = false
    expect(tree.map(l => names(tree).get(l.id))).toEqual(['A(3)', 'A(2)', 'A'])
  })

  it('preserves XDTS track ordering and appends manual folders after detected folders', () => {
    const tree = buildLayerTree(makePsd({ children: [folder(), folder(), folder()] }))
    mark(tree[0], 8, 'xdts'); mark(tree[1], 2, 'xdts')
    tree[1].hidden = true
    tree[2].isAnimationFolder = true
    tree[2].animationFolder = { detectedBy: 'manual', trackName: 'A' }
    const assignment = buildEffectiveAnimationAssignment(tree)
    expect(tree.map(l => assignment.get(l.id))).toEqual([8, 2, 9])
    const display = names(tree)
    expect(tree.map(l => display.get(l.id))).toEqual(['A(2)', 'A', 'A(3)'])
  })
})
