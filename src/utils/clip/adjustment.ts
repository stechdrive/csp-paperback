// FilterLayerInfo framing: Aodaruma/clipfile-rs; equations: wamsoft/clipparse (MIT).
import { check, Reader } from './binary'
import type { MaterialAdjustment } from '../../types/rendering'

export function readAdjustment(bytes: Uint8Array): MaterialAdjustment {
  const r = new Reader(bytes), kind = r.u32(), length = r.u32()
  check(length === bytes.length - 8, '色調補正のデータ長が不正です')
  if (kind === 6 && length === 0) return { kind: 'invert' }
  if (kind === 8 && length === 4) {
    const threshold = r.u32()
    check(threshold <= 255, '2値化のしきい値が範囲外です')
    return { kind: 'threshold', threshold }
  }
  throw new Error(`色調補正 ${kind} の画素演算は未対応です。ほかの素材は引き続き書き出せます`)
}
