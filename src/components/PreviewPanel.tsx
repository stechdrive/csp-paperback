import { useAppStore } from '../store'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { useIsMobile } from '../hooks/useIsMobile'
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

export function PreviewPanel({ mode = 'output', active = true }: { mode?: PreviewMode; active?: boolean }) {
  const clipFileName = useAppStore(s => s.clipFileName)
  const docWidth = useAppStore(s => s.docWidth)
  const timelineData = useAppStore(s => s.timelineData)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const structure = useAppStore(s => s.outputConfig.structure)
  const isMobile = useIsMobile()
  const entries = useOutputPreview(active && mode === 'output')
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
    {isMobile && <ClipTimelineSelect />}
    {!timelineData && !clipFileName && <div className={styles.noXdtsBanner}>対応するCLIPを追加すると、アニメーションフォルダとタイムラインを読み込めます。</div>}
    <div className={styles.view} hidden={mode !== 'output'} data-testid="output-view">
      <div className={styles.outputSection}>
        <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} zoomPan={outputZoomPan} />
        {outputZoomPan.zoom !== 1 && <span className={styles.zoomBadge}>{Math.round(outputZoomPan.zoom * 100)}%</span>}
      </div>
    </div>
    <div className={styles.view} hidden={mode !== 'navigator'} data-testid="navigator-view">
      <NavigatorCanvas enabled={active && mode === 'navigator'} />
      {isMobile && <TimelineSeekBar />}
    </div>
    <ExportSettingsPopover>
      {mode === 'output' && entries.length > 0 && <OutputPreviewFiles entries={entries} structure={structure} />}
    </ExportSettingsPopover>
  </div>
}
