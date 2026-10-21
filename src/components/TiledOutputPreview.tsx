import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { useAppStore } from '../store'
import { useVisibleOutputs } from '../hooks/useVisibleOutputs'
import { mountOutputBoard, type BoardView } from '../utils/output-board'
import styles from './OutputPreview.module.css'
import { Tooltip } from './Tooltip'
import { OutputGateActions } from './OutputGateActions'
import { PaneIcon } from './PaneIcon'
import { useDismissableLayer } from '../hooks/useDismissableLayer'
import menuStyles from './LayerTreePanel.module.css'

export function TiledOutputPreview({ view }: { view: RefObject<BoardView | null> }) {
  const files = useVisibleOutputs()
  const outputConfig = useAppStore(s => s.outputConfig)
  const activeLabel = useAppStore(s => s.activeOutputLabel)
  const selectedCount = useAppStore(s => s.selectedOutputIds.size)
  const activeSelected = useAppStore(s => !!s.activeOutputId && s.selectedOutputIds.has(s.activeOutputId))
  const [selectionMode, setSelectionMode] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null), menuButton = useRef<HTMLButtonElement>(null)
  const menuFrame = useRef(0)
  const viewport = useRef<HTMLDivElement>(null), background = useRef<HTMLCanvasElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const controller = useRef<ReturnType<typeof mountOutputBoard> | null>(null)
  const transparent = outputConfig.format === 'png' && outputConfig.background === 'transparent'
  const closeMenu = () => { setMenu(null); viewport.current?.focus({ preventScroll: true }) }
  useDismissableLayer({ open: !!menu, content: menuRef, trigger: menuButton, closeOnTab: true, closeOnScroll: true, closeOnResize: true,
    initialFocus: () => menuRef.current?.querySelector('button:not(:disabled)'),
    onDismiss: reason => { setMenu(null); if (reason === 'escape' || reason === 'tab') viewport.current?.focus({ preventScroll: true }) } })
  useEffect(() => {
    if (!viewport.current || !background.current || !canvas.current) return
    const board = mountOutputBoard(viewport.current, background.current, canvas.current, files, view, transparent, (x, y) => {
      cancelAnimationFrame(menuFrame.current)
      menuFrame.current = requestAnimationFrame(() => setMenu({ x: Math.max(4, Math.min(x, window.innerWidth - 230)), y: Math.max(4, Math.min(y, window.innerHeight - 250)) }))
    })
    controller.current = board
    return () => { board.dispose(); controller.current = null; cancelAnimationFrame(menuFrame.current) }
  }, [files, view, transparent])
  return <div ref={viewport} className={styles.board} tabIndex={0} role="listbox" aria-label="出力のタイル表示" aria-multiselectable="true" data-selection-mode={selectionMode}
    aria-description="ホイールでズーム、ドラッグで移動。Shift＋ドラッグで範囲追加、Ctrl＋ドラッグで選択反転、Ctrl＋Shift＋ドラッグで範囲解除。ダブルクリックまたはEnterで１点表示。"
    data-testid="tiled-preview" data-count={files.length}>
    <canvas ref={background} className={styles.boardCanvas} aria-hidden="true" />
    <canvas ref={canvas} className={styles.boardCanvas} aria-hidden="true" />
    <div data-board-marquee className={styles.boardMarquee} hidden />
    <Tooltip content="この画像を出力から外す／出力に戻す"><button type="button" data-board-gate className={styles.boardGate} hidden><PaneIcon kind="close" /></button></Tooltip>
    <span className={styles.srOnly} role="option" aria-selected={activeSelected}>{activeLabel || '未選択'}</span>
    {!files.length && <div className={styles.boardEmpty}>表示する出力がありません</div>}
    <div className={styles.boardTools}>
      {selectedCount > 0 && <span>{selectedCount}選択</span>}
      <Tooltip content="範囲選択モード。タップで追加・解除、ドラッグで範囲追加。２本指で移動・ズーム。"><button type="button" aria-pressed={selectionMode} onClick={() => setSelectionMode(!selectionMode)}>範囲選択</button></Tooltip>
      <Tooltip content="タイル表示のメニュー"><button type="button" ref={menuButton} aria-label="タイル表示のメニュー" aria-haspopup="menu" aria-expanded={!!menu} onClick={event => {
        const rect = event.currentTarget.getBoundingClientRect()
        setMenu(menu ? null : { x: Math.max(4, Math.min(rect.left, window.innerWidth - 230)), y: Math.max(4, rect.top - 230) })
      }}><PaneIcon kind="menu" /></button></Tooltip>
      <span data-board-zoom aria-label="表示倍率" />
      <Tooltip content="画像の1ピクセルを画面の1ピクセルで表示"><button type="button" onClick={() => controller.current?.actualSize()}>100%</button></Tooltip>
      <button type="button" onClick={() => controller.current?.fit()}>画面に収める</button>
      <Tooltip content="現在の表示幅に合わせて配置を作り直す"><button type="button" onClick={() => controller.current?.fit(true)}>整列</button></Tooltip>
    </div>
    {menu && createPortal(<div ref={menuRef} role="menu" aria-label="選択したタイルの操作" className={menuStyles.outputMenu} style={{ left: menu.x, top: menu.y }}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus()
      }}>
      <OutputGateActions onDone={closeMenu} />
      <button role="menuitem" disabled={!files.length} onClick={() => { useAppStore.setState({ selectedOutputIds: new Set(files.map(file => file.outputId)) }); closeMenu() }}>表示中の項目をすべて選択</button>
      <button role="menuitem" disabled={!selectedCount} onClick={() => { useAppStore.setState({ selectedOutputIds: new Set() }); closeMenu() }}>選択を解除</button>
    </div>, document.body)}
  </div>
}
