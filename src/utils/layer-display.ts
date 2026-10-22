import type { LayerContentKind } from '../types/layer-display'

export const layerKindLabels: Record<LayerContentKind, string> = {
  raster: 'ラスター', vector: 'ベクター', '3d': '3D', 'image-material': '画像素材', fill: 'ベタ塗り', gradient: 'グラデーション',
  paper: '用紙', text: 'テキスト', adjustment: '色調補正', camera: '2Dカメラフォルダ', folder: 'レイヤーフォルダ', other: 'その他のレイヤー',
}
