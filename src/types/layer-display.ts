import type { MaterialEffects } from './rendering'

export type LayerContentKind = 'raster' | 'folder' | 'camera' | 'text' | 'image-material'
  | 'vector' | '3d' | 'adjustment' | 'fill' | 'gradient' | 'paper' | 'audio' | 'video' | 'other'

/** Source identification; audio/video kinds are outside still-image output. */
export interface LayerDisplayMetadata {
  kind: LayerContentKind
  paletteColor?: string
  effects?: MaterialEffects
  mask?: 'enabled' | 'disabled'
}
