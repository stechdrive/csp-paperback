import type { StateCreator } from 'zustand'
import type { CspLayer, XdtsData } from '../types'
import { parseXdts, serializeXdts } from '../utils/xdts-parser'
import { detectAnimationFoldersByXdts, clearXdtsAnimFolders } from '../engine/tree-builder'
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

    // PSD 読み込み前に XDTS が来た場合は loadPsd 側で反映されるので何もしない
    const { layerTree } = get()
    if (layerTree.length === 0) return

    // 既存ツリーのフラグをインプレースで更新（ツリー再構築しない＝レイヤーIDを維持）
    clearXdtsAnimFolders(layerTree)
    detectAnimationFoldersByXdts(layerTree, xdts)
    // シャローコピーで再レンダリングをトリガー
    set({ layerTree: [...layerTree] })
  },

  clearXdts: () => {
    const { layerTree } = get()
    set({ xdtsData: null, xdtsFileName: null })
    if (layerTree.length > 0) {
      clearXdtsAnimFolders(layerTree)
      set({ layerTree: [...layerTree] })
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
