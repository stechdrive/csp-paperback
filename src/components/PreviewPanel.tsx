import React, { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { useZoomPan } from '../hooks/useZoomPan'
import { useIsMobile } from '../hooks/useIsMobile'
import { OutputPreview } from './OutputPreview'
import { ExportSettings } from './ExportSettings'
import { TimelineSeekBar } from './TimelineSeekBar'
import { useSampleLoader } from '../hooks/useSampleLoader'
import styles from './PreviewPanel.module.css'

function NavigatorCanvas({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { containerRef, contentStyle, containerStyle, onMouseDown, zoom } = useZoomPan()
  const xdtsData = useAppStore(s => s.xdtsData)
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
      {xdtsData && xdtsData.duration > 0 && <TimelineSeekBar />}
    </div>
  )
}

const NAV_HEIGHT_DEFAULT = 270
const NAV_HEIGHT_MIN = 40
const NAV_HEIGHT_MAX = 600

function SampleLoadButton() {
  const { loadSample, loading } = useSampleLoader()
  return (
    <div className={styles.sampleSection}>
      <button className={styles.sampleButton} onClick={loadSample} disabled={loading}>
        {loading ? '読み込み中…' : 'サンプルデータで試す'}
      </button>
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

export function PreviewPanel() {
  const docWidth = useAppStore(s => s.docWidth)
  const xdtsData = useAppStore(s => s.xdtsData)
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
          <span className={styles.headerSub}>書き出し設定</span>
        </div>
        <div className={styles.emptyWrapper}>
          <div className={styles.empty}>
            {/* XDTS 読み込み済みバナー */}
            {xdtsFileName && (
              <div className={styles.xdtsBanner}>
                <span className={styles.xdtsBannerCheck}>✓</span>
                <span>タイムシート（{xdtsFileName}）読み込み済み</span>
              </div>
            )}

            <div className={styles.emptyTitle}>はじめに — ClipStudioPaint 側の準備</div>

            <div className={styles.emptyStep}>
              <div className={styles.emptyStepNum}>1</div>
              <div className={styles.emptyStepBody}>
                <div className={styles.emptyStepTitle}>PSD ファイルを書き出す</div>
                <span className={styles.emptyMenuPath}>ファイル &gt; 複製を保存 &gt; PSD 書き出し</span>
              </div>
            </div>

            <div className={styles.emptyStep}>
              <div className={styles.emptyStepNum}>2</div>
              <div className={styles.emptyStepBody}>
                <div className={styles.emptyStepTitle}>タイムシート情報（XDTS）を書き出す</div>
                <span className={styles.emptyMenuPath}>ファイル &gt; アニメーション書き出し &gt; タイムシート情報</span>
                <div className={styles.emptyNote}>形式選択では CSV ではなく XDTS を選んでください。</div>
              </div>
            </div>

            <div className={styles.emptyTips}>
              <div className={styles.emptyTipsTitle}>PSDとXDTSを読み込むと、タイムライン上のアニメーションフォルダは自動検出されます。</div>
              <div className={styles.emptyTip}>
                <span className={styles.emptyTipMark}>★</span>
                <span>背景原図・撮影指示・BOOKなどを、CSPのアニメーションセル出力で自動出力させるためだけにアニメーションフォルダ化せず、別ファイルで出力。</span>
              </div>
              <div className={styles.emptyTip}>
                <span className={styles.emptyTipMark}>指定方法</span>
                <span>便利に使うならCSP側でレイヤーフォルダ名の先頭に _（アンダースコア）を付けておく。名前を変えたくない時は右ペインの★で後から指定。</span>
              </div>
              <div className={styles.emptyTip}>
                <span className={styles.emptyTipMark}>🎬</span>
                <span>XDTSにないフォルダを手動でアニメーションフォルダとして扱い、直下の子をセルとして1枚ずつ出力。</span>
              </div>
            </div>

            <hr className={styles.emptyDivider} />
            <div className={styles.emptyLoad}>
              {xdtsFileName
                ? <>PSD をドロップすると自動でアニメーションセルを検出します</>
                : <><div>PSD をドロップ、またはツールバーの「ファイルを開く」</div><div>XDTS を一緒にドロップするとセルを自動検出</div></>
              }
            </div>
            <SampleLoadButton />
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
      {/* PSD のみ読み込み済み（XDTS なし）バナー */}
      {!xdtsData && (
        <div className={styles.noXdtsBanner}>
          XDTS 未読込 — ドロップするとアニメーションセルを自動検出
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
