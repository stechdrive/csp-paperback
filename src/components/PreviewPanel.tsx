import React, { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { useIsMobile } from '../hooks/useIsMobile'
import { OutputPreview } from './OutputPreview'
import { ExportSettings } from './ExportSettings'
import { TimelineSeekBar } from './TimelineSeekBar'
import { ClipSourceStatus } from './ClipSourceStatus'
import { useSampleLoader } from '../hooks/useSampleLoader'
import { QuickStartGuide } from './help/QuickStartGuide'
import { DESKTOP_RELEASES_URL } from '../platform/external-links'
import { isDesktopRuntime } from '../platform/runtime'
import styles from './PreviewPanel.module.css'

function NavigatorCanvas({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { containerRef, contentStyle, containerStyle, onMouseDown, zoom } = useZoomPan()
  const timelineData = useAppStore(s => s.timelineData)
  usePreview(canvasRef)

  return (
    <div className={styles.navigatorSection} style={{ height }}>
      <div className={styles.navigatorLabel}>
        全体（ナビゲーター）
        {zoom !== 1 && <span className={styles.zoomBadge}>{Math.round(zoom * 100)}%</span>}
      </div>
      <div
        ref={containerRef as React.RefCallback<HTMLDivElement>}
        className={styles.navigatorViewport}
        style={containerStyle}
        onMouseDown={onMouseDown}
      >
        <canvas ref={canvasRef} className={styles.navigatorCanvas} style={contentStyle} />
      </div>
      {timelineData && timelineData.duration > 0 && <TimelineSeekBar />}
    </div>
  )
}

const NAV_HEIGHT_DEFAULT = 270
const NAV_HEIGHT_MIN = 40
const NAV_HEIGHT_MAX = 600

function SampleLoadButton() {
  const { loadSample, loading } = useSampleLoader()
  const desktop = isDesktopRuntime()

  return (
    <div className={styles.sampleSection}>
      <button className={styles.sampleButton} onClick={loadSample} disabled={loading}>
        {loading ? '読み込み中…' : 'サンプルデータで試す'}
      </button>
      {!desktop && (
        <a
          className={`${styles.sampleButton} ${styles.desktopDownloadButton}`}
          href={DESKTOP_RELEASES_URL}
          target="_blank"
          rel="noreferrer"
        >
          デスクトップ版をダウンロード
        </a>
      )}
    </div>
  )
}

function ExportSettingsDrawer() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  if (!isMobile) {
    return <ExportSettings />
  }

  return (
    <div className={styles.drawerWrapper}>
      <button
        className={styles.drawerToggle}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <span className={styles.drawerToggleIcon}>{open ? '▼' : '▲'}</span>
        書き出し設定
      </button>
      <div className={`${styles.drawerBody} ${open ? styles.drawerOpen : ''}`}>
        <ExportSettings />
      </div>
      {open && <div className={styles.drawerOverlay} onClick={() => setOpen(false)} />}
    </div>
  )
}

function StartupExportSettings() {
  return (
    <section
      className={styles.startupSettings}
      aria-labelledby="startup-settings-title"
      data-testid="startup-export-settings"
    >
      <div className={styles.startupSettingsHeader}>
        <div id="startup-settings-title" className={styles.startupSettingsTitle}>
          書き出し設定
        </div>
      </div>
      <ExportSettings configTarget="saved" />
    </section>
  )
}

export function PreviewPanel() {
  const clipFileName = useAppStore(s => s.clipFileName)
  const docWidth = useAppStore(s => s.docWidth)
  const timelineData = useAppStore(s => s.timelineData)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const structure = useAppStore(s => s.outputConfig.structure)
  const entries = useOutputPreview()
  const outputZoomPan = useZoomPan()

  const [navHeight, setNavHeight] = useState(NAV_HEIGHT_DEFAULT)
  const resizingRef = useRef(false)

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    resizingRef.current = true
    const startY = e.clientY
    const startH = navHeight

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return
      const h = Math.max(NAV_HEIGHT_MIN, Math.min(NAV_HEIGHT_MAX, startH + ev.clientY - startY))
      setNavHeight(h)
    }
    const onUp = () => {
      resizingRef.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [navHeight])

  const handleResizeTouchStart = useCallback((e: React.TouchEvent) => {
    resizingRef.current = true
    const startY = e.touches[0].clientY
    const startH = navHeight

    const onMove = (ev: TouchEvent) => {
      if (!resizingRef.current) return
      ev.preventDefault()
      const h = Math.max(NAV_HEIGHT_MIN, Math.min(NAV_HEIGHT_MAX, startH + ev.touches[0].clientY - startY))
      setNavHeight(h)
    }
    const onEnd = () => {
      resizingRef.current = false
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [navHeight])

  if (docWidth === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>
          <span>プレビュー</span>
        </div>
        <StartupExportSettings />
        <div className={styles.emptyWrapper} data-testid="startup-guide-scroll">
          <div className={styles.empty}>
            {/* XDTS 読み込み済みバナー */}
            {xdtsFileName && (
              <div className={styles.xdtsBanner}>
                <span className={styles.xdtsBannerCheck}>✓</span>
                <span>タイムシート（{xdtsFileName}）読み込み済み</span>
              </div>
            )}

            <QuickStartGuide
              variant="startup"
              timelineOnlyLoaded={!!xdtsFileName}
              sampleAction={<SampleLoadButton />}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>プレビュー</span>
      </div>
      <ClipSourceStatus />
      {/* PSD のみ読み込み済み（XDTS なし）バナー */}
      {!timelineData && !clipFileName && (
        <div className={styles.noXdtsBanner}>
          対応するCLIPを追加すると、アニメーションフォルダとタイムラインを読み込めます。
        </div>
      )}
      <NavigatorCanvas height={navHeight} />
      <div className={styles.resizeHandle} onMouseDown={handleResizeMouseDown} onTouchStart={handleResizeTouchStart} />
      <ExportSettingsDrawer />
      <div className={styles.divider}>
        <span className={styles.dividerLabel}>出力プレビュー</span>
        {outputZoomPan.zoom !== 1 && (
          <span className={styles.outputZoomBadge}>{Math.round(outputZoomPan.zoom * 100)}%</span>
        )}
        {entries.length > 0 && (
          <div className={styles.fileNames}>
            {entries.map((e, i) => (
              <span key={i} className={styles.fileName} title={structure === 'hierarchy' ? e.path : e.flatName}>
                {structure === 'hierarchy' ? e.path : e.flatName}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className={styles.outputSection}>
        <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} zoomPan={outputZoomPan} />
      </div>
    </div>
  )
}
