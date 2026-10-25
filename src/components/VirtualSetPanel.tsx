import { useCallback, useEffect, useRef } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { VirtualSetItem } from './VirtualSetItem'
import { cancelVirtualVisibilityDrag } from '../utils/visibility-gesture'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import { findLayerById } from '../utils/layerNavigation'
import { resolveVirtualSetLayers } from '../utils/virtual-set-tree'
import { useDragAutoScroll } from '../hooks/useDragDrop'
import { PaneIcon } from './PaneIcon'
import type { BlendMode } from '../types'
import styles from './VirtualSetPanel.module.css'

export function VirtualSetPanel({ onClose, onPreviewOutput }: { onClose?: () => void; onPreviewOutput?: () => void }) {
  const list = useRef<HTMLDivElement>(null)
  const autoScroll = useDragAutoScroll(list, { canScroll: payload => payload.type === 'layer' || payload.type === 'cell' || payload.type === 'virtualSetMember' })
  const documentTree = useAppStore(s => s.layerTree)
  useEffect(() => cancelVirtualVisibilityDrag, [documentTree])
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)
  const selectedVsMemberSetId = useAppStore(s => s.selectedVsMemberSetId)
  const selectedVsMemberId = useAppStore(s => s.selectedVsMemberId)
  const setVirtualSetLayerBlendMode = useAppStore(s => s.setVirtualSetLayerBlendMode)
  const setVirtualSetLayerOpacity = useAppStore(s => s.setVirtualSetLayerOpacity)
  const pushHistory = useAppStore(s => s.pushHistory)
  const { t } = useLocale()

  // 選択中の仮想セル内レイヤー情報を解決
  const selectedVirtualLayer = (() => {
    if (!selectedVsMemberSetId || !selectedVsMemberId) return null
    const vs = virtualSets.find(v => v.id === selectedVsMemberSetId)
    if (!vs) return null
    const state = useAppStore.getState()
    const layer = findLayerById(resolveVirtualSetLayers(state.layerTree, vs), selectedVsMemberId)
    if (!layer) return null
    const member = vs.members.find(m => m.layerId === selectedVsMemberId) ?? null
    const override = vs.layerOverrides?.[selectedVsMemberId]
    return { vs, member, layer, override }
  })()

  const effectiveBlendMode = selectedVirtualLayer
    ? (selectedVirtualLayer.override?.blendMode
        ?? selectedVirtualLayer.member?.blendMode
        ?? selectedVirtualLayer.layer.blendMode
        ?? 'normal')
    : 'normal'
  const effectiveOpacity = selectedVirtualLayer
    ? (selectedVirtualLayer.override?.opacity
        ?? selectedVirtualLayer.member?.opacity
        ?? selectedVirtualLayer.layer.opacity
        ?? 100)
    : 100

  const handleBlendModeChange = useCallback((value: string) => {
    if (!selectedVirtualLayer) return
    setVirtualSetLayerBlendMode(selectedVirtualLayer.vs.id, selectedVirtualLayer.layer.id, value)
  }, [selectedVirtualLayer, setVirtualSetLayerBlendMode])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedVirtualLayer) return
    setVirtualSetLayerOpacity(selectedVirtualLayer.vs.id, selectedVirtualLayer.layer.id, value, { recordHistory: false })
  }, [selectedVirtualLayer, setVirtualSetLayerOpacity])

  const handleOpacityChangeStart = useCallback(() => {
    if (!selectedVirtualLayer) return
    pushHistory()
  }, [selectedVirtualLayer, pushHistory])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        {onClose && <Tooltip content="仮想セルを閉じる"><button data-tooltip="仮想セルを閉じる"
          className={styles.collapseBtn}
          onClick={onClose}
          aria-label="仮想セルを閉じる"
        >
          ‹
        </button></Tooltip>}
        <Tooltip
          content={'背景原図と任意のキャラのセルを組み合わせ、レイアウト画像を作れます。\n挿入位置はレイヤーツリーへのドラッグで指定できます。'}
          placement="bottom"
        >
          <span className={styles.title}>{t.virtualSet.title}</span>
        </Tooltip>
        <button
          className={styles.addBtn}
          onClick={() => addVirtualSet(t.virtualSet.newSetName)}
        >
          {t.virtualSet.add}
        </button>
      </div>

      {/* 選択メンバーの合成モード・不透明度コントロール */}
      <BlendOpacityBar
        blendMode={effectiveBlendMode as BlendMode}
        opacity={effectiveOpacity}
        disabled={!selectedVirtualLayer}
        showPassThrough={selectedVirtualLayer?.layer.isFolder ?? false}
        onBlendModeChange={handleBlendModeChange}
        onOpacityChangeStart={handleOpacityChangeStart}
        onOpacityChange={handleOpacityChange}
        actions={<button disabled={!selectedVirtualLayer} aria-label="仮想セルの選択素材をクイックルック"
          onClick={() => selectedVirtualLayer && useAppStore.getState().openQuickLook(selectedVirtualLayer.layer.id, selectedVirtualLayer.vs.id)}><PaneIcon kind="quicklook" /></button>}
      />

      <div ref={list} className={styles.list} {...autoScroll}>
        {virtualSets.length === 0 ? (
          <div className={styles.empty}>
            {t.virtualSet.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          virtualSets.map(vs => (
            <VirtualSetItem key={vs.id} virtualSet={vs} onPreviewOutput={onPreviewOutput} />
          ))
        )}
      </div>
    </div>
  )
}
