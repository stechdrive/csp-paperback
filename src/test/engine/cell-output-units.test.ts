import { describe, expect, it, vi } from 'vitest'
import type { Layer } from 'ag-psd'
import { collectCellOutputUnits } from '../../engine/cell-output-units'
import { extractCells } from '../../engine/cell-extractor'
import { buildLayerTree } from '../../engine/tree-builder'
import { DEFAULT_PROJECT_SETTINGS } from '../../types'
import { makeAnimationFolder, makeFolder, makeLayer, makePsd } from '../helpers/psd-factory'

function makeAnim(children: Layer[]) {
  const anim = buildLayerTree(makePsd({ children: [makeAnimationFolder('A', children)] }))[0]
  anim.isAnimationFolder = true
  anim.animationFolder = { detectedBy: 'manual', trackName: 'A' }
  return anim
}

describe('collectCellOutputUnits', () => {
  it('本体と同サフィックス工程の合成を出力と同じ単位・順序で列挙し、描画しない', () => {
    const anim = makeAnim([makeFolder('1', [
      makeLayer({ name: 'body' }),
      makeFolder(' 演出 ', [makeLayer({ name: 'correction-2' })]),
      makeFolder(' en ', [makeLayer({ name: 'correction-1' })]),
    ])])
    const processTable = [{ suffix: '_e', folderNames: ['EN', '演出'] }]
    const createElement = vi.spyOn(document, 'createElement')
    const units = collectCellOutputUnits(anim, processTable)
    expect(createElement).not.toHaveBeenCalled()
    createElement.mockRestore()

    expect(units.map(unit => ({
      index: unit.cellIndex,
      suffix: unit.processSuffix,
      layers: unit.layers.map(layer => layer.originalName),
    }))).toEqual([
      { index: 0, suffix: undefined, layers: ['body'] },
      { index: 0, suffix: '_e', layers: [' en ', ' 演出 '] },
    ])
    expect(units[0].sourceLayerId).toBe(anim.children[0].id)
    expect(units[0].ignoreOpacityIds).toBeUndefined()
    expect(units[1].sourceLayerId).toBe(anim.children[0].children[0].id)
    expect(units[1].ignoreOpacityIds).toEqual(new Set(units[1].layers.map(layer => layer.id)))

    const entries = extractCells(anim, { ...DEFAULT_PROJECT_SETTINGS, processTable }, 100, 100, [])
    expect(entries.map(entry => entry.sourceLayerId)).toEqual(units.map(unit => unit.sourceLayerId))
    expect(entries.map(entry => entry.flatName)).toEqual(['A_1.jpg', 'A_1_e.jpg'])
  })

  it('非表示セル・素材を飛ばし、セル選択用に元childrenのindexを保持する', () => {
    const anim = makeAnim([
      makeLayer({ name: '1' }),
      makeLayer({ name: '2', hidden: true }),
      makeFolder('3', [makeLayer({ name: 'hidden-body', hidden: true }), makeFolder('EN', [])]),
      makeLayer({ name: '4' }),
    ])
    anim.children[0].uiHidden = true
    const units = collectCellOutputUnits(anim, [{ suffix: '_e', folderNames: ['EN'] }])
    expect(units.map(unit => [unit.cell.originalName, unit.cellIndex, unit.processSuffix])).toEqual([
      ['3', 1, '_e'],
      ['1', 3, undefined],
    ])
    expect(units[1].ignoreOpacityIds).toEqual(new Set([anim.children[3].id]))
  })

  it('空セルは本体1枚、工程だけのセルは工程だけを列挙する', () => {
    const anim = makeAnim([
      makeFolder('empty', []),
      makeFolder('process-only', [makeFolder('EN', [])]),
    ])
    const units = collectCellOutputUnits(anim, [{ suffix: '_e', folderNames: ['EN'] }])
    expect(units.map(unit => [unit.cell.originalName, unit.processSuffix, unit.layers.length])).toEqual([
      ['process-only', '_e', 1],
      ['empty', undefined, 0],
    ])
  })

  it('空サフィックス工程も本体とは別の出力として保持する', () => {
    const anim = makeAnim([makeFolder('1', [makeLayer({ name: 'body' }), makeFolder('process', [])])])
    const processTable = [{ suffix: '', folderNames: ['PROCESS'] }]
    const units = collectCellOutputUnits(anim, processTable)
    expect(units.map(unit => unit.processSuffix)).toEqual([undefined, ''])
    const entries = extractCells(anim, { ...DEFAULT_PROJECT_SETTINGS, processTable }, 100, 100, [])
    expect(entries.map(entry => entry.flatName)).toEqual(['A_1.jpg', 'A_1_2.jpg'])
  })

  it('アニメーションフォルダ以外は出力セルを持たない', () => {
    const anim = makeAnim([makeLayer({ name: '1' })])
    anim.isAnimationFolder = false
    expect(collectCellOutputUnits(anim, [])).toEqual([])
  })
})
