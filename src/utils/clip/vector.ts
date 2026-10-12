// Curve sampling and brush stamping adapted from animeops/clip-tools (MIT).
// 88/92-byte stroke layouts cross-checked with Aodaruma/clipfile-rs (MIT).
// This is an approximate material renderer, not CSP's brush engine.
import { check, Reader } from './binary'
import { num, type ClipRow } from './records'
import { cropPixels } from './pixels'
import type { ClipPixels } from './types'

export interface VectorPoint {
  x: number; y: number; flags: number
  pressure: number; velocity: number; smooth: number; tilt: number; size: number; flow: number
  handles: number[]
}
export interface VectorStroke {
  flags: number; brush: number; diameter: number; opacity: number
  color: number[]; points: VectorPoint[]
}
export interface BrushPattern { width: number; height: number; alpha: Uint8Array }
export interface VectorBrushes {
  styles: Map<number, ClipRow>
  graphs: Map<number, ClipRow>
  patterns: Map<number, BrushPattern>
}
const clamp = (v: number) => Math.max(0, Math.min(1, v))
// Empirical coverage correction for thin, hard, AA=1 / CompositeMode=31 pens.
// Validated on one production document; not a decoded CSP brush-engine rule.
const ROUND_WIDTH = .65
const ROUND_OPACITY = .9

/** Validate boundaries before allocation; unsupported records never become guessed strokes. */
export function readVectorStrokes(bytes: Uint8Array): VectorStroke[] {
  const r = new Reader(bytes), strokes: VectorStroke[] = []
  let totalPoints = 0
  while (r.position < bytes.length) {
    const start = r.position, header = r.u32(), section = r.u32(), stride = r.u32(), base = r.u32()
    check((header === 88 && section === 72 || header === 92 && section === 76) && base === 88 && [88, 104, 120].includes(stride), '未対応のベクターストローク形式です')
    const count = r.u32(), flags = r.u32()
    check((flags & 13) === 1 && [16, 32, 64, 128].includes(flags & 240), '未対応のベクター曲線形式です')
    check(totalPoints + count <= 1000000 && strokes.length < 50000 && count > 0, 'ベクターの制御点数が上限を超えるか不正です')
    totalPoints += count
    check(start + header + count * stride <= bytes.length, 'ベクターの制御点が途中で切れています')
    r.take(16)
    const color = [r.u32() >>> 24, r.u32() >>> 24, r.u32() >>> 24]
    r.take(12)
    const opacity = r.number('f64')
    let brush = r.u32()
    if (header === 92) brush = r.u32()
    const diameter = 2 * r.number('f64')
    r.u32() // Saved random seed; randomized/spray tips are not reproduced.
    check(opacity >= 0 && opacity <= 1 && diameter >= 0 && diameter <= 4096, 'ベクターの線幅・不透明度が範囲外です')
    const points: VectorPoint[] = []
    for (let i = 0; i < count; i++) {
      const p = new Reader(r.take(stride)), x = p.number('f64'), y = p.number('f64')
      check(Math.abs(x) <= 1000000 && Math.abs(y) <= 1000000, 'ベクター座標が範囲外です')
      p.take(16)
      const pointFlags = p.u32(), pressure = p.number('f32'), velocity = p.number('f32'), smooth = p.number('f32')
      p.number('f32') // Pen direction, currently approximated by the path tangent.
      const tilt = p.number('f32'), size = p.number('f32'), flow = p.number('f32')
      check(size >= 0 && size <= 64 && flow >= 0 && flow <= 64, 'ベクターの制御点係数が範囲外です')
      p.take(24)
      const handles = Array.from({ length: (stride - 88) / 8 }, () => p.number('f64'))
      check(handles.every(v => Math.abs(v) <= 1000000), 'ベクターのハンドル座標が範囲外です')
      points.push({ x, y, flags: pointFlags, pressure, velocity, smooth, tilt, size, flow, handles })
    }
    strokes.push({ flags, brush, diameter, opacity, color, points })
  }
  return strokes
}

