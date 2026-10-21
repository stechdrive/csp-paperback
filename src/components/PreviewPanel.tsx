import { useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import type { BoardView } from '../utils/output-board'
import { TiledOutputPreview } from './TiledOutputPreview'
import { useVisibleOutputs } from '../hooks/useVisibleOutputs'
import { useRenderedOutputs } from '../hooks/useRenderedOutputs'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { OutputPreview } from './OutputPreview'
import { ExportSettings } from './ExportSettings'
import { ExportSettingsPopover } from './ExportSettingsPopover'
import { NavigatorCanvas } from './NavigatorPanel'
import { TimelineSeekBar } from './TimelineSeekBar'
import { ClipTimelineSelect } from './ClipPreviewControls'
import { OutputPreviewFiles } from './OutputPreviewFiles'
import { useSampleLoader } from '../hooks/useSampleLoader'
import { QuickStartGuide } from './help/QuickStartGuide'
import { DESKTOP_RELEASES_URL } from '../platform/external-links'
import { isDesktopRuntime } from '../platform/runtime'
import styles from './PreviewPanel.module.css'

export type PreviewMode = 'output' | 'navigator'

function SampleLoadButton() {
  const { loadSample, loading } = useSampleLoader()
  const desktop = isDesktopRuntime()
  return <div className={styles.sampleSection}>
    <button className={styles.sampleButton} onClick={loadSample} disabled={loading}>
      {loading ? '読み込み中…' : 'サンプルデータで試す'}
    </button>
    {!desktop && <a className={`${styles.sampleButton} ${styles.desktopDownloadButton}`} href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">デスクトップ版をダウンロード</a>}
  </div>
}

function StartupExportSettings() {
  return <section className={styles.startupSettings} aria-labelledby="startup-settings-title" data-testid="startup-export-settings">
    <div className={styles.startupSettingsHeader}><div id="startup-settings-title" className={styles.startupSettingsTitle}>書き出し設定</div></div>
    <ExportSettings configTarget="saved" />
  </section>
}

export function PreviewPanel({ mode = 'output', onModeChange, active = true }: { mode?: PreviewMode; onModeChange?: (mode: PreviewMode) => void; active?: boolean }) {
  const clipFileName = useAppStore(s => s.clipFileName)
  const docWidth = useAppStore(s => s.docWidth)
  const timelineData = useAppStore(s => s.timelineData)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const structure = useAppStore(s => s.outputConfig.structure)
  const tiled = useAppStore(s => s.outputViewMode === 'tiles')
  const entries = useOutputPreview(active && mode === 'output' && !tiled)
  const files = useVisibleOutputs()
  const activeId = useAppStore(s => s.activeOutputId)
  const selected = useMemo(() => files.filter(file => file.outputId === activeId), [files, activeId])
  const checks = useRenderedOutputs(selected, 'check', active && mode === 'output' && tiled)
  const footerEntries = tiled ? selected.map((file, index) => ({
    flatName: file.names.flatName, path: file.names.path, outputId: file.outputId,
    diagnostics: checks[index]?.image?.diagnostics,
  })) : entries
  const boardView = useRef<BoardView | null>(null)
  const setView = (view: 'tiles' | 'single') => {
    const state = useAppStore.getState()
    if (view === 'single' && !state.activeOutputId && files[0]) state.selectOutputFile(files[0].outputId)
    state.setOutputViewMode(view); onModeChange?.('output')
  }
  const outputZoomPan = useZoomPan()
  if (docWidth === 0) {
    return <div className={styles.panel}>
      <StartupExportSettings />
      <div className={styles.emptyWrapper} data-testid="startup-guide-scroll"><div className={styles.empty}>
        {xdtsFileName && <div className={styles.xdtsBanner}><span>✓</span><span>タイムシート（{xdtsFileName}）読み込み済み</span></div>}
        <QuickStartGuide variant="startup" timelineOnlyLoaded={!!xdtsFileName} sampleAction={<SampleLoadButton />} />
      </div></div>
    </div>
  }
  return <div className={styles.panel} data-testid="main-preview" data-preview-mode={mode}>
    <div className={styles.previewToolbar} role="group" aria-label="メインプレビューの表示">
      <button type="button" aria-label="全体プレビュー" aria-pressed={mode === 'navigator'} onClick={() => onModeChange?.('navigator')}>全体</button>
      <button type="button" aria-label="出力プレビュー" aria-pressed={mode === 'output'} onClick={() => onModeChange?.('output')}>出力</button>
      <span className={styles.toolbarDivider} />
      <button type="button" aria-label="タイル表示" aria-pressed={mode === 'output' && tiled} onClick={() => setView('tiles')}>▦ タイル</button>
      <button type="button" aria-label="１点表示" aria-pressed={mode === 'output' && !tiled} onClick={() => setView('single')}>▣ １点</button>
    </div>
    {!timelineData && !clipFileName && <div className={styles.noXdtsBanner}>対応するCLIPを追加すると、アニメーションフォルダとタイムラインを読み込めます。</div>}
    <div className={styles.view} hidden={mode !== 'output'} data-testid="output-view">
      <div className={styles.outputSection}>
        {tiled ? active && mode === 'output' && <TiledOutputPreview view={boardView} /> :
          <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} zoomPan={outputZoomPan} />}
        {!tiled && outputZoomPan.zoom !== 1 && <span className={styles.zoomBadge}>{Math.round(outputZoomPan.zoom * 100)}%</span>}
      </div>
    </div>
    <div className={styles.view} hidden={mode !== 'navigator'} data-testid="navigator-view">
      <ClipTimelineSelect />
      <NavigatorCanvas enabled={active && mode === 'navigator'} />
      <TimelineSeekBar />
    </div>
    <ExportSettingsPopover>
      {mode === 'output' && footerEntries.length > 0 && <OutputPreviewFiles entries={footerEntries} structure={structure} />}
    </ExportSettingsPopover>
  </div>
}
