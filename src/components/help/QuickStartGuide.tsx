import type { ReactNode } from 'react'
import { isDesktopRuntime } from '../../platform/runtime'
import { DESKTOP_RELEASES_URL } from '../../platform/external-links'
import { ja } from '../../i18n/ja'
import { HelpFigure } from './HelpFigure'
import { HELP_HIGHLIGHTS } from './helpHighlights'
import styles from './QuickStartGuide.module.css'

interface QuickStartGuideProps {
  variant: 'startup' | 'help'
  timelineOnlyLoaded?: boolean
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
  timelineOnlyLoaded = false,
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
              highlights={[HELP_HIGHLIGHTS.startupSettings]}
            />
          ) : undefined}
        >
          JPG／PNG、背景、出力名、フォルダ分け、修正工程などを選びます。
          迷ったら初期設定のままで構いません。
        </Step>

        <Step number={2} title="書き出す状態でCLIPを保存する">
          クリスタで、書き出したい素材が表示される状態にしてCLIPを保存します。
        </Step>

        <Step number={3} title={timelineOnlyLoaded ? 'PSDを読み込む' : 'CLIPを読み込む'}>
          {timelineOnlyLoaded
            ? 'タイムシートは読み込み済みです。対応するPSDを画面へドロップしてください。'
            : 'CLIPを画面へドロップします。「ファイルを開く」から選択しても構いません。'}
          アニメーションフォルダとタイムラインを読み取り、対応する素材を描画します。
        </Step>

        <Step
          number={4}
          title="出力プレビューを確認する"
          figure={full ? (
            <HelpFigure
              src="loaded-overview.png"
              alt="サンプルを読み込んだCSP Paperbackの3ペイン画面"
              caption="読込後の画面。赤枠の出力プレビューで、出力名と合成結果を確認できます。"
              highlights={[HELP_HIGHLIGHTS.output]}
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
              highlights={[HELP_HIGHLIGHTS.outputMenu]}
            />
          ) : undefined}
        >
          ZIPなら1ファイルにまとめて保存、フォルダなら出力用サブフォルダを作って画像を書き込みます。
        </Step>
      </div>

      <div className={styles.callout}>
        <strong>クリスタの描画結果を使う場合：</strong>
        ベクター・3Dレイヤーなど、CLIPだけでは再現できない素材はPSDの画像を使えます。
        クリスタの<span className={styles.menuPath}>{ja.input.psdMenu}</span>で保存し、
        CLIPと一緒に読み込むか、後から追加します。{ja.input.psdVisibility}
      </div>

      {sampleAction && <div className={styles.actions}>{sampleAction}</div>}

      {full && (
        <>
          <section className={styles.secondary} data-help-section="desktop-quick">
            <div className={styles.secondaryTitle}>デスクトップ版の自動書き出し</div>
            <p className={styles.secondaryText}>
              通常起動で書き出し設定を決めたあと、CLIPをEXEまたはショートカットへドロップします。
              対応PSDを一緒に渡すこともできます。CLIPと同じ場所へ自動出力します。
              複数タイムラインがある場合は、保存時に選択されていたものを使用します。
              ★や🎬をカットごとに調整したい場合は、通常画面から書き出してください。
            </p>
            {!desktop && (
              <a className={styles.releaseLink} href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer">
                デスクトップ版をダウンロード
              </a>
            )}
          </section>

          <div className={styles.privacy}>
            読み込んだファイルの解析と画像生成はブラウザ内または端末内で完結し、作品データを外部へ送信しません。
          </div>
        </>
      )}
    </div>
  )
}
