import { useState } from 'react'
import { LayerAnimationButton, LayerIndividualButton } from '../LayerOutputButtons'
import { HelpLayerTree, type HelpLayer } from './HelpLayerTree'

/** The same row and controls as the document tree, with state confined to this example. */
export function HelpAnimationFolderExample() {
  const [animation, setAnimation] = useState(false)
  const [marks, setMarks] = useState<ReadonlySet<string>>(() => new Set())
  const layers: readonly HelpLayer[] = [{
    id: 'effect', name: 'エフェクト', kind: animation ? 'animation' : 'folder',
    note: animation ? '指定中：アニメーションフォルダの記号に変わります。' : '右端の補助操作からアニメーションフォルダに指定できます。',
    children: ['1', '2'].map(name => ({
      id: `effect${name}`, name, kind: animation ? 'cell' : 'layer',
      metadata: { kind: 'raster' },
      note: marks.has(`effect${name}`) ? '★で個別書き出し' : animation ? 'セルとして出力' : undefined,
    })),
  }]
  return <HelpLayerTree label="アニメーションフォルダを指定・解除する例" layers={layers} exampleId="manual-animation"
    caption="狭い幅では右端の「…」から操作します。ここでの操作は説明用の例だけに反映されます。"
    renderControls={layer => ({
      individualActive: marks.has(layer.id),
      animation: layer.id === 'effect' && <LayerAnimationButton active={animation} onClick={event => {
        event.stopPropagation()
        setAnimation(active => !active)
      }} />,
      individual: layer.kind !== 'animation' && <LayerIndividualButton active={marks.has(layer.id)} onClick={event => {
        event.stopPropagation()
        setMarks(previous => {
          const next = new Set(previous)
          if (next.has(layer.id)) next.delete(layer.id)
          else next.add(layer.id)
          return next
        })
      }} />,
    })} />
}
