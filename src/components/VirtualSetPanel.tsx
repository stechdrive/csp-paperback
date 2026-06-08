import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n/locale'
import { VirtualSetItem } from './VirtualSetItem'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import { selectLayerById } from '../store/selectors'
import type { BlendMode, CspLayer } from '../types'
import styles from './VirtualSetPanel.module.css'

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.expandChevron} ${open ? styles.expandChevronOpen : ''}`}
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M3 2 L7 5 L3 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function containsLayerId(layer: CspLayer, layerId: string): boolean {
  if (layer.id === layerId) return true
  return layer.children.some(child => containsLayerId(child, layerId))
}

export function VirtualSetPanel() {
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)
  const selectedVsMemberSetId = useAppStore(s => s.selectedVsMemberSetId)
  const selectedVsMemberId = useAppStore(s => s.selectedVsMemberId)
  const setVirtualSetLayerBlendMode = useAppStore(s => s.setVirtualSetLayerBlendMode)
  const setVirtualSetLayerOpacity = useAppStore(s => s.setVirtualSetLayerOpacity)
  const pushHistory = useAppStore(s => s.pushHistory)
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(false)

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
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? '展開' : '折りたたむ'}
        >
          <Chevron open={!collapsed} />
        </button>
        <Tooltip
          content={'PSD のレイヤーを自由に組み合わせ、1枚のセルとして出力する仮想グループ。\n挿入位置はレイヤーツリーへのドラッグで指定できます。'}
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
      />

      <div className={`${styles.list} ${collapsed ? styles.listCollapsed : ''}`}>
        {virtualSets.length === 0 ? (
          <div className={styles.empty}>
            {t.virtualSet.empty.split('\n').map((line, i) => (
              <span key={i}>{line}{i === 0 && <br />}</span>
            ))}
          </div>
        ) : (
          virtualSets.map(vs => (
            <VirtualSetItem key={vs.id} virtualSet={vs} />
          ))
        )}
      </div>
    </div>
  )
}
