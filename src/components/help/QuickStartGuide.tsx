import type { ReactNode } from 'react'
import { isDesktopRuntime } from '../../platform/runtime'
import { DESKTOP_RELEASES_URL } from '../../platform/external-links'
import { HelpFigure } from './HelpFigure'
import styles from './QuickStartGuide.module.css'

interface QuickStartGuideProps {
  variant: 'startup' | 'help'
  xdtsLoaded?: boolean
  sampleAction?: ReactNode
}

function Step({
  number,
  title,
  children,
  figure,
}: {
  number: number
  title: string
  children: ReactNode
  figure?: ReactNode
}) {
  return (
    <div className={styles.step}>
      <div className={styles.stepNumber}>{number}</div>
      <div>
        <div className={styles.stepTitle}>{title}</div>
        <div className={styles.stepText}>{children}</div>
      </div>
      {figure && <div className={styles.figureSlot}>{figure}</div>}
    </div>
  )
}

export function QuickStartGuide({
  variant,
  xdtsLoaded = false,
  sampleAction,
}: QuickStartGuideProps) {
  const full = variant === 'help'
  const desktop = isDesktopRuntime()

  return (
    <div className={`${styles.guide} ${styles[variant]}`}>
      <div className={styles.route}>
        <Step
          number={1}
          title="書き出し設定を決める"
          figure={full ? (
            <HelpFigure
              src="startup-guide.png"
              alt="起動直後の中央ペイン上部にある書き出し設定"
              caption="赤枠が中央ペイン上部の書き出し設定です。ここで選んだ内容は次回起動とデスクトップ版の自動書き出しにも引き継がれます。"
              highlights={[
                { label: '書き出し設定', x: 20.7, y: 10.8, width: 55.5, height: 30.3 },
              ]}
            />
          ) : undefined}
        >
          JPG／PNG、背景、出力名、フォルダ分け、修正工程などを選びます。
          迷ったら初期設定のままで構いません。
        </Step>

        <Step number={2} title="クリスタからPSDとXDTSを書き出す">
          同じCLIPファイルから、PSDは
          <span className={styles.menuPath}> ファイル ＞ 複製を保存 ＞ Photoshopドキュメント</span>、
          XDTSは
          <span className={styles.menuPath}> ファイル ＞ アニメーション書き出し ＞ タイムシート情報の書き出し</span>
          でXDTS形式を選んで書き出します。
        </Step>

        <Step number={3} title={xdtsLoaded ? 'PSDを読み込む' : 'PSDとXDTSを読み込む'}>
          {xdtsLoaded
            ? 'XDTSは読み込み済みです。対応するPSDを画面へドロップしてください。'
            : '同じCLIPファイルから書き出した2ファイルを、まとめて画面へドロップします。「ファイルを開く」から同時選択しても構いません。'}
          XDTSのトラックからアニメーションフォルダが自動検出されます。
        </Step>

        <Step
          number={4}
          title="出力プレビューを確認する"
          figure={full ? (
            <HelpFigure
              src="loaded-overview.png"
              alt="サンプルPSDとXDTSを読み込んだCSP Paperbackの3ペイン画面"
              caption="読込後の画面。赤枠の出力プレビューで、出力名と合成結果を確認できます。"
              highlights={[
                { label: '出力プレビュー', x: 20.5, y: 73.7, width: 56, height: 25.8 },
              ]}
            />
          ) : undefined}
        >
          中央下の「出力プレビュー」で画像とファイル名を確認します。
          通常のセル出力だけなら、左の仮想セルや右の★／🎬を操作する必要はありません。
        </Step>

        <Step
          number={5}
          title="「出力」から保存方法を選ぶ"
          figure={full ? (
            <HelpFigure
              src="output-menu.png"
              alt="ツールバーの出力メニューでZIPとフォルダを選べる状態"
              caption="赤枠の「出力」からZIPまたはフォルダを選びます。環境によってはZIPのみ表示されます。"
              compact
              highlights={[
                {
                  label: '出力メニュー',
                  x: 89.5,
                  y: 1,
                  width: 9.5,
                  height: 17.5,
                  labelAlign: 'right',
                },
              ]}
            />
          ) : undefined}
        >
          ZIPなら1ファイルにまとめて保存、フォルダなら出力用サブフォルダを作って画像を書き込みます。
        </Step>
      </div>

      <div className={styles.callout}>
        <strong>書き出し前の確認：</strong>
        出したい素材が入っているアニメーションフォルダは、親フォルダも含めてCSP側で表示状態にしてください。
        読込後に右ペインの目アイコンで調整することもできます。
      </div>

      {sampleAction && <div className={styles.actions}>{sampleAction}</div>}

      {full && (
        <>
          <section className={styles.secondary} data-help-section="desktop-quick">
            <div className={styles.secondaryTitle}>デスクトップ版の自動書き出し</div>
            <p className={styles.secondaryText}>
              通常起動で書き出し設定を決めたあと、同じカットのPSDとXDTSの2ファイルを同時に選び、
              EXEまたはショートカットへまとめてドロップします。
              2ファイルを同じ起動時に渡した場合だけ、確認画面を省いてXDTSと同じ場所へ自動出力します。
              ★や🎬をカットごとに調整したい場合は、通常画面から書き出してください。
            </p>
            {!desktop && (
              <a className={styles.releaseLink} href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
                デスクトップ版をダウンロード
              </a>
            )}
          </section>

          <div className={styles.privacy}>
            PSD／XDTSの解析と画像生成はブラウザ内または端末内で完結し、作品データを外部へ送信しません。
          </div>
        </>
      )}
    </div>
  )
}
