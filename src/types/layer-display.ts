import type { MaterialEffects } from './rendering'

export type LayerContentKind = 'raster' | 'folder' | 'camera' | 'text' | 'image-material'
  | 'vector' | '3d' | 'adjustment' | 'fill' | 'gradient' | 'paper' | 'other'

/** Source metadata for identification only; never applied to rendered pixels. */
export interface LayerDisplayMetadata {
  kind: LayerContentKind
  paletteColor?: string
  effects?: MaterialEffects
  mask?: 'enabled' | 'disabled'
}
