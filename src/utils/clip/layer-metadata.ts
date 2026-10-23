import type { LayerContentKind } from '../../types/layer-display'
import { readGradientKind } from './gradient'
import { num, type ClipRow } from './records'

export function isPaper(row: ClipRow): boolean { return (num(row, 'LayerType') & ~2) === 1584 }

/** Keyframed layers can clear the ordinary raster/mask type bits. */
export function hasLayerMask(row: ClipRow): boolean {
  return !!(num(row, 'LayerType') & 2) || num(row, 'TimeLineOriginalMaskMipmap') > 0 || num(row, 'LayerLayerMaskMipmap') > 0
}

export function readLayerKind(row: ClipRow, hasVectorObjects = false): LayerContentKind {
  // Paper includes the camera bit; test the complete paper type first.
  if (isPaper(row)) return 'paper'
  if (num(row, 'LayerType') & 512) return 'camera'
  if (num(row, 'LayerFolder') & 1) return 'folder'
  if (row.FilterLayerInfo) return 'adjustment'
  if (num(row, 'Manager3D') || num(row, 'Manager3DOd')) return '3d'
  if (row.TextLayerString != null || row.TextLayerStringArray != null) return 'text'
  if (row.ResizableImageInfo) return 'image-material'
  if (num(row, 'VectorNormalStrokeIndex') || hasVectorObjects) return 'vector'
  if (row.GradationFillInfo instanceof Uint8Array) {
    const kind = readGradientKind(row.GradationFillInfo)
    if (kind) return kind
  }
  return (num(row, 'LayerType') & 1) || num(row, 'TimeLineOriginalMipmap') > 0 ? 'raster' : 'other'
}

export function readPaletteColor(row: ClipRow): string | undefined {
  if (!num(row, 'LayerUsePaletteColor')) return
  const channels = ['Red', 'Green', 'Blue'].map(channel => row['LayerPalette' + channel])
  if (channels.some(value => typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 0xffffffff)) return
  return '#' + (channels as number[]).map(value => Math.round(value / 0x01010101).toString(16).padStart(2, '0')).join('')
}
