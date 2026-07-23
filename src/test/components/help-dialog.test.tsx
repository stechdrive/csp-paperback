import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpDialog } from '../../components/HelpDialog'

afterEach(cleanup)

describe('HelpDialog information architecture', () => {
  it('最短ガイドを初期表示し、出力までの5ステップを案内する', () => {
    render(<HelpDialog onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /最短ガイド/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('heading', { name: '最短でセル画像を書き出す' })).toBeInTheDocument()

    const route = [
      '書き出し設定を決める',
      'クリスタからPSDとXDTSを書き出す',
      'PSDとXDTSを読み込む',
      '出力プレビューを確認する',
      '「出力」から保存方法を選ぶ',
    ]
    for (const title of route) expect(screen.getByText(title)).toBeInTheDocument()

    expect(screen.queryByText('CSPアニメーションセル出力の課題')).not.toBeInTheDocument()
  })

  it('機能ガイドを章立てし、現行の全書き出し設定を含める', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /機能ガイド/ }))

    const toc = screen.getByRole('navigation', { name: '章の目次' })
    expect(within(toc).getByRole('button', { name: /画面全体/ })).toBeInTheDocument()
    expect(within(toc).getByRole('button', { name: /困ったとき/ })).toBeInTheDocument()

    const text = screen.getByRole('article').textContent ?? ''
    expect(text).toContain('兼用カット')
    expect(text).toContain('XDTSフォルダ名')
    expect(text).toContain('出力する修正工程')
    expect(text).toContain('仮想セル')
    expect(text).toContain('デスクトップ版とモバイル')
  })

  it('背景説明とメンタルモデルを操作手順から分離する', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /考え方/ }))

    expect(screen.getByRole('heading', { name: 'CSPの作業構造を、必要な「紙」へ戻す' }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'なぜ作ったか' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'メンタルモデル：「紙に戻す」' })).toBeInTheDocument()
    expect(screen.getByText('作品データは外部へ送信しません。')).toBeInTheDocument()
  })
})
