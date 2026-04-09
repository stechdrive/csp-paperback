import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { extractAllEntries, extractVirtualSetEntries } from '../engine/cell-extractor'
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
    const { docWidth, docHeight, docDpiX, docDpiY, psdFileName, outputConfig, projectSettings, xdtsData } = state

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
      // xdtsData を渡すことで displayName が同名 anim folder に対して (n) ナンバリングされる
      let entries = extractAllEntries(
        tree, projectSettings, docWidth, docHeight,
        outputConfig.background, outputConfig.excludeAutoMarked,
        xdtsData ?? undefined,
      )

      // 除外された工程サフィックスをポストフィルタ
      if (outputConfig.excludedProcessSuffixes.length > 0) {
        const excluded = new Set(outputConfig.excludedProcessSuffixes)
        entries = entries.filter(entry => {
          const dotIdx = entry.flatName.lastIndexOf('.')
          const base = dotIdx >= 0 ? entry.flatName.slice(0, dotIdx) : entry.flatName
          for (const suffix of excluded) {
            if (base.endsWith(suffix)) return false
          }
          return true
        })
      }

      setProgress(0.4)

      // 仮想セルのエントリを追加（常に出力）
      const vsEntries = extractVirtualSetEntries(
        tree, state.virtualSets, docWidth, docHeight, outputConfig.background
      )
      entries = [...entries, ...vsEntries]

      setProgress(0.5)

      // ZIP生成
      const zipBlob = await buildZip(entries, outputConfig, psdFileName, docDpiX, docDpiY)
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
