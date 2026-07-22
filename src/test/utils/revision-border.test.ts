import { describe, expect, it } from 'vitest'
import type { OutputEntry, ProcessFolderEntry } from '../../types'
import {
  applyRevisionBorders,
  createRevisionBorderCanvas,
  REVISION_BORDER_OPACITY,
  REVISION_BORDER_WIDTH,
} from '../../utils/revision-border'

function makeCanvas(width = 300, height = 240): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function makeEntry(
  processSuffixes?: string[],
  width = 300,
  height = 240,
): OutputEntry {
  return {
    path: 'A/A_01.jpg',
    flatName: 'A_01.jpg',
    canvas: makeCanvas(width, height),
    sourceLayerId: 'layer-1',
    processSuffixes,
  }
}

const PROCESS_TABLE: ProcessFolderEntry[] = [
  { suffix: '_e', folderNames: ['演出'], revisionBorderColor: '#FBECE6' },
  { suffix: '_s', folderNames: ['作監'], revisionBorderColor: '#FCF9CF' },
]

describe('revision border', () => {
  it('70px・乗算・不透明度80%のフチ用キャンバスを生成する', () => {
    const result = createRevisionBorderCanvas(makeCanvas(), '#FBECE6')
    const ctx = result.getContext('2d')!
    const events = (ctx as unknown as {
      __getEvents: () => Array<{ type: string; props: Record<string, unknown> }>
    }).__getEvents()

    expect(result.width).toBe(300)
    expect(result.height).toBe(240)
    expect(REVISION_BORDER_WIDTH).toBe(70)
    expect(REVISION_BORDER_OPACITY).toBe(0.8)
    expect(events.some(event =>
      event.type === 'globalCompositeOperation'
      && event.props.value === 'multiply'
    )).toBe(true)
    expect(events.some(event =>
      event.type === 'globalAlpha'
      && event.props.value === 0.8
    )).toBe(true)

    const fills = events.filter(event => event.type === 'fillRect')
    expect(fills).toHaveLength(4)
  })

  it('工程出力だけを新しいフチ付きキャンバスへ差し替える', () => {
    const body = makeEntry()
    const process = makeEntry(['_e'])
    const result = applyRevisionBorders([body, process], PROCESS_TABLE, true)

    expect(result[0]).toBe(body)
    expect(result[1].canvas).not.toBe(process.canvas)
    expect(result[1].canvas.width).toBe(process.canvas.width)
    expect(result[1].canvas.height).toBe(process.canvas.height)
  })

  it('OFFなら元の配列とキャンバスをそのまま返す', () => {
    const process = makeEntry(['_e'])
    const entries = [process]
    expect(applyRevisionBorders(entries, PROCESS_TABLE, false)).toBe(entries)
  })

  it('親工程とセル内工程が重なる場合は末尾のセル内工程色を使う', () => {
    const process = makeEntry(['_e', '_s'])
    const result = applyRevisionBorders([process], PROCESS_TABLE, true)[0]
    const events = (result.canvas.getContext('2d') as unknown as {
      __getEvents: () => Array<{ type: string; props: Record<string, unknown> }>
    }).__getEvents()

    expect(events.some(event =>
      event.type === 'fillStyle'
      && String(event.props.value).toUpperCase() === '#FCF9CF'
    )).toBe(true)
  })

  it('短辺が140px以下なら重複を避けて全面を1回だけ塗る', () => {
    const result = createRevisionBorderCanvas(makeCanvas(120, 300), '#FBECE6')
    const events = (result.getContext('2d') as unknown as {
      __getEvents: () => Array<{ type: string; props: Record<string, unknown> }>
    }).__getEvents()
    expect(events.filter(event => event.type === 'fillRect')).toHaveLength(1)
  })
})
