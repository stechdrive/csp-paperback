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
      <div className={styles.hero}>
        <div className={styles.eyebrow}>最初の1回はここだけ</div>
        <h1 className={styles.title}>最短でセル画像を書き出す</h1>
        <p className={styles.lead}>
          起動時に見えている設定を決め、CLIP STUDIO PAINTからPSDとXDTSを書き出して、
          2ファイルを読み込みます。あとはプレビューを確認して「出力」を押すだけです。
        </p>
      </div>

      <div className={styles.route}>
        <Step
          number={1}
          title="書き出し設定を決める"
          figure={full ? (
            <HelpFigure
              src="startup-guide.png"
              alt="起動直後の中央ペイン上部にある書き出し設定"
              caption="起動直後の中央ペイン上部。ここで選んだ設定は次回起動とデスクトップ版の自動書き出しにも引き継がれます。"
            />
          ) : undefined}
        >
          JPG／PNG、背景、出力名、フォルダ分け、修正工程などを選びます。
          迷ったら現在の設定のままで構いません。
        </Step>

        <Step number={2} title="クリスタからPSDとXDTSを書き出す">
          PSDは <span className={styles.menuPath}>ファイル ＞ 複製を保存 ＞ PSD</span>、
          XDTSは <span className={styles.menuPath}>ファイル ＞ アニメーション書き出し ＞ タイムシート情報</span>
          から書き出します。タイムシート形式はCSVではなくXDTSを選びます。
        </Step>

        <Step number={3} title={xdtsLoaded ? 'PSDを読み込む' : 'PSDとXDTSを読み込む'}>
          {xdtsLoaded
            ? 'XDTSは読み込み済みです。対応するPSDを画面へドロップしてください。'
            : '2ファイルをまとめて画面へドロップします。「ファイルを開く」から同時選択しても構いません。'}
          XDTSのトラックからアニメーションフォルダが自動検出されます。
        </Step>

        <Step
          number={4}
          title="出力プレビューを確認する"
          figure={full ? (
            <HelpFigure
              src="loaded-overview.png"
              alt="サンプルPSDとXDTSを読み込んだCSP Paperbackの3ペイン画面"
              caption="読込後の画面。中央下の出力プレビューで、出力名と合成結果を確認できます。"
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
              caption="右上の「出力」からZIPまたはフォルダを選びます。環境によってはZIPのみ表示されます。"
              compact
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
              通常起動で設定を保存したあと、PSDとXDTSを1つずつ同時にEXEまたはショートカットへ
              まとめてドロップすると、確認画面を省いてXDTSと同じ場所へ自動出力できます。
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
