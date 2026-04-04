import type { StateCreator } from 'zustand'
import type { Psd } from 'ag-psd'
import type { CspLayer } from '../types'
import { readPsdFile } from '../utils/psd-io'
import { buildLayerTree } from '../engine/tree-builder'
import type { AppStore } from './index'

export interface PsdSlice {
  rawPsd: Psd | null
  psdFileName: string | null
  layerTree: CspLayer[]
  docWidth: number
  docHeight: number
  loadPsd: (buffer: ArrayBuffer, fileName: string) => void
  resetPsd: () => void
}

export const createPsdSlice: StateCreator<AppStore, [], [], PsdSlice> = (set, get) => ({
  rawPsd: null,
  psdFileName: null,
  layerTree: [],
  docWidth: 0,
  docHeight: 0,

  loadPsd: (buffer, fileName) => {
    const psd = readPsdFile(buffer)
    const xdts = get().xdtsData ?? undefined
    const tree = buildLayerTree(psd, xdts)
    set({
      rawPsd: psd,
      psdFileName: fileName,
      layerTree: tree,
      docWidth: psd.width,
      docHeight: psd.height,
      // PSD読み込み時にUI状態をリセット
      selectedLayerId: null,
      selectedCellIndex: 0,
      visibilityOverrides: new Map(),
      expandedFolders: new Set(),
    })
  },

  resetPsd: () => {
    set({
      rawPsd: null,
      psdFileName: null,
      layerTree: [],
      docWidth: 0,
      docHeight: 0,
    })
  },
})
