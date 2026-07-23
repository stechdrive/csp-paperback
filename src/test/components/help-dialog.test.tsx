import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpDialog } from '../../components/HelpDialog'

afterEach(cleanup)

describe('HelpDialog information architecture', () => {
  it('最短ガイドを初期表示し、出力までの5ステップを案内する', () => {
    render(<HelpDialog onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /最短ガイド/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('最初の1回はここだけ')).not.toBeInTheDocument()
    expect(screen.queryByText('起動時に見えている設定')).not.toBeInTheDocument()

    const route = [
      '書き出し設定を決める',
      'クリスタからPSDとXDTSを書き出す',
      'PSDとXDTSを読み込む',
      '出力プレビューを確認する',
      '「出力」から保存方法を選ぶ',
    ]
    for (const title of route) expect(screen.getByText(title)).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="書き出し設定"]')).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="出力プレビュー"]')).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="出力メニュー"]')).toBeInTheDocument()

    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).toContain('同じCLIPファイルから')
    expect(text).toContain('PSDとXDTSの2ファイルを同時に選び')
    expect(text).not.toContain('1つずつ同時に')
    expect(screen.queryByText('CSPアニメーションセル出力の課題')).not.toBeInTheDocument()
  })

  it('機能ガイドを操作・結果・具体例で章立てし、曖昧な説明を残さない', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /機能ガイド/ }))

    const toc = screen.getByRole('navigation', { name: '章の目次' })
    expect(within(toc).getByRole('button', { name: /画面全体/ })).toBeInTheDocument()
    expect(within(toc).getByRole('button', { name: /デスクトップ・モバイル/ })).toBeInTheDocument()
    expect(within(toc).queryByRole('button', { name: /困ったとき/ })).not.toBeInTheDocument()

    const text = screen.getByRole('article').textContent ?? ''
    expect(text).toContain('同じCLIPファイルから書き出したPSDとXDTS')
    expect(text).toContain('以前「設定を書き出す」で保存した')
    expect(text).toContain('CSPのタイムラインで、そのフレームに表示されるセルの重なり')
    expect(text).toContain('兼用カット')
    expect(text).toContain('XDTSフォルダ名')
    expect(text).toContain('出力する修正工程')
    expect(text).toContain('A2_e.jpg')
    expect(text).toContain('目がOFFのレイヤーやフォルダは、プレビューにも出力にも含まれません')
    expect(text).toContain('タイムラインへセルとして登録する必要がない')
    expect(text).toContain('仮想セルへ、右ペインから出力に使うレイヤーを追加')
    expect(text).not.toContain('対応が読込時に確定')
    expect(text).not.toContain('保存済み設定')
    expect(text).not.toContain('メンバー')
    expect(text).not.toContain('困ったとき')
    expect(document.querySelectorAll('[data-help-highlight]').length).toBeGreaterThanOrEqual(10)
  })

  it('このツールが補う機能を具体的なレイヤー名と出力結果で説明する', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /このツールについて/ }))

    expect(screen.getByRole('heading', {
      name: 'CSPのセル出力で、素材ごとの出し分けをできるようにする',
    }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. CSP標準のセル出力で困ること' }))
      .toBeInTheDocument()

    const text = screen.getByRole('article').textContent ?? ''
    expect(text).toContain('素材ごとに「セルへ重ねる」「別画像にする」を分けられません')
    expect(text).toContain('A1.jpg')
    expect(text).toContain('_BG.jpg')
    expect(text).toContain('B1_s.jpg')
    expect(text).toContain('memo ＋ Frame ＋ 作画/A/1')
    expect(text).not.toContain('紙に戻す')
    expect(text).not.toContain('大きな単位')
    expect(text).not.toContain('メンタルモデル')
    expect(screen.getByText('作品データは外部へ送信しません。')).toBeInTheDocument()
  })
})
