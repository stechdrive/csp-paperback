import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { flattenToCanvas } from '../engine/flatten'

/**
 * プレビューキャンバスへの描画を管理するフック
 * ストアの変更を監視し、200msのデバウンスで再描画する
 */
export function usePreview(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const layerTree = useAppStore(selectLayerTreeWithVisibility)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)
  const selectedCellIndex = useAppStore(s => s.selectedCellIndex)
  const selectedLayerId = useAppStore(s => s.selectedLayerId)
  const manualAnimFolderIds = useAppStore(s => s.manualAnimFolderIds)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isRenderingRef = useRef(false)

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || docWidth === 0 || docHeight === 0) return
    if (isRenderingRef.current) return

    isRenderingRef.current = true
    try {
      // 選択セルインデックスマップを構築
      const selectedCellIndices = new Map<string, number>()
      if (selectedLayerId) {
        selectedCellIndices.set(selectedLayerId, selectedCellIndex)
      }
      // 手動指定アニメフォルダも適用
      for (const id of manualAnimFolderIds) {
        if (!selectedCellIndices.has(id)) {
          selectedCellIndices.set(id, 0)
        }
      }

      const result = flattenToCanvas(layerTree, docWidth, docHeight, 'white', selectedCellIndices)

      // プレビューキャンバスに描画
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
  }, [canvasRef, layerTree, docWidth, docHeight, selectedCellIndex, selectedLayerId, manualAnimFolderIds])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(render, 200)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [render])
}
