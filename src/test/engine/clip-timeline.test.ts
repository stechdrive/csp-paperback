import { describe, expect, it } from 'vitest'
import { readCelFrames } from '../../utils/clip/timeline'
import type { BincNode } from '../../utils/clip/binc'

const node = (name: string, value: BincNode['value'] = null, children: BincNode[] = [], attrs = {}): BincNode => ({ name, value, children, attrs })
function clip(start: number, end: number, motionStart: number, keys: number[], tags: string[]) {
  const range = (name: string, a: number, b: number) => node(name, null, [node('Start', a), node('End', b), node('Rate', 60)])
  return node('ActionNodeClip', null, [
    range('TimeClip', start, end), range('MotionClip', motionStart, motionStart + end - start),
    node('TimeInfo', null, [node('Rate', 60)]),
    node('FCurve', null, [node('Frame', keys), node('Tag', tags)], { Type: 'ImageCelName' }),
  ])
}

describe('native CLIP exposure intervals', () => {
  it('shifts negative keys into visible time and ends the exposure instead of holding forever', () => {
    expect(readCelFrames(clip(0, 30, -7.5, [-7.5, 0], ['1', '2']), 24, 0)).toEqual([
      { frameIndex: 0, cellName: '1' }, { frameIndex: 3, cellName: '2' }, { frameIndex: 12, cellName: null },
    ])
  })
  it('uses the stored fps and playback origin, preserves gaps and explicit empty cels', () => {
    const root = node('root', null, [clip(20, 40, 20, [20, 24, 30], ['1', '', '2']), clip(60, 80, 60, [60], ['3'])])
    expect(readCelFrames(root, 30, 10)).toEqual([
      { frameIndex: 0, cellName: '1' }, { frameIndex: 2, cellName: null },
      { frameIndex: 5, cellName: '2' }, { frameIndex: 10, cellName: null },
      { frameIndex: 20, cellName: '3' }, { frameIndex: 30, cellName: null },
    ])
  })
  it('rejects overlapping, retimed, or blended motion instead of inventing cell assignments', () => {
    expect(() => readCelFrames(node('root', null, [clip(0, 30, 0, [0], ['1']), clip(15, 40, 15, [15], ['2'])]), 24, 0)).toThrow('重なる')
    const stretched = clip(0, 30, 0, [0], ['1'])
    stretched.children[1].children[1].value = 60
    expect(() => readCelFrames(stretched, 24, 0)).toThrow('伸縮')
    const blended = clip(0, 30, 0, [0], ['1'])
    blended.children.push(node('MotionBlend', null, [node('BlendEnable', 1)]))
    expect(() => readCelFrames(blended, 24, 0)).toThrow('補間')
  })
  it('preserves cel timing across repeated, adjacent motion clips', () => {
    const keys = [30, 45, 60, 90, 105, 120]
    const names = ['2', '3', '4', '2', '5', '1']
    const root = node('root', null, [
      clip(0, 150, 0, [0, ...keys], ['1', ...names]),
      clip(150, 270, 30, keys, names),
      clip(270, 390, 30, keys, names),
    ])
    const frames = readCelFrames(root, 24, 0)
    expect(frames).toEqual([
      { frameIndex: 0, cellName: '1' },
      ...[0, 48, 96].flatMap(offset => [12, 18, 24, 36, 42, 48].map((f, i) => ({ frameIndex: f + offset, cellName: names[i] }))),
      { frameIndex: 156, cellName: null },
    ])
  })
})
