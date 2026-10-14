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

function PsdInstructions() {
  return (
    <div className={styles.psdInstructions}>
      <strong>ベクター・3Dレイヤーがあるときは、PSDも一緒にドロップ</strong>
      <p>クリスタの<span className={styles.menuPath}>{ja.input.psdMenu}</span>でPSDを保存してください。</p>
      <p>{ja.input.psdVisibility}</p>
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
      {!full && (
        <div className={styles.dropPrompt}>
          <h2 className={styles.dropTitle}>
            {timelineOnlyLoaded ? 'PSDファイルをここにドロップ' : ja.dropZone.message}
          </h2>
          <p className={styles.dropDescription}>
            {timelineOnlyLoaded
              ? '読み込み済みのタイムシートに対応するPSDを読み込んでください。'
              : '「ファイルを開く」からも選べます。'}
          </p>
          {!timelineOnlyLoaded && <PsdInstructions />}
        </div>
      )}

      {full ? (
        <div className={styles.callout}><PsdInstructions /></div>
      ) : (
        <>
          <div className={styles.folderRules}>
            <div className={styles.folderRule}>
              <strong>フレーム枠線・タップ画像を各セルに合成</strong>
              <p>共通で重ねたい画像は、アニメーションフォルダの外に<b>先頭に「_」のないフォルダ</b>を作り、その中へ。</p>
              <code>例：フレーム</code>
            </div>
            <div className={styles.folderRule}>
              <strong>背景原図・撮影指示を単独で書き出す</strong>
              <p>セル画像に重ねない素材は、アニメーションフォルダの外で、書き出す単位ごとに<b>先頭に「_」を付けたフォルダ</b>へ。</p>
              <code>例：_原図／_BG、_原図／_BOOK、_撮影指示</code>
            </div>
          </div>
        </>
      )}

      {full && <div className={styles.route}>
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
          JPG／PNG、背景、出力名、フォルダ分け、出力対象などを選びます。
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
              alt="サンプルを読み込んだCSP Paperbackの出力プレビュー画面"
              caption="読込後の画面。赤枠の出力プレビューで、出力名と合成結果を確認できます。"
              highlights={[HELP_HIGHLIGHTS.output]}
            />
          ) : undefined}
        >
          右の出力一覧で画像を選び、中央の画像とファイル名を確認します。隣の素材ツリーには、合成に使う要素が示されます。
          通常のセル出力だけなら、仮想セルを開いたり、右の★／🎬を操作したりする必要はありません。
          読み込み後の設定変更は、中央下部の「書き出し設定」から行えます。
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
      </div>}

      {sampleAction && <div className={styles.actions}>{sampleAction}</div>}

      {full && (
        <>
          <section className={styles.secondary} data-help-section="desktop-quick">
            <div className={styles.secondaryTitle}>デスクトップ版の自動書き出し</div>
            <p className={styles.secondaryText}>
              通常起動で書き出し設定を決めたあと、複数のCLIPと必要なPSDをまとめて
              EXEやショートカットへドロップできます。複数作品では同じフォルダ・同名のCLIPとPSDを組にし、
              PSDのないCLIPは単独で処理します。各CLIPと同じ場所へ、作品ごとのフォルダを作って順番に出力します。
              構造不一致などで失敗した作品はスキップし、結果一覧に成功・失敗・再現上の注意を表示します。
              CLIPとPSDは同じ保存状態の組を用意してください。画像内容そのものの一致は検証しません。
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
