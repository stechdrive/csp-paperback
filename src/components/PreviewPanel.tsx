import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import type { BoardView } from '../utils/output-board'
import { TiledOutputPreview } from './TiledOutputPreview'
import { useVisibleOutputs } from '../hooks/useVisibleOutputs'
import { useRenderedOutputs } from '../hooks/useRenderedOutputs'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { showOutputView } from '../utils/output-view'
import { OutputPreview } from './OutputPreview'
import { NavigatorCanvas } from './NavigatorPanel'
import { TimelineSeekBar } from './TimelineSeekBar'
import { ClipTimelineSelect } from './ClipPreviewControls'
import { DiagnosticWarning } from './DiagnosticWarning'
import { Tooltip } from './Tooltip'
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

export function PreviewPanel({ mode = 'output', onModeChange, active = true }: { mode?: PreviewMode; onModeChange?: (mode: PreviewMode) => void; active?: boolean }) {
  const clipFileName = useAppStore(s => s.clipFileName)
  const docWidth = useAppStore(s => s.docWidth)
  const docHeight = useAppStore(s => s.docHeight)
  const document = useAppStore(s => s.clipDocument ?? s.rawPsd)
  const timelineData = useAppStore(s => s.timelineData)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const tiled = useAppStore(s => s.outputViewMode === 'tiles')
  const entries = useOutputPreview(active && mode === 'output' && !tiled)
  const files = useVisibleOutputs()
  const activeId = useAppStore(s => s.activeOutputId)
  const selected = useMemo(() => files.filter(file => file.outputId === activeId), [files, activeId])
  const checks = useRenderedOutputs(selected, 'check', active && mode === 'output' && tiled)
  const selectedCheck = checks[0]
  const boardView = useRef<BoardView | null>(null)
  const [outputMenuTarget, setOutputMenuTarget] = useState<HTMLDivElement | null>(null)
  const setView = (view: 'tiles' | 'single') => {
    showOutputView(view, files); onModeChange?.('output')
  }
  const outputZoomPan = useZoomPan({ width: docWidth, height: docHeight }, document)
  if (docWidth === 0) {
    return <div className={styles.panel}>
      <div className={styles.emptyWrapper} data-testid="startup-guide-scroll"><div className={styles.empty}>
        {xdtsFileName && <div className={styles.xdtsBanner}><span>✓</span><span>タイムシート（{xdtsFileName}）読み込み済み</span></div>}
        <QuickStartGuide variant="startup" timelineOnlyLoaded={!!xdtsFileName} sampleAction={<SampleLoadButton />} />
      </div></div>
    </div>
  }
  return <div className={styles.panel} data-testid="main-preview" data-preview-mode={mode}>
    <div className={styles.previewToolbar} role="group" aria-label="メインプレビューの表示">
      <Tooltip content="現在のフレームのセルの重なりと、レイヤーの表示状態を確認" placement="bottom"><button type="button" aria-pressed={mode === 'navigator'} onClick={() => onModeChange?.('navigator')}>キャンバス</button></Tooltip>
      <Tooltip content="書き出し設定を反映した、各画像の仕上がりを確認" placement="bottom"><button type="button" aria-pressed={mode === 'output'} onClick={() => onModeChange?.('output')}>書き出し画像</button></Tooltip>
      {mode === 'output' && <>
        <span className={styles.toolbarDivider} />
        <Tooltip content="タイル表示" placement="bottom"><button type="button" className={styles.viewModeButton} aria-label="タイル表示" aria-pressed={tiled} onClick={() => setView('tiles')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z" /></svg></button></Tooltip>
        <Tooltip content="１点表示" placement="bottom"><button type="button" className={styles.viewModeButton} aria-label="１点表示" aria-pressed={!tiled} onClick={() => setView('single')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h18v18H3Z" /></svg></button></Tooltip>
      </>}
      <div className={styles.outputMenuTarget} ref={setOutputMenuTarget} />
    </div>
    {!timelineData && !clipFileName && <div className={styles.noXdtsBanner}>対応するCLIPを追加すると、アニメーションフォルダとタイムラインを読み込めます。</div>}
    <div className={styles.view} hidden={mode !== 'output'} data-testid="output-view">
      <div className={styles.outputSection}>
        {tiled ? active && mode === 'output' && <TiledOutputPreview view={boardView} menuTarget={outputMenuTarget} /> :
          <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} zoomPan={outputZoomPan} />}
        {tiled && mode === 'output' && (selectedCheck?.error || !!selectedCheck?.image?.diagnostics?.length) && <div className={styles.outputWarning} data-testid="preview-warning">
          <DiagnosticWarning issues={selectedCheck.image?.diagnostics} error={selectedCheck.error} />
        </div>}
      </div>
    </div>
    <div className={styles.view} hidden={mode !== 'navigator'} data-testid="navigator-view">
      <ClipTimelineSelect />
      <NavigatorCanvas enabled={active && mode === 'navigator'} />
      <TimelineSeekBar />
    </div>
  </div>
}
