import type { TimelineFrame } from '../../types/timeline'
import { check } from './binary'
import { field, nodesNamed, type BincNode } from './binc'

const EPSILON = 1e-5

/** Cel switches are in motion time, bounded by TimeClip's half-open exposure interval. */
export function readCelFrames(root: BincNode, fps: number, startFrame: number): TimelineFrame[] {
  const clips = nodesNamed(root, 'ActionNodeClip')
  check(clips.length > 0, 'セルの表示区間がありません')
  const segments = clips.map(clip => {
    function time(name: string) {
      const node = clip.children.find(c => c.name === name)
      check(node, `${name}がありません`)
      const start = field(node, 'Start'), end = field(node, 'End'), rate = field(node, 'Rate')
      check(typeof start === 'number' && typeof end === 'number' && typeof rate === 'number' && rate > 0 && end >= start, `${name}が不正です`)
      return { start, end, rate }
    }
    const exposure = time('TimeClip'), motion = time('MotionClip')
    const blend = clip.children.find(c => c.name === 'MotionBlend')
    check(!blend || !field(blend, 'BlendEnable'), 'クリップ間の補間には未対応です')
    check(Math.abs((exposure.end - exposure.start) / exposure.rate - (motion.end - motion.start) / motion.rate) < EPSILON, '伸縮したタイムラインには未対応です')
    const infoRate = clip.children.find(c => c.name === 'TimeInfo')
    const rate = infoRate ? field(infoRate, 'Rate') : 60
    check(typeof rate === 'number' && rate > 0, 'キーの時間単位が不正です')
    const curves = nodesNamed(clip, 'FCurve').filter(c => c.attrs.Type === 'ImageCelName')
    check(curves.length <= 1, '複数のセル曲線には未対応です')
    const curve = curves[0]
    const keys: { time: number; name: string | null }[] = []
    if (curve) {
      const frames = field(curve, 'Frame'), tags = field(curve, 'Tag')
      check(Array.isArray(frames) && Array.isArray(tags) && frames.length === tags.length, 'セル指定の配列が不正です')
      for (let i = 0; i < frames.length; i++) {
        check(typeof frames[i] === 'number' && typeof tags[i] === 'string', 'セル指定の値が不正です')
        const seconds = (frames[i] as number) / rate - motion.start / motion.rate + exposure.start / exposure.rate
        keys.push({ time: seconds * fps - startFrame, name: (tags[i] as string) || null })
      }
    } else {
      const param = nodesNamed(clip, 'Param').find(c => c.attrs.Name === 'ImageCelName')
      check(param, 'セル指定がありません')
      keys.push({ time: exposure.start / exposure.rate * fps - startFrame, name: param.attrs.Tag || null })
    }
    keys.sort((a, b) => a.time - b.time)
    return { start: exposure.start / exposure.rate * fps - startFrame, end: exposure.end / exposure.rate * fps - startFrame, keys }
  }).sort((a, b) => a.start - b.start)
  for (let i = 1; i < segments.length; i++) check(segments[i].start >= segments[i - 1].end - EPSILON, '重なるセルクリップには未対応です')
  // Evaluate only transition points, including frame zero and clip ends (null cells).
  const boundaries = new Set([0])
  for (const s of segments) for (const time of [s.start, s.end, ...s.keys.map(k => k.time)]) {
    check(Math.abs(time) <= 10000000, 'タイムラインが長すぎます')
    boundaries.add(Math.max(0, Math.ceil(time - EPSILON)))
  }
  const result: TimelineFrame[] = []
  for (const frameIndex of [...boundaries].sort((a, b) => a - b)) {
    const segment = segments.find(s => frameIndex >= s.start - EPSILON && frameIndex < s.end - EPSILON)
    const cellName = segment?.keys.findLast(k => k.time <= frameIndex + EPSILON)?.name ?? null
    if (!result.length || result.at(-1)!.cellName !== cellName) result.push({ frameIndex, cellName })
  }
  return result
}