/** clip-tools' six-point interpolating spline, with duplicated endpoint controls. */
function spline(points: VectorPoint[], i: number, t: number): [number, number] {
  const q = t * t
  const w = t >= .5
    ? [2*q-6*t+4, -16*q+44*t-28, 96*q-260*t+164, -164*q+328*t-65, 96*q-124*t+28, -14*q+18*t-4]
    : [-14*q+10*t, 96*q-68*t, -164*q+99, 96*q+68*t, -16*q-12*t, 2*q+2*t]
  let x = 0, y = 0
  for (let j = 0; j < 6; j++) { const p = points[Math.max(0, Math.min(points.length - 1, i + j - 2))]; x += w[j] * p.x; y += w[j] * p.y }
  return [x / 99, y / 99]
}

export function sampleVectorStroke(stroke: VectorStroke): VectorPoint[] {
  const pts = stroke.points, out: VectorPoint[] = []
  // A click with one control is a brush stamp, not an empty path.
  if (pts.length === 1) return [{ ...pts[0] }]
  const kind = stroke.flags & 240
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1]
    const length = Math.hypot(b.x - a.x, b.y - a.y) + a.handles.reduce((sum, v, j) => j % 2 ? sum : sum + Math.hypot(v - a.x, a.handles[j + 1] - a.y), 0)
    const count = Math.max(2, Math.ceil(length * 2))
    check(out.length + count <= 1000000, 'ベクター曲線の展開量が上限を超えました')
    for (let j = i ? 1 : 0; j < count; j++) {
      const t = j / (count - 1), u = 1 - t
      const lerp = (x: number, y: number) => u * x + t * y
      let x = lerp(a.x, b.x), y = lerp(a.y, b.y)
      if (kind === 128) [x, y] = spline(pts, i, t)
      else if (kind === 32 && a.handles.length >= 2) {
        x = u*u*a.x + 2*u*t*a.handles[0] + t*t*b.x
        y = u*u*a.y + 2*u*t*a.handles[1] + t*t*b.y
      } else if (kind === 64) {
        check(a.handles.length === 4, '3次曲線のハンドルがありません')
        x = u*u*u*a.x + 3*u*u*t*a.handles[0] + 3*u*t*t*a.handles[2] + t*t*t*b.x
        y = u*u*u*a.y + 3*u*u*t*a.handles[1] + 3*u*t*t*a.handles[3] + t*t*t*b.y
      }
      out.push({ x, y, flags: t < .5 ? a.flags : b.flags, handles: [], pressure: lerp(a.pressure, b.pressure), velocity: lerp(a.velocity, b.velocity), smooth: lerp(a.smooth, b.smooth), tilt: lerp(a.tilt, b.tilt), size: lerp(a.size, b.size), flow: lerp(a.flow, b.flow) })
    }
  }
  return out
}

function graph(row: ClipRow | undefined, x: number): number {
  const count = row && num(row, 'ControlNumber'), data = row?.ControlPoints
  if (!count || !(data instanceof Uint8Array)) return clamp(x)
  check(count <= 256 && data.length === count * 16, '筆圧カーブが不正です')
  const r = new Reader(data), points = Array.from({ length: count }, () => [r.number('f64'), r.number('f64')])
  // Monotone linear interpolation avoids overshoot for unknown graph variants.
  check(points.every((p, i) => p.every(v => v >= 0 && v <= 1) && (!i || p[0] >= points[i - 1][0])), '筆圧カーブが不正です')
  if (x <= points[0][0]) return points[0][1]
  for (let i = 1; i < count; i++) if (x <= points[i][0]) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i]
    return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0)
  }
  return points[count - 1][1]
}

function effector(data: ClipRow[string], p: VectorPoint, graphs: Map<number, ClipRow>): number {
  if (!(data instanceof Uint8Array) || !data.length) return 1
  const r = new Reader(data), flags = r.u32()
  let out = 1, velocity: number[] | undefined
  if (flags & 16) { const min = r.number('f32'); out *= min + (1 - min) * graph(graphs.get(r.u32()), clamp(p.pressure)) }
  if (flags & 32) velocity = [r.number('f32'), r.u32()]
  if (flags & 64) { const min = r.number('f32'); out *= min + (1 - min) * (1 - clamp(p.smooth)) }
  if (flags & 128) r.number('f32') // Random modulation is deliberately deterministic/neutral.
  if (flags & 256) { const min = r.number('f32'); out *= min + (1 - min) * clamp(Math.abs(p.tilt)) }
  if (velocity) {
    const max = r.position + 4 <= data.length ? r.number('f32') : 1
    out *= velocity[0] + (max - velocity[0]) * graph(graphs.get(velocity[1]), clamp(p.velocity))
  }
  return clamp(out)
}

