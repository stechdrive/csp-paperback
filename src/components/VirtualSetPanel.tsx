import { useCallback, useEffect } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { VirtualSetItem } from './VirtualSetItem'
import { cancelVirtualVisibilityDrag } from '../utils/visibility-gesture'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import { selectLayerById } from '../store/selectors'
import type { BlendMode, CspLayer } from '../types'
import styles from './VirtualSetPanel.module.css'

function containsLayerId(layer: CspLayer, layerId: string): boolean {
  if (layer.id === layerId) return true
  return layer.children.some(child => containsLayerId(child, layerId))
}

export function VirtualSetPanel({ onClose, onPreviewOutput }: { onClose?: () => void; onPreviewOutput?: () => void }) {
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
    const layer = selectLayerById(state, selectedVsMemberId)
    if (!layer) return null
    const isInVirtualSet = vs.members.some(member => {
      const memberLayer = selectLayerById(state, member.layerId)
      return memberLayer ? containsLayerId(memberLayer, selectedVsMemberId) : false
    })
    if (!isInVirtualSet) return null
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
        {onClose && <button
          className={styles.collapseBtn}
          onClick={onClose}
          title="仮想セルを閉じる"
          aria-label="仮想セルを閉じる"
        >
          ‹
        </button>}
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
          onClick={() => selectedVirtualLayer && useAppStore.getState().openQuickLook(selectedVirtualLayer.layer.id, selectedVirtualLayer.vs.id)}>⌕</button>}
      />

      <div className={styles.list}>
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
