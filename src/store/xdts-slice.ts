import type { StateCreator } from 'zustand'
import type { XdtsData } from '../types'
import { parseXdts } from '../utils/xdts-parser'
import type { AppStore } from './index'

export interface XdtsSlice {
  xdtsData: XdtsData | null
  xdtsFileName: string | null
  loadXdts: (text: string, fileName: string) => void
  clearXdts: () => void
}

export const createXdtsSlice: StateCreator<AppStore, [], [], XdtsSlice> = (set) => ({
  xdtsData: null,
  xdtsFileName: null,

  loadXdts: (text, fileName) => {
    const xdts = parseXdts(text)
    set({ xdtsData: xdts, xdtsFileName: fileName })
  },

  clearXdts: () => {
    set({ xdtsData: null, xdtsFileName: null })
  },
})
