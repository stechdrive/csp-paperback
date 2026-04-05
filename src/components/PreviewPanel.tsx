import { useRef, useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { usePreview } from '../hooks/usePreview'
import { useOutputPreview } from '../hooks/useOutputPreview'
import { OutputPreview } from './OutputPreview'
import { ExportSettings } from './ExportSettings'
import styles from './PreviewPanel.module.css'

function NavigatorCanvas({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  usePreview(canvasRef)
  return (
    <div className={styles.navigatorSection} style={{ height }}>
      <div className={styles.navigatorLabel}>全体（ナビゲーター）</div>
      <canvas ref={canvasRef} className={styles.navigatorCanvas} />
    </div>
  )
}

const NAV_HEIGHT_DEFAULT = 160
const NAV_HEIGHT_MIN = 40
const NAV_HEIGHT_MAX = 600

export function PreviewPanel() {
  const docWidth = useAppStore(s => s.docWidth)
  const xdtsData = useAppStore(s => s.xdtsData)
  const xdtsFileName = useAppStore(s => s.xdtsFileName)
  const focusedAnimFolderId = useAppStore(s => s.focusedAnimFolderId)
  const structure = useAppStore(s => s.outputConfig.structure)
  const entries = useOutputPreview()

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
                <div className={styles.emptyNote}>※ タイムライン未登録でも出力したい素材は、フォルダ名の頭に _ をつけるか（例：_BG / _BOOK / _原図 など）右ペインの ★ ボタンで単体書き出しにマークしてください</div>
                <div className={styles.emptyNote}>※ 以前に保存した <strong>.cspb</strong> ファイルがあれば、XDTSの代わりに使えます（XDTS・マーク・仮想セット設定を一括復元）</div>
              </div>
            </div>

            <hr className={styles.emptyDivider} />
            <div className={styles.emptyLoad}>
              {xdtsFileName
                ? <>PSD をドロップすると自動でアニメーションセルを検出します</>
                : <><div>PSD をドロップ、またはツールバーの「ファイルを開く」</div><div>XDTS / CSPB を一緒にドロップするとセルを自動検出</div></>
              }
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>プレビュー</span>
        <span className={styles.headerSub}>書き出し設定</span>
      </div>
      {/* PSD のみ読み込み済み（XDTS なし）バナー */}
      {!xdtsData && (
        <div className={styles.noXdtsBanner}>
          XDTS / CSPB 未読込 — ドロップするとアニメーションセルを自動検出
        </div>
      )}
      <NavigatorCanvas height={navHeight} />
      <div className={styles.resizeHandle} onMouseDown={handleResizeMouseDown} />
      <ExportSettings />
      <div className={styles.divider}>
        <span className={styles.dividerLabel}>出力プレビュー</span>
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
        <OutputPreview entries={entries} focusedAnimFolderId={focusedAnimFolderId} />
      </div>
    </div>
  )
}
