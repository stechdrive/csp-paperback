import type { StateCreator } from 'zustand'
import type { CspLayer, XdtsData } from '../types'
import { parseXdts, serializeXdts } from '../utils/xdts-parser'
import { buildLayerTree } from '../engine/tree-builder'
import type { AppStore } from './index'

export interface XdtsSlice {
  xdtsData: XdtsData | null
  xdtsFileName: string | null
  loadXdts: (text: string, fileName: string) => void
  clearXdts: () => void
  downloadXdts: () => void
}

export const createXdtsSlice: StateCreator<AppStore, [], [], XdtsSlice> = (set, get) => ({
  xdtsData: null,
  xdtsFileName: null,

  loadXdts: (text, fileName) => {
    const xdts = parseXdts(text)
    set({ xdtsData: xdts, xdtsFileName: fileName })

    // パース結果をコンソールに出力（デバッグ用）
    console.log('[xdts] parsed tracks:', xdts.tracks)

    // PSD が読み込み済みなら xdts を反映してレイヤーツリーを再構築する
    const { rawPsd } = get()
    if (rawPsd) {
      const tree = buildLayerTree(rawPsd, xdts)
      set({ layerTree: tree })
      console.log('[xdts] layer tree rebuilt. animation folders detected:',
        tree.flatMap(function findAnim(l): string[] {
          return [
            ...(l.isAnimationFolder ? [l.originalName] : []),
            ...l.children.flatMap(findAnim),
          ]
        })
      )
    }
  },

  clearXdts: () => {
    set({ xdtsData: null, xdtsFileName: null })
    // xdts クリア時も PSD が読み込み済みなら xdts なしで再構築
    const { rawPsd } = get()
    if (rawPsd) {
      const tree = buildLayerTree(rawPsd, undefined)
      set({ layerTree: tree })
    }
  },

  downloadXdts: () => {
    const { xdtsData, xdtsFileName, layerTree, manualAnimFolderIds, singleMarks, virtualSets } = get()

    // シングルマーク・仮想セットの追加トラック名を収集
    const extraNames: string[] = []

    // 手動指定アニメフォルダ（xdts未検出のもの）
    for (const id of manualAnimFolderIds) {
      const layer = findLayerById(layerTree, id)
      if (layer) extraNames.push(layer.originalName)
    }

    // シングルマーク（auto = _プレフィックス自動検出は除く）
    for (const [layerId, mark] of singleMarks) {
      if (mark.origin !== 'manual') continue
      const layer = findLayerById(layerTree, layerId)
      if (layer) extraNames.push(layer.originalName)
    }

    // 仮想セット
    for (const vs of virtualSets) {
      extraNames.push(vs.name)
    }

    const text = serializeXdts(xdtsData, extraNames)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    // 元のxdtsファイル名があればそれを使う（なければPSDファイル名ベース）
    const baseName = xdtsFileName
      ? xdtsFileName.replace(/\.xdts$/i, '')
      : (get().psdFileName ?? 'output').replace(/\.psd$/i, '')
    a.download = `${baseName}.xdts`
    a.click()
    URL.revokeObjectURL(url)
  },
})

function findLayerById(layers: CspLayer[], id: string): CspLayer | null {
  for (const l of layers) {
    if (l.id === id) return l
    const found = findLayerById(l.children, id)
    if (found) return found
  }
  return null
}
