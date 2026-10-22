import { useState } from 'react'
import { createLayerActions } from '../../utils/layer-row-state'
import { HelpLayerTree, type HelpLayer } from './HelpLayerTree'

/** The same row and controls as the document tree, with state confined to this example. */
export function HelpAnimationFolderExample() {
  const [animation, setAnimation] = useState(false)
  const [marks, setMarks] = useState<ReadonlySet<string>>(() => new Set())
  const layers: readonly HelpLayer[] = [{
    id: 'effect', name: 'エフェクト', kind: animation ? 'animation' : 'folder',
    metadata: { kind: 'folder' },
    outputRole: animation ? { kind: 'animation', origin: 'manual' } : marks.has('effect') ? { kind: 'individual', origin: 'manual' } : undefined,
    note: animation ? '指定中：フォルダの隣にアニメーション指定の記号が付きます。' : '右クリックまたは長押しでアニメーションフォルダに指定できます。',
    children: ['1', '2'].map(name => ({
      id: `effect${name}`, name, kind: animation ? 'cell' : 'layer',
      metadata: { kind: 'raster' },
      outputRole: !animation && marks.has(`effect${name}`) ? { kind: 'individual', origin: 'manual' } : undefined,
      note: animation ? 'セルとして出力' : marks.has(`effect${name}`) ? '★で個別書き出し' : undefined,
    })),
  }]
  return <HelpLayerTree label="アニメーションフォルダを指定・解除する例" layers={layers} exampleId="manual-animation"
    caption="行を右クリックまたは長押しして操作します。選択後はShift+F10でも開けます。ここでの操作は説明用の例だけに反映されます。"
    renderControls={layer => ({
      actions: createLayerActions({
        role: layer.outputRole, isAnimation: layer.kind === 'animation', canAssignAnimation: layer.id === 'effect',
        insideAnimation: animation && layer.id !== 'effect', manualIndividual: marks.has(layer.id),
        toggleAnimation: () => setAnimation(active => !active),
        toggleIndividual: () => {
        setMarks(previous => {
          const next = new Set(previous)
          if (next.has(layer.id)) next.delete(layer.id)
          else next.add(layer.id)
          return next
        })
        },
      }),
    })} />
}
