import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpDialog } from '../../components/HelpDialog'

afterEach(() => cleanup())

describe('HelpDialog current output guidance', () => {
  it('現在の初期設定と出力名を選ぶ基準を案内する', () => {
    const { container } = render(<HelpDialog onClose={vi.fn()} />)
    const text = container.textContent ?? ''

    expect(text).toContain('現在の初期設定：')
    expect(text).toContain('シート連番、自動桁数、フォルダ名との区切りなし')
    expect(text).toContain('最大連番に合わせて1〜4桁')
    expect(text).toContain('セル名が「1」のようにフォルダ名を含まない場合は「付ける」を選ぶ')
    expect(text).toContain('セル名が「A1」のようにフォルダ名まで含む場合は、名前の重複を避けるため「付けない」を選ぶ')
    expect(text).not.toContain('最大連番に合わせた2〜4桁')
  })

  it('修正工程フチの用途、指定方法、初期色を案内する', () => {
    const { container } = render(<HelpDialog onClose={vi.fn()} />)
    const text = container.textContent ?? ''

    expect(text).toContain('工程ごとの色で内側70pxの確認フチを乗算・不透明度80%で合成')
    expect(text).toMatch(/RGBの各数値やFBECE6\s*のようなHEX値でも直接指定/)
    expect(text).toContain('RGB 251, 236, 230#FBECE6')
    expect(text).toContain('RGB 234, 246, 213#EAF6D5')
    expect(text).toContain('サフィックスは入力した文字をそのまま使います')
  })
})
