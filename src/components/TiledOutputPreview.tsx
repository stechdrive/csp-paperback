import { useEffect, useRef, type RefObject } from 'react'
import { useAppStore } from '../store'
import { useVisibleOutputs } from '../hooks/useVisibleOutputs'
import { mountOutputBoard, type BoardView } from '../utils/output-board'
import styles from './OutputPreview.module.css'
import { Tooltip } from './Tooltip'

export function TiledOutputPreview({ view }: { view: RefObject<BoardView | null> }) {
  const files = useVisibleOutputs()
  const outputConfig = useAppStore(s => s.outputConfig)
  const activeLabel = useAppStore(s => s.activeOutputLabel)
  const viewport = useRef<HTMLDivElement>(null), background = useRef<HTMLCanvasElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const controller = useRef<ReturnType<typeof mountOutputBoard> | null>(null)
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  useEffect(() => {
    if (!viewport.current || !background.current || !canvas.current) return
    const board = mountOutputBoard(viewport.current, background.current, canvas.current, files, view, transparent)
    controller.current = board
    return () => { board.dispose(); controller.current = null }
  }, [files, view, transparent])
  return <div ref={viewport} className={styles.board} tabIndex={0} role="listbox" aria-label="出力のタイル表示"
    aria-description="ホイールでズーム、ドラッグで移動。ダブルクリックまたはEnterで１点表示。矢印キーで選択、0で画面に収める。"
    data-testid="tiled-preview" data-count={files.length}>
    <canvas ref={background} className={styles.boardCanvas} aria-hidden="true" />
    <canvas ref={canvas} className={styles.boardCanvas} aria-hidden="true" />
    <span className={styles.srOnly} role="option" aria-selected="true">{activeLabel || '未選択'}</span>
    {!files.length && <div className={styles.boardEmpty}>表示する出力がありません</div>}
    <div className={styles.boardTools}>
      <span data-board-zoom aria-label="表示倍率" />
      <Tooltip content="画像の1ピクセルを画面の1ピクセルで表示"><button type="button" onClick={() => controller.current?.actualSize()}>100%</button></Tooltip>
      <button type="button" onClick={() => controller.current?.fit()}>画面に収める</button>
      <Tooltip content="現在の表示幅に合わせて配置を作り直す"><button type="button" onClick={() => controller.current?.fit(true)}>整列</button></Tooltip>
    </div>
  </div>
}
