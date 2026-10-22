import { useState } from 'react'
import { LayerAnimationButton, LayerIndividualButton } from '../LayerOutputButtons'
import { HelpLayerTree, type HelpLayer } from './HelpLayerTree'

/** The same row and controls as the document tree, with state confined to this example. */
export function HelpAnimationFolderExample() {
  const [animation, setAnimation] = useState(false)
  const [marks, setMarks] = useState<ReadonlySet<string>>(() => new Set())
  const layers: readonly HelpLayer[] = [{
    id: 'effect', name: 'エフェクト', kind: animation ? 'animation' : 'folder',
    note: animation ? '指定中：左の種類アイコンも🎬に変わります。' : '未指定：右端の🎬を押してみてください。',
    children: ['1', '2'].map(name => ({
      id: `effect${name}`, name, kind: animation ? 'cell' : 'layer',
      note: marks.has(`effect${name}`) ? '★で個別書き出し' : animation ? 'セルとして出力' : undefined,
    })),
  }]
  return <HelpLayerTree label="右端の🎬で指定・解除する例" layers={layers} exampleId="manual-animation"
    caption="行を選ぶかポインターを合わせると、右端に操作ボタンが表示されます。ここでの操作は説明用の例だけに反映されます。"
    renderControls={layer => ({
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
