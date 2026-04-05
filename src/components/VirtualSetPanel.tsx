import { useState, useCallback } from 'react'
import { useAppStore } from '../store'
import { useLocale } from '../i18n'
import { VirtualSetItem } from './VirtualSetItem'
import { BlendOpacityBar } from './BlendOpacityBar'
import { Tooltip } from './Tooltip'
import { selectLayerById } from '../store/selectors'
import type { BlendMode } from '../types'
import styles from './VirtualSetPanel.module.css'

export function VirtualSetPanel() {
  const virtualSets = useAppStore(s => s.virtualSets)
  const addVirtualSet = useAppStore(s => s.addVirtualSet)
  const selectedVsMemberSetId = useAppStore(s => s.selectedVsMemberSetId)
  const selectedVsMemberId = useAppStore(s => s.selectedVsMemberId)
  const setVirtualSetMemberBlendMode = useAppStore(s => s.setVirtualSetMemberBlendMode)
  const setVirtualSetMemberOpacity = useAppStore(s => s.setVirtualSetMemberOpacity)
  const { t } = useLocale()
  const [collapsed, setCollapsed] = useState(false)

  // 選択中メンバーの情報を解決
  const selectedMember = (() => {
    if (!selectedVsMemberSetId || !selectedVsMemberId) return null
    const vs = virtualSets.find(v => v.id === selectedVsMemberSetId)
    if (!vs) return null
    const member = vs.members.find(m => m.layerId === selectedVsMemberId)
    if (!member) return null
    const layer = selectLayerById(useAppStore.getState(), member.layerId)
    return { vs, member, layer }
  })()

  const effectiveBlendMode = selectedMember
    ? (selectedMember.member.blendMode ?? selectedMember.layer?.blendMode ?? 'normal')
    : 'normal'
  const effectiveOpacity = selectedMember
    ? (selectedMember.member.opacity ?? selectedMember.layer?.opacity ?? 100)
    : 100

  const handleBlendModeChange = useCallback((value: string) => {
    if (!selectedMember) return
    const { vs, member, layer } = selectedMember
    // レイヤー本来の値と同じなら override を解除（null）
    const override = value === (layer?.blendMode ?? 'normal') ? null : value
    setVirtualSetMemberBlendMode(vs.id, member.layerId, override)
  }, [selectedMember, setVirtualSetMemberBlendMode])

  const handleOpacityChange = useCallback((value: number) => {
    if (!selectedMember) return
    const { vs, member, layer } = selectedMember
    // レイヤー本来の値と同じなら override を解除（null）
    const override = value === (layer?.opacity ?? 100) ? null : value
    setVirtualSetMemberOpacity(vs.id, member.layerId, override)
  }, [selectedMember, setVirtualSetMemberOpacity])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? '展開' : '折りたたむ'}
        >
          {collapsed ? '▶' : '▼'}
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
        disabled={!selectedMember}
        showPassThrough={false}
        onBlendModeChange={handleBlendModeChange}
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
