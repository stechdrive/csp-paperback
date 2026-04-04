import type { Layer, Psd } from 'ag-psd'
import type { BlendMode } from '../../types'

/**
 * テスト用のag-psd Layerオブジェクトを生成するファクトリ関数群
 */

export function makeCanvas(width = 100, height = 100): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export interface LayerOptions {
  name?: string
  hidden?: boolean
  opacity?: number
  blendMode?: BlendMode
  clipping?: boolean
  children?: Layer[]
  isFolder?: boolean
  isAnimationFolder?: boolean
  canvas?: HTMLCanvasElement
  top?: number
  left?: number
  width?: number
  height?: number
}

export function makeLayer(options: LayerOptions = {}): Layer {
  const {
    name = 'layer',
    hidden = false,
    opacity = 255,
    blendMode = 'normal',
    clipping = false,
    children,
    isFolder = false,
    isAnimationFolder = false,
    canvas,
    top = 0,
    left = 0,
    width = 100,
    height = 100,
  } = options

  const layer: Layer = {
    name,
    hidden,
    opacity,
    blendMode,
    clipping,
    top,
    left,
    bottom: top + height,
    right: left + width,
    canvas: canvas ?? makeCanvas(width, height),
  }

  if (isFolder || children !== undefined) {
    layer.children = children ?? []
    layer.sectionDivider = { type: 1 } // OpenFolder
  }

  if (isAnimationFolder) {
    layer.children = children ?? []
    layer.sectionDivider = { type: 1 }
    // アニメーションフォルダはxdts照合か手動指定で識別するため、
    // テストではdetectAnimationFoldersByXdtsを通じて設定する
  }

  return layer
}

export function makePsd(options: {
  width?: number
  height?: number
  children?: Layer[]
} = {}): Psd {
  const { width = 100, height = 100, children = [] } = options
  return {
    width,
    height,
    children,
  }
}

/** pass throughフォルダを作成 */
export function makePassThroughFolder(name: string, children: Layer[]): Layer {
  return makeLayer({ name, isFolder: true, blendMode: 'pass through', children })
}

/** 通常フォルダを作成 */
export function makeFolder(name: string, children: Layer[], blendMode: BlendMode = 'normal'): Layer {
  return makeLayer({ name, isFolder: true, blendMode, children })
}

/** アニメーションフォルダを作成 */
export function makeAnimationFolder(name: string, children: Layer[]): Layer {
  return makeLayer({ name, isAnimationFolder: true, children, blendMode: 'pass through' })
}
