import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HelpDialog } from '../../components/HelpDialog'

afterEach(cleanup)

describe('HelpDialog information architecture', () => {
  it('クイックガイドを初期表示し、全素材の表示を求めず出力までの4ステップを案内する', () => {
    render(<HelpDialog onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: /クイックガイド/ }))
      .toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: /機能ガイド/ })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /各社テンプレートへの対応/ }))
      .toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /このツールについて/ })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '章の目次' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '各社テンプレートに対応するには' }))
      .not.toBeInTheDocument()
    expect(screen.queryByText('最初の1回はここだけ')).not.toBeInTheDocument()
    expect(screen.queryByText('起動時に見えている設定')).not.toBeInTheDocument()

    const route = [
      '書き出し設定を決める',
      'CLIPを保存して読み込む',
      '書き出し画像を確認する',
      '「出力」から保存方法を選ぶ',
    ]
    for (const title of route) expect(screen.getByText(title)).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="書き出し設定"]')).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="書き出し画像"]')).toBeInTheDocument()
    expect(document.querySelector('[data-help-highlight="出力メニュー"]')).toBeInTheDocument()

    const text = screen.getByRole('dialog').textContent ?? ''
    expect(text).toContain('初回から互換情報付きで保存しているCLIPは、通常の［保存］（Ctrl+S）を続けられます')
    expect(text).toContain('保存済みのCLIPで後からONにした場合は、［ファイル］→［別名で保存］を使ってください')
    expect(text).toContain('※後からONにした場合、通常の［保存］（Ctrl+S）だけでは互換情報は反映されません')
    expect(text).toContain('その保存画面で元のCLIPを選んで上書き')
    expect(text).not.toContain('表示される状態')
    expect(text).toContain('自動で「兼用カット」をON')
    expect(text).toContain('保存時に選ばれていたタイムライン')
    expect(text).not.toContain('XDTS')
    expect(text).toMatch(/複数のCLIPと必要なPSDをまとめて\s*EXEやショートカットへドロップ/)
    expect(text).toContain('同じフォルダ・同名のCLIPとPSD')
    expect(text).not.toContain('1つずつ同時に')
    expect(screen.queryByText('CSPアニメーションセル出力の課題')).not.toBeInTheDocument()
  })

  it('各社テンプレート向けに工程名・サフィックス・個別書き出し・設定共有を案内する', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /各社テンプレートへの対応/ }))

    const text = screen.getByRole('dialog').textContent ?? ''
    expect(screen.getByRole('heading', { name: '各社テンプレートに対応するには' }))
      .toBeInTheDocument()
    expect(text).toContain('フォルダ名「EN」／_en')
    expect(text).toContain('A1_en.jpg')
    expect(text).toContain('工程登録なし／サフィックスなし')
    expect(text).toContain('フォルダ名「作画」／_l')
    expect(text).toContain('A1_l.jpg')
    expect(text).toContain('「個別に書き出すフォルダ名」へCAMERAを追加')
    expect(text).toContain('_PANと_SLがそれぞれ静止画として出力')
    expect(text).toContain('設定を書き出す')
    expect(text).toContain('設定を読み込む')
    expect(text).toContain('工程フォルダリスト、個別に書き出すフォルダ名')
    expect(text).not.toContain('CAMERA.jpg')
    expect(text).not.toContain('撮影指示.jpg')
    expect(text).not.toContain('-DIR')
    expect(text).not.toContain('_SK')
    expect(document.querySelector('[data-help-highlight="工程設定"]')).toBeInTheDocument()
  })

  it('機能ガイドを操作・結果・具体例で章立てし、曖昧な説明を残さない', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /機能ガイド/ }))

    const toc = screen.getByRole('navigation', { name: '章の目次' })
    expect(within(toc).getByRole('button', { name: /画面全体/ })).toBeInTheDocument()
    expect(within(toc).getByRole('button', { name: /デスクトップ・モバイル/ })).toBeInTheDocument()
    expect(within(toc).queryByRole('button', { name: /困ったとき/ })).not.toBeInTheDocument()

    const text = screen.getByRole('article').textContent ?? ''
    expect(text).toContain('初回から互換情報付きで保存しているCLIPは、通常の［保存］（Ctrl+S）を続けられます')
    expect(text).toContain('保存済みのCLIPで後からONにした場合は、［ファイル］→［別名で保存］を使ってください')
    expect(text).toContain('アニメーションフォルダ・セル・タイムラインを直接読み取り')
    expect(text).not.toContain('XDTS')
    expect(text).toContain('設定JSON（任意）')
    expect(text).toContain('CSPのタイムラインで、そのフレームに表示されるセルの重なり')
    expect(text).toContain('兼用カット')
    expect(text).toContain('アニメーションフォルダ名')
    expect(text).toContain('出力対象')
    expect(text).toContain('A_2_e.jpg')
    expect(text).toContain('非表示のレイヤーやフォルダは、プレビューにも出力にも含まれません')
    expect(text).toContain('タイムラインへセルとして登録する必要がない')
    expect(text).toContain('仮想セルへ、右ペインから出力に使うレイヤーを追加')
    expect(text).not.toContain('対応が読込時に確定')
    expect(text).not.toContain('保存済み設定')
    expect(text).not.toContain('メンバー')
    expect(text).not.toContain('困ったとき')
    expect(document.querySelector('[data-help-highlight="キャンバス"]')).toBeInTheDocument()
    expect(text).toContain('タイル表示')
    expect(text).toContain('書き出し中は画面下部に進捗')
  })

  it('このツールが補う機能を具体的なレイヤー名と出力結果で説明する', () => {
    render(<HelpDialog onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: /このツールについて/ }))

    expect(screen.getByRole('heading', {
      name: '作画データを、現場で必要な素材ごとの静止画へ',
    }))
      .toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. CSP標準のセル出力で困ること' }))
      .toBeInTheDocument()

    const text = screen.getByRole('article').textContent ?? ''
    expect(text).toContain('素材ごとに「セルへ重ねる」「別画像にする」を分けられません')
    expect(text).toContain('A1.jpg')
    expect(text).toContain('A1_e.jpg')
    expect(text).toContain('_BG.jpg')
    expect(text).toContain('_PAN.jpg')
    expect(text).toContain('_SL.jpg')
    expect(text).toContain('_BOOK1.jpg')
    expect(text).toContain('B1_s.jpg')
    const layerExample = document.querySelector('[data-help-example="sample-csp-layer-tree"]')
    expect(layerExample).toHaveAccessibleName('この説明で使うCSPのレイヤー構成')
    expect(layerExample).toHaveTextContent('演出')
    expect(layerExample).toHaveTextContent('作画')
    expect(layerExample).toHaveTextContent('_撮影指示')
    expect(layerExample).toHaveTextContent('_原図')
    expect(text).toContain('memo ＋ Frame ＋ LO/作画/A/1')
    expect(text).toContain('memo ＋ Frame ＋ LO/演出/A/1')
    expect(text).toContain('memo ＋ Frame ＋ LO/作画/B/1/_s')
    expect(text).not.toContain('次の例では')
    expect(text).not.toContain('紙に戻す')
    expect(text).not.toContain('大きな単位')
    expect(text).not.toContain('メンタルモデル')
    expect(screen.getByText('作品データは外部へ送信しません。')).toBeInTheDocument()
  })
})
