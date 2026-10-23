import { useEffect, useRef, useCallback, useState } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeForNavigator } from '../store/selectors'
import { NavigatorPreviewCache } from '../engine/navigator-preview-cache'
import { flattenTree } from '../engine/flatten'
import { collectRenderMaterials } from '../engine/material-dependencies'
import { withPreparedMaterials } from '../engine/material-cache'

const THROTTLE_MS = 150
const previewCache = new NavigatorPreviewCache()
let activeViews = 0

/**
 * ナビゲーターキャンバスへの描画を管理するフック。
 * 全アニメーションフォルダの選択セルを合成した「1フレーム」を表示する。
 * 150msのスロットル（trailing付き）で再描画する。
 * シークバードラッグ中も一定間隔でプレビューが更新される。
 */
export function usePreview(canvasRef: React.RefObject<HTMLCanvasElement | null>, enabled = true) {
  const layerTree = useAppStore(selectLayerTreeForNavigator)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)
  const selectedCells = useAppStore(s => s.selectedCells)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRenderTimeRef = useRef(0)
  const generation = useRef(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled) {
      const canvas = canvasRef.current
      if (canvas) { canvas.width = 1; canvas.height = 1 }
      return
    }
    activeViews++
    return () => {
      activeViews--
      if (activeViews === 0) previewCache.clear()
    }
  }, [enabled, canvasRef])

  const render = useCallback(async () => {
    const current = ++generation.current
    const canvas = canvasRef.current
    if (!canvas || !enabled) return
    if (docWidth === 0 || docHeight === 0) {
      previewCache.clear()
      canvas.width = 0
      canvas.height = 0
      return
    }
    try {
    const layers = collectRenderMaterials(() => flattenTree(layerTree, docWidth, docHeight, selectedCells))
    const result = await withPreparedMaterials(layers, () => {
      if (current !== generation.current) return null
      return previewCache.get(layerTree, docWidth, docHeight, selectedCells)
    }, () => current !== generation.current)
    if (!result || current !== generation.current) return
    setError(null)
    // Preserve the backing store when only the image changes.
    if (canvas.width !== result.width) canvas.width = result.width
    if (canvas.height !== result.height) canvas.height = result.height
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(result, 0, 0)
    }
    } catch (error) {
      if (current !== generation.current) return
      canvas.width = 1; canvas.height = 1
      setError(error instanceof Error ? error.message : 'キャンバスを描画できませんでした')
    }
  }, [canvasRef, layerTree, docWidth, docHeight, selectedCells, enabled])

  useEffect(() => {
    const token = generation
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!enabled) return
    const now = Date.now()
    const elapsed = now - lastRenderTimeRef.current
    if (elapsed >= THROTTLE_MS) {
      lastRenderTimeRef.current = now
      render()
    } else {
      timerRef.current = setTimeout(() => {
        lastRenderTimeRef.current = Date.now()
        render()
      }, THROTTLE_MS - elapsed)
    }
    return () => {
      token.current++
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [render, enabled])
  return error
}
