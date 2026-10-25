import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../store'
import { selectLayerTreeWithVisibility, selectOutputAliasTargets } from '../store/selectors'
import { describeOutputSource } from '../utils/output-alias'
import { findLayerPath } from '../utils/layerNavigation'
import { compositeRoot, flattenTree } from '../engine/flatten'
import { buildMemberFlatsWithOverride } from '../utils/virtual-set-utils'
import { resolveVirtualSetLayers } from '../utils/virtual-set-tree'
import { collectRenderMaterials } from '../engine/material-dependencies'
import { withPreparedMaterials } from '../engine/material-cache'
import { withCanvasResources } from '../engine/render-resources'
import styles from './QuickLook.module.css'

export function QuickLook() {
  const target = useAppStore(s => s.quickLookTarget)
  const tree = useAppStore(selectLayerTreeWithVisibility)
  const alias = useAppStore(s => target && selectOutputAliasTargets(s).has(target.layerId) ? s.outputAliases.get(target.layerId) : undefined)
  const sets = useAppStore(s => s.virtualSets)
  const cells = useAppStore(s => s.selectedCells)
  const width = useAppStore(s => s.docWidth), height = useAppStore(s => s.docHeight)
  const dialog = useRef<HTMLDialogElement>(null), canvas = useRef<HTMLCanvasElement>(null)
  const close = useAppStore(s => s.closeQuickLook)
  const virtualSet = sets.find(vs => vs.id === target?.virtualSetId)
  const materialTree = useMemo(() => virtualSet ? resolveVirtualSetLayers(tree, virtualSet) : tree, [tree, virtualSet])
  const layer = target ? findLayerPath(materialTree, target.layerId).at(-1) : undefined
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!layer || !width || !height) return
    let cancelled = false
    const targetCanvas = canvas.current
    const draw = () => {
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
    }
    const dependencies = collectRenderMaterials(draw)
    void withPreparedMaterials(dependencies, () => {
      if (cancelled) return
      const image = withCanvasResources(draw, image => [image])
      if (canvas.current) {
        canvas.current.width = image.width; canvas.current.height = image.height
        canvas.current.getContext('2d')?.drawImage(image, 0, 0)
      }
      image.width = 1; image.height = 1
    }, () => cancelled).then(() => { if (!cancelled) setError(null) }, error => {
      if (!cancelled) setError(error instanceof Error ? error.message : '素材を描画できませんでした')
    })
    return () => { cancelled = true; if (targetCanvas) { targetCanvas.width = 1; targetCanvas.height = 1 } }
  }, [layer, width, height, sets, target, cells])
  useEffect(() => {
    if (!target) return
    const previous = document.activeElement as HTMLElement | null
    const element = dialog.current
    element?.showModal()
    return () => { element?.close(); if (previous?.isConnected) previous.focus() }
  }, [target])
  if (!target) return null
  return <dialog ref={dialog} className={styles.dialog} aria-label="素材のクイックルック"
    onCancel={event => { event.preventDefault(); event.stopPropagation(); close() }}
    onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }}
    onClick={event => { if (event.target === event.currentTarget) close() }}>
    <header><strong>{layer ? describeOutputSource(layer, alias) : '素材が見つかりません'}</strong><button autoFocus onClick={close} aria-label="クイックルックを閉じる">✕</button></header>
    <div className={styles.image}><canvas ref={canvas} />{error && <p role="alert">{error}</p>}</div>
    <p>素材単体の確認{target.virtualSetId ? ' · 仮想セル内の設定' : ''}。合成先の背景・用紙は含みません。</p>
  </dialog>
}
