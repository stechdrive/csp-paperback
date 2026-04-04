import type { StateCreator } from 'zustand'
import type { XdtsData } from '../types'
import { parseXdts } from '../utils/xdts-parser'
import { buildLayerTree } from '../engine/tree-builder'
import type { AppStore } from './index'

export interface XdtsSlice {
  xdtsData: XdtsData | null
  xdtsFileName: string | null
  loadXdts: (text: string, fileName: string) => void
  clearXdts: () => void
}

export const createXdtsSlice: StateCreator<AppStore, [], [], XdtsSlice> = (set, get) => ({
  xdtsData: null,
  xdtsFileName: null,

  loadXdts: (text, fileName) => {
    const xdts = parseXdts(text)
    set({ xdtsData: xdts, xdtsFileName: fileName })

    // PSD が読み込み済みなら xdts を反映してレイヤーツリーを再構築する
    const { rawPsd } = get()
    if (rawPsd) {
      const tree = buildLayerTree(rawPsd, xdts)
      set({ layerTree: tree })
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
})
