import type { LayerContentKind } from '../types/layer-display'
import type { CspLayer } from '../types'

export const layerKindLabels: Record<LayerContentKind, string> = {
  raster: 'ラスター', vector: 'ベクター', '3d': '3D', 'image-material': '画像素材', fill: 'ベタ塗り', gradient: 'グラデーション',
  paper: '用紙', text: 'テキスト', adjustment: '色調補正', camera: '2Dカメラフォルダ', folder: 'レイヤーフォルダ', other: 'その他のレイヤー',
  audio: '音声レイヤー', video: 'ビデオレイヤー',
}

export function isMediaKind(kind: LayerContentKind | undefined): boolean {
  return kind === 'audio' || kind === 'video'
}

export function isMediaLayer(layer: Pick<CspLayer, 'display'> | null | undefined): boolean {
  return isMediaKind(layer?.display?.kind)
}

export function mediaLayerNotice(kind: LayerContentKind): string {
  return `${layerKindLabels[kind]}：静止画出力の対象外`
}
