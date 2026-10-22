import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { HelpLayerTree } from '../../components/help/HelpLayerTree'
import { celProcessLayers, sampleLayers } from '../../components/help/layerExamples'
import { useAppStore } from '../../store'
import { resetTestStore } from '../helpers/store-reset'

afterEach(() => { cleanup(); resetTestStore() })

describe('HelpLayerTree', () => {
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
