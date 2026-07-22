import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProcessColorPicker } from '../../components/ProcessColorPicker'

afterEach(() => cleanup())

describe('ProcessColorPicker', () => {
  it('色四角からカラーUIを開き、HEX値で指定できる', () => {
    const onChange = vi.fn()
    render(<ProcessColorPicker color="#FBECE6" label="演出" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: '演出のフチ色を変更' }))
    expect(screen.getByRole('dialog', { name: '演出のフチ色' })).toBeInTheDocument()
    expect(screen.getByLabelText('カラーホイール・パレット')).toHaveValue('#fbece6')

    fireEvent.change(screen.getByLabelText('16進数カラー'), {
      target: { value: '112233' },
    })
    expect(onChange).toHaveBeenLastCalledWith('#112233')
  })

  it('RGB値を0〜255へ丸めてHEX色へ変換する', () => {
    const onChange = vi.fn()
    render(<ProcessColorPicker color="#000000" label="作監" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '作監のフチ色を変更' }))

    fireEvent.change(screen.getByLabelText('R'), { target: { value: '300' } })
    expect(onChange).toHaveBeenLastCalledWith('#FF0000')
  })
})
