import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { flattenToCanvas } from '../engine/flatten'

/**
 * ナビゲーターキャンバスへの描画を管理するフック。
 * 全アニメーションフォルダの選択セルを合成した「1フレーム」を表示する。
 * 200msのデバウンスで再描画する。
 */
export function usePreview(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)
  const selectedCells = useAppStore(s => s.selectedCells)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRenderingRef = useRef(false)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || docWidth === 0 || docHeight === 0) return
    if (isRenderingRef.current) return

    isRenderingRef.current = true
    try {
      // selectedCells をそのまま渡す（未登録のアニメフォルダは先頭セルを使用）
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
  }, [canvasRef, layerTree, docWidth, docHeight, selectedCells, manualAnimFolderIds])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(render, 200)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [render])
}