/** Worker-safe software renderer. Per-stroke bounds avoid full-canvas supersampling. */
export function renderVectors(strokes: VectorStroke[], brushes: VectorBrushes, width: number, height: number,
  offsetX = 0, offsetY = 0, report: (message: string) => void = () => {}): ClipPixels {
  check(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0 && width * height <= 16 * 1024 * 1024, 'ベクター描画のキャンバスが16 Mpxを超えるか不正です')
  check(Number.isFinite(offsetX) && Number.isFinite(offsetY) && Math.abs(offsetX) <= 1000000 && Math.abs(offsetY) <= 1000000, 'ベクターレイヤーの位置が不正です')
  const output = new Float32Array(width * height * 4)
  let work = 0, sampleCount = 0
  const issues = new Set<string>()
  for (const st of strokes) {
    try {
      const b = brushes.styles.get(st.brush) ?? {}
      check(['AntiAlias', 'Hardness', 'ThicknessBase', 'FlowBase', 'IntervalBase', 'RotationBase'].every(k => Number.isFinite(num(b, k))), 'ブラシの数値が不正です')
      if (!brushes.styles.has(st.brush)) issues.add('ブラシ設定がない線を丸いペンで代替しました')
      const pattern = brushes.patterns.get(num(b, 'PatternStyle'))
      if (num(b, 'PatternStyle') && !pattern) issues.add('ブラシ先端画像がない線を丸いペンで代替しました')
      if (num(b, 'SprayFlag') || num(b, 'TexturePattern') || num(b, 'UseWaterColor') || num(b, 'WaterEdgeFlag') || ![0, 27, 31].includes(num(b, 'CompositeMode'))) issues.add('散布・紙質・混色・特殊ブラシ合成の一部を通常の線で代替しました')
      const samples = sampleVectorStroke(st), ss = num(b, 'AntiAlias', 1) ? 4 : 1
      sampleCount += samples.length
      check(sampleCount <= 1000000, 'ベクターの合計展開量が上限を超えました')
      const thickness = Math.max(.01, Math.min(1, num(b, 'ThicknessBase', 1)))
      const thinPen = !num(b, 'PatternStyle') && !num(b, 'SprayFlag') && !num(b, 'TexturePattern')
        && num(b, 'CompositeMode') === 31 && num(b, 'AntiAlias') === 1 && num(b, 'Hardness') === 1
        && thickness === 1 && st.diameter <= 4
      let patternScale = 1
      if (pattern) {
        let painted = 0
        const tall = pattern.height >= pattern.width, narrow = tall ? pattern.width : pattern.height, long = tall ? pattern.height : pattern.width
        for (let i = 0; i < narrow; i++) {
          for (let j = 0; j < long; j++) if (pattern.alpha[tall ? j * pattern.width + i : i * pattern.width + j]) { painted++; break }
        }
        patternScale = narrow / Math.max(1, painted)
      }
      const stamps = samples.map(p => {
        // A locked control already stores its final factor: do not square it.
        const size = p.size * (p.flags & 4096 ? 1 : effector(b.SizeEffector, p, brushes.graphs))
        const flow = p.flow * (p.flags & 8192 ? 1 : effector(b.FlowEffector, p, brushes.graphs))
        return { ...p, x: p.x + offsetX - (ss > 1 ? .001 : -.499), y: p.y + offsetY - (ss > 1 ? .001 : .501),
          diameter: st.diameter * size * (ss > 1 ? Math.cbrt(thickness) : 1) * patternScale * (thinPen ? ROUND_WIDTH : 1),
          alpha: clamp(flow * num(b, 'FlowBase', 1) * effector(b.OpacityEffector, p, brushes.graphs) * st.opacity * (thinPen ? ROUND_OPACITY : 1)) }
      })
      let x0 = width, y0 = height, x1 = 0, y1 = 0
      for (const p of stamps) {
        const radius = p.diameter * .72 + 1
        x0 = Math.min(x0, Math.floor(p.x - radius)); y0 = Math.min(y0, Math.floor(p.y - radius))
        x1 = Math.max(x1, Math.ceil(p.x + radius)); y1 = Math.max(y1, Math.ceil(p.y + radius))
      }
      x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(width, x1); y1 = Math.min(height, y1)
      if (x1 <= x0 || y1 <= y0) continue
      const w = (x1 - x0) * ss, h = (y1 - y0) * ss
      check(w * h <= 16 * 1024 * 1024, 'ベクター1ストロークの展開量が上限を超えました')
      work += w * h
      check(work <= 250000000, 'ベクター描画量が上限を超えました')
      const alpha = new Float32Array(w * h)
      let distance = 0, step = 0
      for (let i = 0; i < stamps.length; i++) {
        const p = stamps[i], previous = stamps[Math.max(0, i - 1)]
        distance += Math.hypot(p.x - previous.x, p.y - previous.y)
        if (i && i !== stamps.length - 1 && distance < step) continue
        distance = 0
        step = Math.max(pattern ? 1 : .25, p.diameter * num(b, 'IntervalBase', 1) / 30)
        if (p.diameter <= 0 || p.alpha <= 0) continue
        const radius = p.diameter * ss / 2, cx = (p.x - x0) * ss, cy = (p.y - y0) * ss
        const tangent = i ? Math.atan2(p.y - previous.y, p.x - previous.x) : stamps.length > 1 ? Math.atan2(stamps[1].y - p.y, stamps[1].x - p.x) : 0
        const rotation = num(b, 'RotationBase') * Math.PI / 180 + (pattern ? tangent + Math.PI / 2 : 0)
        const cos = Math.cos(rotation), sin = Math.sin(rotation), reach = radius * 1.42 + 1
        const left = Math.max(0, Math.floor(cx - reach)), right = Math.min(w, Math.ceil(cx + reach))
        const top = Math.max(0, Math.floor(cy - reach)), bottom = Math.min(h, Math.ceil(cy + reach))
        work += (right - left) * (bottom - top)
        check(work <= 250000000, 'ベクター描画量が上限を超えました')
        for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
          const dx = x + .5 - cx, dy = y + .5 - cy, lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos
          let coverage: number
          if (pattern) {
            const u = Math.floor((lx / (2 * radius) + .5) * pattern.width), v = Math.floor((ly / (2 * radius) + .5) * pattern.height)
            coverage = u >= 0 && u < pattern.width && v >= 0 && v < pattern.height ? pattern.alpha[v * pattern.width + u] / 255 : 0
          } else {
            const dist = Math.hypot(lx, ly / (ss === 1 ? thickness : 1)), hardness = clamp(num(b, 'Hardness', 1))
            coverage = ss === 1 ? +(dist <= radius) : hardness >= 1 ? clamp(radius + .5 - dist) : clamp((radius - dist) / Math.max(.001, radius * (1 - hardness)))
          }
          const at = y * w + x, a = coverage * p.alpha
          alpha[at] = pattern || num(b, 'Hardness', 1) < .9 ? alpha[at] + a * (1 - alpha[at]) : Math.max(alpha[at], a)
        }
      }
      for (let y = 0; y < h; y += ss) for (let x = 0; x < w; x += ss) {
        let a = 0
        for (let v = 0; v < ss; v++) for (let u = 0; u < ss; u++) a += alpha[(y + v) * w + x + u]
        a /= ss * ss
        if (!a) continue
        const at = ((y0 + y / ss) * width + x0 + x / ss) * 4, remain = 1 - a
        for (let c = 0; c < 3; c++) output[at + c] = (num(b, 'CompositeMode') === 27 ? 0 : st.color[c] * a) + output[at + c] * remain
        output[at + 3] = (num(b, 'CompositeMode') === 27 ? 0 : a) + output[at + 3] * remain
      }
    } catch (e) {
      issues.add(e instanceof Error ? e.message : String(e))
      if (work > 250000000 || sampleCount > 1000000) { issues.add('残りのストロークを描画できませんでした'); break }
    }
  }
  issues.forEach(report)
  const rgba = new Uint8ClampedArray(output.length)
  for (let i = 0; i < rgba.length; i += 4) {
    const a = output[i + 3]
    if (a > 0) for (let c = 0; c < 3; c++) rgba[i + c] = output[i + c] / a
    rgba[i + 3] = Math.min(255, Math.floor(a * 256))
  }
  return cropPixels({ width, height, left: 0, top: 0, rgba })
}
