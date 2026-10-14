import { useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility } from '../store/selectors'
import { findLayerPath } from '../utils/layerNavigation'
import { compositeRoot, flattenTree } from '../engine/flatten'
import { buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import styles from './QuickLook.module.css'

export function QuickLook() {
  const target = useAppStore(s => s.quickLookTarget)
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const sets = useAppStore(s => s.virtualSets)
  const cells = useAppStore(s => s.selectedCells)
  const width = useAppStore(s => s.docWidth), height = useAppStore(s => s.docHeight)
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const close = useAppStore(s => s.closeQuickLook)
  const layer = target ? findLayerPath(tree, target.layerId).at(-1) : undefined
  const image = useMemo(() => {
    if (!layer || !width || !height) return null
    // Peek through the root eye only. Child eyes and artwork appearance remain
    // intact; no document/visibility/history mutation is involved.
    const root = { ...layer, hidden: false, uiHidden: false }
    const vs = sets.find(vs => vs.id === target?.virtualSetId)
    const member = vs?.members.find(member => member.layerId === layer.id)
    const flats = vs ? buildMemberFlatsWithOverride(
      [member ?? { layerId: layer.id, blendMode: null, opacity: null }], [root], width, height,
      { ...vs.visibilityOverrides, [layer.id]: true }, vs.layerOverrides ?? {},
    ) : flattenTree([root], width, height, cells)
    return compositeRoot(flats, width, height, 'transparent')
  }, [layer, width, height, sets, target, cells])
  useEffect(() => {
    if (!target) return
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    return () => { element?.close(); if (previous?.isConnected) previous.focus() }
  }, [target])
  useEffect(() => {
    if (!canvas.current || !image) return
    canvas.current.width = image.width; canvas.current.height = image.height
    canvas.current.getContext('2d')?.drawImage(image, 0, 0)
  }, [image])
  if (!target) return null
  return <dialog ref={dialog} className={styles.dialog} aria-label="素材のクイックルック"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header><strong>{layer?.originalName ?? '素材が見つかりません'}</strong><button autoFocus onClick={close} aria-label="クイックルックを閉じる">✕</button></header>
    <div className={styles.image}>{image && <canvas ref={canvas} />}</div>
    <p>素材単体の確認{target.virtualSetId ? ' · 仮想セル内の設定' : ''}。合成先の背景・用紙は含みません。</p>
  </dialog>
}
