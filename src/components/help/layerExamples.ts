import type { HelpLayer } from './HelpLayerTree'

const directionLayers: readonly HelpLayer[] = [
  { id: 'pan', name: '_PAN', kind: 'folder', autoMarked: true, note: '個別書き出し', output: '_PAN.jpg' },
  { id: 'sl', name: '_SL', kind: 'folder', autoMarked: true, note: '個別書き出し', output: '_SL.jpg' },
]

export const individualLayers: readonly HelpLayer[] = [
  { id: 'original', name: '_原図', kind: 'folder', note: '整理用フォルダ', children: [
    { id: 'book', name: '_BOOK1', kind: 'folder', autoMarked: true, note: '個別書き出し', output: '_BOOK1.jpg' },
    { id: 'bg', name: '_BG', kind: 'folder', autoMarked: true, note: '個別書き出し', output: '_BG.jpg' },
  ] },
  { id: 'directions', name: '_撮影指示', kind: 'folder', note: '整理用フォルダ', children: directionLayers },
]

const director: HelpLayer = { id: 'director', name: '演出', kind: 'folder', note: '工程フォルダ：_e', children: [
  { id: 'director-a', name: 'A', kind: 'animation', note: 'タイムライントラックA', children: [
    { id: 'director-a1', name: '1', kind: 'cell', note: '演出修正', output: 'A1_e.jpg' },
  ] },
] }

const drawingA: HelpLayer = { id: 'drawing-a', name: 'A', kind: 'animation', note: 'タイムライントラックA', children: [
  { id: 'drawing-a1', name: '1', kind: 'cell', note: '作画本体', output: 'A1.jpg' },
] }

export const celProcessLayers: readonly HelpLayer[] = [
  { id: 'drawing-b', name: 'B', kind: 'animation', note: 'タイムライントラックB', children: [
    { id: 'drawing-b1', name: '1', kind: 'cell', note: 'セルフォルダ', children: [
      { id: 'supervisor', name: '_s', kind: 'folder', autoMarked: true, note: '作監修正：本体から分離', output: 'B1_s.jpg', children: [
        { id: 'correction', name: '作監修正', kind: 'layer' },
      ] },
      { id: 'line', name: '線画1', kind: 'layer', note: '線画と影を合わせた作画本体', output: 'B1.jpg' },
      { id: 'shadow', name: '影', kind: 'layer', note: 'B1本体へ入る' },
    ] },
  ] },
]

export const trackProcessLayers: readonly HelpLayer[] = [
  { id: 'lo', name: 'LO', kind: 'folder', note: '整理用フォルダ', children: [
    director,
    { id: 'drawing', name: '作画', kind: 'folder', note: '本体の作画フォルダ', children: [drawingA] },
  ] },
]

export const sampleLayers: readonly HelpLayer[] = [
  { id: 'memo', name: 'memo', kind: 'layer', note: '表示中：各画像へ重なる' },
  { id: 'frame', name: 'Frame', kind: 'folder', note: '表示中：各画像へ重なる' },
  individualLayers[1],
  { id: 'lo', name: 'LO', kind: 'folder', note: '整理用フォルダ', children: [
    director,
    { id: 'drawing', name: '作画', kind: 'folder', note: '本体の作画フォルダ', children: [...celProcessLayers, drawingA] },
  ] },
  individualLayers[0],
  { id: 'pool', name: '_pool', kind: 'folder', hidden: true, note: '非表示：どの画像にも入らない' },
  { id: 'paper', name: '用紙', kind: 'layer', hidden: true, note: '非表示：どの画像にも入らない' },
]

export const clipAnimationLayers: readonly HelpLayer[] = [
  { id: 'clip-a', name: 'A', kind: 'animation', note: 'CLIPから直接認識', children: [
    { id: 'clip-a1', name: '1', kind: 'cell', output: 'A1.jpg' },
    { id: 'clip-a2', name: '2', kind: 'cell', output: 'A2.jpg' },
  ] },
]

export const manualAnimationLayers: readonly HelpLayer[] = [
  { id: 'effect', name: 'エフェクト', kind: 'animation', note: '🎬で手動指定した状態', children: [
    { id: 'effect1', name: '1', kind: 'cell', output: 'エフェクト1.jpg' },
    { id: 'effect2', name: '2', kind: 'cell', output: 'エフェクト2.jpg' },
  ] },
]

export const defaultDirectionLayers: readonly HelpLayer[] = [
  { id: 'directions', name: '撮影指示', kind: 'folder', note: '整理用フォルダ', children: directionLayers },
]

export const studioDirectionLayers: readonly HelpLayer[] = [
  { id: 'camera', name: 'CAMERA', kind: 'folder', note: '登録した整理用フォルダ', children: directionLayers },
]
