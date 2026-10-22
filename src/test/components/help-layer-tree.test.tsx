import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HelpLayerTree } from '../../components/help/HelpLayerTree'
import { HelpAnimationFolderExample } from '../../components/help/HelpAnimationFolderExample'
import { celProcessLayers, sampleLayers } from '../../components/help/layerExamples'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => { cleanup(); resetTestStore() })

describe('HelpLayerTree', () => {
  it('メニューで手動指定・解除し、種類と出力指定を分けても作品や履歴を変更しない', () => {
    resetTestStore({
      manualAnimFolderIds: new Set(['document-folder']),
      singleMarks: new Map([['document-layer', { layerId: 'document-layer', origin: 'manual' }]]),
    })
    const before = useAppStore.getState()
    render(<HelpAnimationFolderExample />)
    const example = screen.getByRole('figure', { name: 'アニメーションフォルダを指定・解除する例' })
    const folder = example.querySelector('[data-help-layer="effect"]')!
    const child = example.querySelector('[data-help-layer="effect1"]')!
    const action = (name: RegExp) => { fireEvent.contextMenu(folder.querySelector('[data-layer-kind]')!); fireEvent.click(screen.getByRole('menuitemcheckbox', { name })) }
    const role = () => folder.querySelector('[data-layer-output-role]')
    expect(folder.querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
    expect(role()).toBeNull()
    action(/別画像として/)
    expect(role()).toHaveAttribute('data-layer-output-role', 'individual')
    action(/手動でアニメーションフォルダ/)
    expect(role()).toHaveAttribute('data-layer-output-role', 'animation')
    expect(folder.querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
    expect(child.querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'cell')
    expect(folder.querySelectorAll('[data-layer-output-role]')).toHaveLength(1)
    action(/指定を解除/)
    expect(folder.querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'folder')
    expect(child.querySelector('[data-layer-icon]')).toHaveAttribute('data-layer-icon', 'layer')
    expect(role()).toHaveAttribute('data-layer-output-role', 'individual')
    expect(useAppStore.getState()).toBe(before)
  })

  it('サンプルの開閉だけを操作でき、作品の表示・名前・選択・Undo状態を変更しない', () => {
    resetTestStore({
      selectedLayerId: 'memo', expandedFolders: new Set(['lo']),
      visibilityOverrides: new Map([['memo', true]]),
      outputAliases: new Map([['memo', '作業メモ']]),
      manualAnimFolderIds: new Set(['lo']),
    })
    const before = useAppStore.getState()
    render(<HelpLayerTree label="構造の例" layers={sampleLayers} />)
    const example = screen.getByRole('figure', { name: '構造の例' })

    expect(within(example).getByText('memo', { exact: true })).toBeVisible()
    expect(within(example).queryByText('作業メモ')).not.toBeInTheDocument()
    expect(within(example).getAllByRole('img', { name: '非表示' })).toHaveLength(2)
    expect(within(example).queryByRole('button', { name: /レイヤーを|個別書き出し|手動で/ })).not.toBeInTheDocument()
    fireEvent.click(within(example).getAllByRole('img', { name: '表示' })[0].closest('[data-help-layer]')!)
    fireEvent.doubleClick(within(example).getByText('memo', { exact: true }))
    expect(within(example).queryByRole('textbox')).not.toBeInTheDocument()

    fireEvent.click(within(example).getByRole('button', { name: 'LOを折りたたむ' }))
    expect(within(example).queryByText('B1_s.jpg')).not.toBeInTheDocument()
    expect(within(example).getByText('_BG.jpg')).toBeVisible()
    fireEvent.click(within(example).getByRole('button', { name: 'LOを展開する' }))
    expect(within(example).getByText('B1_s.jpg')).toBeVisible()
    expect(useAppStore.getState()).toBe(before)
  })

  it('同じ素材を説明する例同士でも開閉は独立し、工程と出力名の対応を保つ', () => {
    render(<>
      <HelpLayerTree label="全体の例" layers={sampleLayers} />
      <HelpLayerTree label="工程の例" layers={celProcessLayers} />
    </>)
    const all = screen.getByRole('figure', { name: '全体の例' })
    const process = screen.getByRole('figure', { name: '工程の例' })
    const correction = process.querySelector('[data-help-layer="supervisor"]')!
    expect(correction).toHaveTextContent('_s')
    expect(correction).toHaveTextContent('B1_s.jpg')
    expect(correction.querySelector('[data-layer-kind]')).toHaveAttribute('data-layer-kind', 'folder')
    expect(process.querySelector('[data-help-layer="drawing-b1"] [data-layer-kind]'))
      .toHaveAttribute('data-layer-kind', 'cell')

    fireEvent.click(within(process).getByRole('button', { name: 'Bを折りたたむ' }))
    expect(within(process).queryByText('B1_s.jpg')).not.toBeInTheDocument()
    expect(within(all).getByText('B1_s.jpg')).toBeVisible()
    fireEvent.click(within(process).getByRole('button', { name: 'Bを展開する' }))
    expect(within(process).getByText('B1_s.jpg')).toBeVisible()
  })
})
