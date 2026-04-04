import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { extractAllEntries } from '../engine/cell-extractor'
import { flattenTree } from '../engine/flatten'
import { buildZip, downloadBlob, makeZipFileName } from '../utils/zip-builder'

export interface UseExportResult {
  isExporting: boolean
  progress: number  // 0〜1
  error: string | null
  startExport: () => Promise<void>
}

export function useExport(): UseExportResult {
  const [isExporting, setIsExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const startExport = useCallback(async () => {
    const state = useAppStore.getState()
    const { docWidth, docHeight, psdFileName, outputConfig, projectSettings } = state

    if (!psdFileName || docWidth === 0) {
      setError('PSD ファイルが読み込まれていません')
      return
    }

    setIsExporting(true)
    setProgress(0)
    setError(null)

    try {
      // visibilityOverridesを反映したツリーを取得
      const tree = selectLayerTreeWithVisibility(state)

      setProgress(0.1)

      // 全出力エントリを生成（scope=allの場合）
      let entries = extractAllEntries(tree, projectSettings, docWidth, docHeight)

      setProgress(0.4)

      // scope=markedの場合はマーク済みのみに絞る
      if (outputConfig.scope === 'marked') {
        const markedIds = new Set([
          ...Array.from(state.singleMarks.keys()),
          // _プレフィックス自動マークはextractAllEntriesに含まれる
        ])
        entries = entries.filter(e => markedIds.has(e.sourceLayerId))
      }

      setProgress(0.5)

      // コンテキスト（_プレフィックス以外のルート直下フラットレイヤー）を生成して
      // 各エントリに反映する処理はcell-extractor内部で済み

      // ZIP生成
      const zipBlob = await buildZip(entries, outputConfig, psdFileName)
      setProgress(0.95)

      // ダウンロード
      downloadBlob(zipBlob, makeZipFileName(psdFileName))
      setProgress(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : '出力に失敗しました')
    } finally {
      setIsExporting(false)
    }
  }, [])

  // flattenTreeはcell-extractor内部で使用されるが、useExport自体でも
  // プレビューコンテキスト計算に使う可能性があるためimport維持
  void flattenTree

  return { isExporting, progress, error, startExport }
}
