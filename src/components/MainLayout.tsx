import { useRef, useState, type PointerEvent } from 'react'
import { VirtualSetPanel } from './VirtualSetPanel'
import { PreviewPanel, type PreviewMode } from './PreviewPanel'
import { NavigatorPanel } from './NavigatorPanel'
import { LayerTreePanel } from './LayerTreePanel'
import { useIsMobile } from '../hooks/useIsMobile'
import styles from './MainLayout.module.css'

type MobileTab = 'virtual' | 'preview' | 'layer'
interface MainLayoutProps {
  previewMode: PreviewMode
  onPreviewModeChange: (mode: PreviewMode) => void
  virtualPanelOpen: boolean
  onCloseVirtualPanel: () => void
  activeTab: MobileTab
  onActiveTabChange: (tab: MobileTab) => void
}
export function MainLayout({ previewMode, onPreviewModeChange, virtualPanelOpen, onCloseVirtualPanel, activeTab, onActiveTabChange }: MainLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(240)
  const [rightWidth, setRightWidth] = useState(300)
  const layoutRef = useRef<HTMLDivElement>(null)
  const isMobile = useIsMobile()
  const resize = (event: PointerEvent<HTMLDivElement>, side: 'left' | 'right') => {
    event.preventDefault()
    const handle = event.currentTarget
    handle.setPointerCapture(event.pointerId)
    const startX = event.clientX
    const startWidth = side === 'left' ? leftWidth : rightWidth
    const available = (layoutRef.current?.clientWidth ?? window.innerWidth) - 248
      - (side === 'left' ? rightWidth : virtualPanelOpen ? leftWidth : 0)
    const onMove = (move: globalThis.PointerEvent) => {
      const width = Math.max(220, Math.min(Math.max(220, available), startWidth + (move.clientX - startX) * (side === 'left' ? 1 : -1)))
      if (side === 'left') setLeftWidth(width)
      else setRightWidth(width)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }
  return (
    <div ref={layoutRef} className={styles.layout} data-mobile-tab={activeTab}>
      <div className={styles.leftPane} style={{ width: leftWidth }} hidden={!virtualPanelOpen} data-testid="virtual-panel">
        <VirtualSetPanel onClose={onCloseVirtualPanel} />
      </div>
      {virtualPanelOpen && <div className={styles.resizeHandle} onPointerDown={event => resize(event, 'left')} />}
      <div className={styles.centerPane}>
        <PreviewPanel mode={previewMode} active={!isMobile || activeTab === 'preview'} />
      </div>
      <div className={styles.resizeHandle} onPointerDown={event => resize(event, 'right')} />
      <div className={styles.rightPane} style={{ width: rightWidth }} data-testid="source-panel">
        <NavigatorPanel enabled={!isMobile || activeTab === 'layer'} />
        <div className={styles.layerPane}><LayerTreePanel onPreviewOutput={() => onPreviewModeChange('output')} /></div>
      </div>
      <nav className={styles.mobileTabBar} aria-label="作業パネル">
        {([
          ['virtual', '⊞', '仮想セル'], ['preview', '◧', 'プレビュー'], ['layer', '☰', 'レイヤー'],
        ] as const).map(([tab, icon, label]) => <button
          key={tab}
          className={[styles.mobileTab, activeTab === tab ? styles.mobileTabActive : ''].join(' ')}
          aria-pressed={activeTab === tab}
          onClick={() => onActiveTabChange(tab)}
        >
          <span className={styles.mobileTabIcon} aria-hidden="true">{icon}</span>
          <span className={styles.mobileTabLabel}>{label}</span>
        </button>)}
      </nav>
    </div>
  )
}
