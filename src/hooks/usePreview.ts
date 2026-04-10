import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeForNavigator } from '../store/selectors'
import { flattenToCanvas } from '../engine/flatten'

const THROTTLE_MS = 150

/**
 * ナビゲーターキャンバスへの描画を管理するフック。
 * 全アニメーションフォルダの選択セルを合成した「1フレーム」を表示する。
 * 150msのスロットル（trailing付き）で再描画する。
 * シークバードラッグ中も一定間隔でプレビューが更新される。
 */
export function usePreview(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const layerTree = useAppStore(selectLayerTreeForNavigator)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)
  const selectedCells = useAppStore(s => s.selectedCells)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastRenderTimeRef = useRef(0)
  const isRenderingRef = useRef(false)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || docWidth === 0 || docHeight === 0) return
    if (isRenderingRef.current) return

    isRenderingRef.current = true
    try {
      const result = flattenToCanvas(layerTree, docWidth, docHeight, 'white', selectedCells)
      canvas.width = result.width
      canvas.height = result.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(result, 0, 0)
      }
    } finally {
      isRenderingRef.current = false
    }
  }, [canvasRef, layerTree, docWidth, docHeight, selectedCells])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
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
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [render])
}
