import { useRef, useCallback } from 'react'
import { SampleTemplateDownloadButton } from './SampleTemplateDownloadButton'
import { UpdateCheckPanel } from './UpdateCheckPanel'
import styles from './HelpDialog.module.css'

interface HelpDialogProps {
  onClose: () => void
}

const TOC = [
  { id: 'problem', label: 'CSPセル出力の課題' },
  { id: 'overview', label: 'CSP Paperbackとは' },
  { id: 'privacy', label: '通信とファイルアクセス' },
  { id: 'workflow', label: '基本ワークフロー' },
  { id: 'sample-template', label: 'サンプルテンプレート' },
  { id: 'quick-export', label: 'クイック書き出し' },
  { id: 'example', label: 'サンプルで理解する' },
  { id: 'auto-mark', label: '単体出力の指定方法' },
  { id: 'single-mark', label: '★で後から指定' },
  { id: 'manual-anim-folder', label: '手動アニメフォルダ 🎬' },
  { id: 'auto-anim-folder', label: '自動アニメフォルダ化 🎬' },
  { id: 'virtual-set', label: '仮想セル' },
  { id: 'process-table', label: '工程フォルダリスト' },
  { id: 'export-settings', label: '出力設定' },
  { id: 'shortcuts', label: '操作Tips' },
] as const

export function HelpDialog({ onClose }: HelpDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null)

  const scrollTo = useCallback((id: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  return (
    <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <span className={styles.headerTitle}>
            <span className={styles.headerIcon}>📖</span>
            CSP Paperback ヘルプ
          </span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.layout}>
          {/* TOC sidebar */}
          <nav className={styles.toc}>
            {TOC.map(item => (
              <button
                key={item.id}
                className={styles.tocItem}
                onClick={() => scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div className={styles.content} ref={contentRef}>

            {/* ===== 1. CSPアニメーションセル出力の課題 ===== */}
            <section className={styles.section} data-section="problem">
              <h2 className={styles.h1}>⚠ CSPアニメーションセル出力の課題</h2>

              <p className={styles.p}>
                CLIP STUDIO PAINT の<span className={styles.strong}>「アニメーションセル出力」</span>は、
                編集中のアニメーションを、アニメーションフォルダー内のセルごとに画像として書き出す機能です。
                タイムラインで管理しているセルを、そのまま書き出しにつなげられるのが大きな利点です。
              </p>

              <p className={styles.p}>
                一方で、<span className={styles.em}>アニメーションフォルダーの外にある素材</span>や、
                セル内で管理している修正工程まで含めて柔軟に出し分けたい場面では、標準機能だけでは足りません。
              </p>

              <div className={styles.calloutProblem}>
                <span className={styles.strong}>課題：</span>
                アニメーションセル出力では「アニメーションフォルダ外のレイヤーを出力に含める」オプションが
                あるものの、<span className={styles.strong}>ON/OFF の二択</span>しかありません。
                「フレーム枠線は全てに含めたいが、撮影指示フォルダの内容は含めない」「特定のレイヤーだけ別途出力したい」といった
                きめ細かい制御ができません。
              </div>

              <h3 className={styles.h2}>具体的に困るケース</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>レイアウト用紙</span>（フレーム）をセルと合成して出力したいが、
                  撮影指示は別ファイルに出力したいし、撮影指示をアニメーションフォルダのセルとして扱いたくはない
                </li>
                <li>
                  <span className={styles.strong}>背景原図</span>（BG/BOOK）をアニメーションフォルダにすることなく、
                  セルとは独立して個別出力したい
                </li>
                <li>
                  <span className={styles.strong}>セル内の修正工程を別素材として書き出したい</span>。
                  演出・作監修正などを工程ごとに別トラックへ分けて管理するのではなく、
                  <code className={styles.code}>B/1/_s/作監修正</code> のように
                  セルフォルダ内へ修正工程フォルダを入れて管理したい。
                  そのうえで書き出し時には、作画担当者の素材と修正工程を
                  <code className={styles.code}>B_0001.jpg</code>、
                  <code className={styles.code}>B_0001_s.jpg</code> のように別々の素材として出したい。
                  作業中のクリップスタジオでの構造はそのままに、出力時だけ作画担当者の素材と修正工程を「別々の紙」として戻せます。
                </li>
              </ul>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>やりたいこと</th>
                    <th>CSP標準</th>
                    <th>CSP Paperback</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>フレームと合成してセル出力</td>
                    <td><span className={styles.crossMark}>△</span> 関係ないアニメーションフォルダ外のレイヤー込み</td>
                    <td><span className={styles.checkMark}>✓</span> 選択的に合成</td>
                  </tr>
                  <tr>
                    <td>特定レイヤーだけ別出力</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> ★マーク / 先頭に _ を付けたレイヤーフォルダ</td>
                  </tr>
                  <tr>
                    <td>レイヤーの任意組み合わせ</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> 仮想セル</td>
                  </tr>
                  <tr>
                    <td>修正工程ごとの分離出力</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> 工程フォルダリストにフォルダ名を登録することで対応</td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* ===== 2. CSP Paperbackとは ===== */}
            <section className={styles.section} data-section="overview">
              <h2 className={styles.h1}>🎬 CSP Paperbackとは</h2>

              <p className={styles.p}>
                CSP Paperback は、CLIP STUDIO PAINT のアニメーションセル出力の制約を補完する
                <span className={styles.strong}>ブラウザベースのツール</span>です。
                サーバー不要、ブラウザだけで完結します。
              </p>

              <div className={styles.calloutSolution}>
                CSP から PSD と XDTS を書き出し → CSP Paperback で読み込み → 柔軟なセル出力を ZIP またはフォルダで取得。
                アニメ制作現場の「痒いところに手が届く」出力パターンを自動化します。
              </div>

              <h3 className={styles.h2}>主な機能</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>単体出力</span> — 背景原図・撮影指示・BOOKなど、セル合成には混ぜずに別ファイルで出したい素材を出力。
                  アニメーションしない素材を、CSPのアニメーションセル出力で自動出力させるためだけにアニメーションフォルダへ入れる必要がなくなります。
                  便利に使うなら、CSP側でレイヤーフォルダ名の先頭に _（アンダースコア）をつけておく運用がおすすめです。名前を変えたくない場合は、読み込み後に右ペインの★でその場指定できます。
                </li>
                <li>
                  <span className={styles.strong}>🎬 手動アニメーションフォルダ指定</span> — XDTSに出てこないフォルダを補助的にアニメーションフォルダとして扱い、直下の子をセルごとに出力
                </li>
                <li>
                  <span className={styles.strong}>仮想セル</span> — 任意のセルとBGなどのレイヤーを自由に組み合わせて合成画像を出力
                </li>
                <li>
                  <span className={styles.strong}>デスクトップ版クイック書き出し</span> — PSD と XDTS を EXE にドロップして、確認操作なしで同じフォルダへ一括出力
                </li>
                <li>
                  <span className={styles.strong}>工程フォルダリスト</span> — セル内のフォルダ名に応じて、演出、作監など
                  自動でサフィックス付き分離出力
                </li>
                <li>
                  <span className={styles.strong}>XDTSタイムシート</span> — CLIP STUDIO のタイムシートから
                  アニメーションフォルダを自動検出
                </li>
                <li>
                  <span className={styles.strong}>合成モード保持</span> — アニメーションセル出力時に乗算・スクリーンなどの
                  合成モードをそのまま出力
                </li>
              </ul>
            </section>

            {/* ===== 通信とファイルアクセス ===== */}
            <section className={styles.section} data-section="privacy">
              <h2 className={styles.h1}>通信とファイルアクセス</h2>

              <p className={styles.p}>
                CSP Paperback は、読み込んだ PSD / XDTS / 設定内容 / 生成画像を外部サーバーへ送信しません。
                合成処理と画像生成は、ブラウザ版ではブラウザ内、デスクトップ版では端末内で完結します。
              </p>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>更新確認について：</span>
                デスクトップ版で「更新を確認」ボタンを押した時だけ、
                GitHub Releases の最新バージョン情報を取得するために GitHub API へ通信します。
                作品データ、ファイル名、設定内容、生成画像は送信しません。
                最新版のダウンロードはアプリ内では行わず、ユーザーの既定ブラウザで GitHub Releases を開きます。
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>ブラウザ版の保存権限について：</span>
                フォルダ書き出しでは、ブラウザの安全機能により選択したフォルダへの書き込み許可が求められます。
                CSP Paperback は選択フォルダ内に出力用フォルダを作成し、生成した画像を書き込みます。
                作品データをアップロードする処理ではありません。
              </div>

              <UpdateCheckPanel />
            </section>

            {/* ===== 3. 基本ワークフロー ===== */}
            <section className={styles.section} data-section="workflow">
              <h2 className={styles.h1}>🔄 基本ワークフロー</h2>

              <div className={styles.flowDiagram}>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 1</div>
                  <div className={styles.flowBoxValue}>CSPでPSD/XDTS書き出し</div>
                </div>
                <span className={styles.flowArrow}>→</span>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 2</div>
                  <div className={styles.flowBoxValue}>CSP Paperbackで開く</div>
                </div>
                <span className={styles.flowArrow}>→</span>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 3</div>
                  <div className={styles.flowBoxValue}>書き出し</div>
                </div>
              </div>

              <div className={styles.stepList}>
                <div className={styles.step}>
                  <div className={styles.stepNum}>1</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>CSPからPSDとXDTSを書き出し</div>
                    <div className={styles.stepDesc}>
                      CLIP STUDIO PAINT で ファイル → 複製を保存 → Photoshopドキュメント（.psd）を保存します。
                      続けて、ファイル → アニメーション書き出し → タイムシート情報の書き出し → XDTS形式を選択します。
                      CSP Paperback は PSD と XDTS をセットで読み込む運用を基本にしています。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>2</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>CSP Paperback で開く</div>
                    <div className={styles.stepDesc}>
                      「ファイルを開く」ボタンで PSD と XDTS を同時選択して開きます
                      （ドラッグ＆ドロップにも対応）。
                      XDTSのトラック情報からアニメーションフォルダが自動検出されます。
                      CSP側で非表示だったためXDTSに出てこないフォルダは自動検出されないので、必要なものだけ表示状態にしてレイヤーツリーから補助的に手動指定できます。
                      出力対象のレイヤーを選ぶと出力時のプレビューが表示されます。XDTS読み込み済みの場合はシークバーでタイムシートを再生した状態を確認できます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>3</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>必要に応じてマーク設定 → 書き出し</div>
                    <div className={styles.stepDesc}>
                      単体出力と 🎬 手動アニメーションフォルダ指定を確認し、「出力」ボタンで ZIP またはフォルダへ書き出します。
                      出力形式（JPG/PNG）、背景透過、出力時にセル名でフォルダを作るかをカスタマイズできます。
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 Tips：</span>
                PSD と XDTS は同時に選択して「ファイルを開く」で読み込めます。
                PSDとXDTSを読み込み済みの状態で新しいPSDまたはXDTSを開くと、新規プロジェクトとして読み直します。
                工程フォルダリストと _付きフォルダの除外リストは設定ダイアログから保存・読み込みして共有できます。
                各スタジオで使っているテンプレートや命名ルールに合わせて調整してください。
              </div>
            </section>

            {/* ===== サンプル作画テンプレート ===== */}
            <section className={styles.section} data-section="sample-template">
              <h2 className={styles.h1}>サンプル作画テンプレート(.clip)</h2>

              <p className={styles.p}>
                CSP Paperbackの動作を試しやすいように、推奨作画工程をあらかじめ分けたClip Studio Paint用のサンプルテンプレートです。
              </p>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>このテンプレートの使用は必須ではありません。</span>
                普段使っているクリスタの作画ファイルから書き出したPSDでも利用できます。
              </div>

              <p className={styles.p}>
                工程名は固定ではありません。スタジオや案件ごとの命名ルールに合わせて、設定画面の工程フォルダリストから変更できます。
              </p>

              <div className={styles.templateDownloadRow}>
                <SampleTemplateDownloadButton
                  className={styles.templateDownloadButton}
                  statusClassName={styles.templateDownloadStatus}
                  errorClassName={styles.templateDownloadError}
                  label="サンプル作画テンプレート(.clip)をダウンロード"
                />
              </div>
            </section>

            {/* ===== 4. クイック書き出し ===== */}
            <section className={styles.section} data-section="quick-export">
              <h2 className={styles.h1}>⚡ クイック書き出し</h2>

              <p className={styles.p}>
                デスクトップ版では、<span className={styles.strong}>PSD と XDTS を1つずつ EXE またはショートカットにドロップ</span>すると、
                画面上で設定を触らずに、自動で読み込みから書き出しまで実行できます。
                同じ設定で大量のカットを書き出すときに使う機能です。
              </p>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>デスクトップ版のダウンロード：</span>
                最新版のEXEは{' '}
                <a
                  className={styles.externalLink}
                  href="https://github.com/stechdrive/csp-paperback/releases"
                  target="_blank"
                  rel="noreferrer"
                >
                  GitHub Releases
                </a>
                {' '}から取得できます。
              </div>

              <div className={styles.stepList}>
                <div className={styles.step}>
                  <div className={styles.stepNum}>1</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>先に出力設定を決める</div>
                    <div className={styles.stepDesc}>
                      アプリを普通に起動して、JPG/PNG、背景、階層/フラット、工程名の位置、どの工程・単体出力を含めるかを設定します。
                      クイック書き出しでもこの設定が使われます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>2</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>PSD と XDTS を EXE にドロップ</div>
                    <div className={styles.stepDesc}>
                      <code className={styles.code}>cut001.psd</code> と <code className={styles.code}>cut001.xdts</code> のように、
                      PSD と XDTS を1つずつ選んで CSP Paperback の EXE またはショートカットへドロップします。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>3</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>XDTSと同じ場所へ自動出力</div>
                    <div className={styles.stepDesc}>
                      XDTS があるフォルダの中に、PSD名を元にした出力フォルダを作って書き出します。
                      同名フォルダがある場合は末尾に番号を付けて衝突を避けます。
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>使えるファイル：</span>
                クイック書き出しは <code className={styles.code}>.psd</code> と <code className={styles.code}>.xdts</code> を
                <span className={styles.strong}> 1つずつ</span>渡した場合だけ動きます。
                複数PSD、複数XDTS、PSDだけ、XDTSだけではエラーになります。
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 向いている運用：</span>
                クイック書き出し中はレイヤーツリーで★や🎬を追加する確認工程がありません。
                カットごとに出したい背景原図・撮影指示・修正工程は、CSP側で <code className={styles.code}>_</code> 命名や工程フォルダ名を整えておくと安定します。
                名前を変えたくない素材をカットごとに★指定したい場合は、アプリを普通に起動して読み込んでから書き出してください。
              </div>
            </section>

            {/* ===== 5. サンプルで理解する ===== */}
            <section className={styles.section} data-section="example">
              <h2 className={styles.h1}>📋 サンプルで理解する</h2>

              <p className={styles.p}>
                プレビューパネルの「サンプルデータで試す」ボタンで読み込めるサンプル（c001.psd + c001.xdts）を使って、
                各機能がどう動くかを見てみましょう。
              </p>

              <h3 className={styles.h2}>PSD レイヤー構造（c001.psd）</h3>
              <div className={styles.layerDiagram}>
                {/* memo */}
                <div className={styles.layerRow}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>memo</span>
                  <span className={styles.labelContext}>共通素材（全出力に重なる）</span>
                </div>
                {/* Frame */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>Frame</span>
                  <span className={styles.labelContext}>共通素材（全出力に重なる）</span>
                </div>
                {/* _撮影指示 */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_撮影指示</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_PAN</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    PAN指示
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_SL</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    SL指示
                  </span>
                </div>
                {/* LO */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>LO</span>
                </div>
                {/* LO > 演出 (process folder - track separation type) */}
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>演出</span>
                  <span className={styles.labelContext}>工程フォルダ（トラック分離型）</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconLayer}>📁</span>
                  <span className={styles.layerName}>1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    演出修正 / 演出修正用紙
                  </span>
                </div>
                {/* LO > 作画 */}
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>作画</span>
                </div>
                {/* 作画 > B */}
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>B</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    セルフォルダ
                  </span>
                </div>
                <div className={styles.layerRow} style={{ paddingLeft: '5rem' }}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_s</span>
                  <span className={styles.labelContext}>工程フォルダ（セル内蔵型）</span>
                </div>
                <div className={styles.layerRow} style={{ paddingLeft: '6.25rem' }}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>作監修正 / 作監修正用紙</span>
                </div>
                <div className={styles.layerRow} style={{ paddingLeft: '5rem' }}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>線画1</span>
                </div>
                <div className={styles.layerRow} style={{ paddingLeft: '5rem' }}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>影</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    影1 / 影2
                  </span>
                </div>
                {/* 作画 > A */}
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    線画
                  </span>
                </div>
                {/* _原図 */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_原図</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BOOK1</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    BOOK1
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    BG1
                  </span>
                </div>
                {/* _pool */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_pool</span>
                  <span className={styles.labelArchive}>除外</span>
                </div>
                {/* 用紙 */}
                <div className={styles.layerRow}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName} style={{ color: 'var(--color-text-subtle)' }}>用紙</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    （自動非表示）
                  </span>
                </div>
              </div>

              <div className={styles.calloutInfo}>
                このサンプルには CSP Paperback の主要機能がすべて詰まっています：
                <span className={styles.strong}>単体出力</span>（_撮影指示、_原図、_BOOK1、_BG はレイヤーフォルダ名の先頭に _ を付けて自動指定）、
                <span className={styles.strong}>工程フォルダリスト</span>によるトラック分離型（演出）とセル内蔵型（_s）、
                <span className={styles.strong}>_付きフォルダの除外リスト</span>（_pool）。
                各機能の詳細は以降のセクションで解説します。
              </div>

              <h3 className={styles.h2}>XDTS タイムシート（c001.xdts）</h3>
              <p className={styles.p}>
                XDTS ファイルにはアニメーションのタイミング情報が記録されています。
                このサンプルでは 3 つのトラック（A, B, A）があり、PSD 内の同名フォルダに対応します。
              </p>
              <div className={styles.timesheetDiagram}>
                <table className={styles.timesheetTable}>
                  <thead>
                    <tr>
                      <th>フレーム</th>
                      <th>A（演出）</th>
                      <th>B（作画）</th>
                      <th>A（作画）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td className={styles.cellActive}>1</td>
                      <td className={styles.cellEmpty}>-</td>
                      <td className={styles.cellActive}>1</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td className={styles.cellActive}>↓</td>
                      <td className={styles.cellEmpty}>-</td>
                      <td className={styles.cellActive}>↓</td>
                    </tr>
                    <tr>
                      <td>3</td>
                      <td className={styles.cellEmpty}>-</td>
                      <td className={styles.cellActive}>1</td>
                      <td className={styles.cellEmpty}>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.calloutInfo}>
                XDTSのトラック名とPSDのフォルダ名が一致すると、自動的にアニメーションフォルダとして認識されます。
                同名のフォルダが複数あっても（この例では A が 2 つ）、それぞれ別のアニメーションフォルダとして扱われます。
              </div>

              <h3 className={styles.h2}>出力結果と合成内訳</h3>
              <p className={styles.p}>
                このサンプルで出力すると、以下のファイルが生成されます。
                各ファイルは<span className={styles.strong}>対象レイヤー</span>と
                <span className={styles.strong}>共通素材</span>（memo, Frame）を重ねた結果です。
                合成式はレイヤーツリーの上（前面）→ 下（背面）の順で表記しています。
              </p>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>単体出力の素材は、他の画像には混ざりません。</span>
                同じフォルダの中に <code className={styles.code}>_BG</code> や ★ マーク素材があっても、
                それらは別ファイルとして扱われ、アニメセルや別素材の画像には入りません。
                同じ親フォルダの中に普通の素材が残っている場合は、その普通の素材だけが一緒に重なります。
              </div>

              <div className={styles.compositeList}>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>A/A_0001_e.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>演出/A/1</span>
                  </div>
                  <div className={styles.compositeNote}>
                    親フォルダ「演出」が工程フォルダリストの <code className={styles.code}>_e</code> に一致 → サフィックス付き
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>B/B_0001.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>作画/B/1（_s 除外）</span>
                  </div>
                  <div className={styles.compositeNote}>
                    線画1 + 影を合成。工程サブフォルダ _s の内容は除外される
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>B/B_0001_s.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>作画/B/1/_s</span>
                  </div>
                  <div className={styles.compositeNote}>
                    セル内のフォルダ「_s」が工程フォルダリストに一致 → サフィックス付きで分離出力
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>A/A_0001.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>作画/A/1</span>
                  </div>
                  <div className={styles.compositeNote}>
                    親フォルダ「作画」は工程フォルダリスト未登録 → サフィックスなし（本体）
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_PAN.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_撮影指示/_PAN</span>
                  </div>
                  <div className={styles.compositeNote}>
                    整理用の _撮影指示 配下から、_PAN を単体出力
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_SL.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_撮影指示/_SL</span>
                  </div>
                  <div className={styles.compositeNote}>
                    整理用の _撮影指示 配下から、_SL を単体出力
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_BOOK1.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_原図/_BOOK1</span>
                  </div>
                  <div className={styles.compositeNote}>
                    整理用の _原図 配下から、_BOOK1 を単体出力
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_BG.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_原図/_BG</span>
                  </div>
                  <div className={styles.compositeNote}>
                    整理用の _原図 配下から、_BG を単体出力
                  </div>
                </div>
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 一緒に重なる共通素材：</span>
                フレーム枠線、メモ、用紙など、表示中の普通のレイヤーはセルや単体素材を書き出すときに一緒に重なります。
                このヘルプでは必要に応じて、それを<span className={styles.em}>コンテキストレイヤー</span>と呼びます。
                フォルダの中に <code className={styles.code}>_BG</code> や ★ 素材が混ざっていても、その素材だけは他の画像に混ざらず、残りの普通のレイヤーだけが一緒に重なります。
                <code className={styles.code}>_pool</code> のように除外リストに入っている名前は、先頭が _ でも別ファイルにはなりません。
                表示したままだと普通の素材として重なることがあるので、出力に入れたくない作業用フォルダは非表示にしてください。
              </div>
            </section>

            {/* ===== 5. 単体出力の指定方法 ===== */}
            <section className={styles.section} data-section="auto-mark">
              <h2 className={styles.h1}>📁 単体出力の指定方法</h2>

              <p className={styles.p}>
                単体出力は、セルの合成には混ぜたくないけれど書き出しには含めたい素材を、
                セルとは別ファイルにする機能です。背景原図、BOOK、撮影指示、PAN/SL 指示などに使います。
                アニメーションしない素材を、CSPのアニメーションセル出力で自動出力させるためだけにアニメーションフォルダへ入れたり、
                タイムシート上のトラックとして管理したりする必要はありません。
                便利に使うなら、CSP側で作業している時点でレイヤーフォルダ名の先頭へ
                <code className={styles.code}>_</code>（アンダースコア）を付けておく運用がおすすめです。
                名前を変えたくない素材や、読み込み後に追加で別出力したい素材は右ペインの
                <span className={styles.em}> ★ </span>で指定します。どちらも出力上は同じ「単体出力」です。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconMark}>★</span>
                  <span className={styles.layerNameMark}>撮影指示</span>
                  <span className={styles.labelMark}>手動</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → CSP側の名前を変えずに「撮影指示.jpg」として出力
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_撮影指示</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 直下が別ファイル素材だけなら整理用として親は出力しない
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_PAN</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 入れ子の、先頭に _ を付けたレイヤーフォルダも個別に出力
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_SL</span>
                  <span className={styles.labelMark}>★ 自動</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_原図</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 直下が別ファイル素材だけなら整理用として親は出力しない
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BOOK1</span>
                  <span className={styles.labelMark}>★ 自動</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>★ 自動</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_pool</span>
                  <span className={styles.labelArchive}>除外</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 単体出力しない（除外リスト）
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_old</span>
                  <span className={styles.labelArchive}>除外</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 単体出力しない（除外リスト）
                  </span>
                </div>
              </div>

              <h3 className={styles.h2}>ルール</h3>
              <ul className={styles.ul}>
                <li>
                  レイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付ける方法は
                  CSP側で先に「これは別ファイルで出したい」と決めておく方法です。
                  <span className={styles.em}>★</span> は読み込み後にレイヤー・フォルダのどちらにも付けられます
                </li>
                <li>
                  CSPで非表示にして保存した <code className={styles.code}>_</code> フォルダも、読み込み直後は「出したい素材」として表示ONになります。
                  アプリ上で目を閉じたものは出力されません
                </li>
                <li>
                  表示中の単体出力素材は、アニメーションセルの合成対象から外れ、別ファイルとして出力されます
                </li>
                <li>
                  フォルダ内に単体出力素材と普通の素材が混ざっている場合、単体出力素材だけが別ファイルになり、普通の素材はセル画像に一緒に重なります
                </li>
                <li>
                  <code className={styles.code}>_原図</code> のような親フォルダの直下が「別ファイルで出す素材」だけなら、親は整理用フォルダとして扱い、親全体をまとめた画像は出しません。
                  直下に普通のレイヤーや普通のフォルダが混じる場合は、親全体をまとめた画像も出します
                </li>
                <li>
                  <span className={styles.strong}>アニメーションフォルダの中</span>にある、先頭に _ を付けたレイヤーフォルダは自動マークされません
                  （アニメーションセルとして扱われます）
                </li>
                <li>
                  先頭に _ を付けたレイヤーフォルダがXDTSで検出された場合、または 🎬 で手動指定された場合は、
                  単体出力ではなく<span className={styles.strong}>アニメーションフォルダとしてのセル出力</span>を優先します
                </li>
                <li>
                    <span className={styles.strong}>_付きフォルダの除外リスト</span>
                    （デフォルト: <code className={styles.code}>_old</code>、<code className={styles.code}>_pool</code>）
                    に一致するフォルダは、先頭が _ でも別ファイルにはなりません。
                    表示中なら普通の素材としてセル画像に重なることがあるため、完全に出力へ入れたくない作業用フォルダは非表示にしてください
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 使い分け：</span>
                CSPで作業している時点から「セル合成には混ぜず、別素材として出す」と決めている背景原図や撮影指示は、
                レイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付けておくのが推奨です。
                CSP Paperbackで読み込んだ時点で単体出力として扱われるため、カットごとに ★ を押し直す必要がありません。
                読み込み後に追加で別出力したい素材や、CSP側の名前を変えたくない素材は ★ で後から指定します。
                「設定」ダイアログの「_付きフォルダの除外リスト」で、<code className={styles.code}>_old</code> や
                <code className={styles.code}>_pool</code> のような作業用フォルダを単体出力の対象から外せます。
              </div>
            </section>

            {/* ===== 6. ★で後から単体出力 ===== */}
            <section className={styles.section} data-section="single-mark">
              <h2 className={styles.h1}>⭐ ★で後から単体出力</h2>

              <p className={styles.p}>
                ★ は「レイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付ける」方法と同じ単体出力を、CSP側の名前を変えずに
                読み込み後のレイヤーツリーで指定するためのボタンです。
                レイヤーツリーの各レイヤー/フォルダの横にある
                <span className={styles.em}> ★ ボタン</span>をクリックすると、
                そのレイヤーを<span className={styles.strong}>個別画像として出力</span>するマークがつきます。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconMark}>★</span>
                  <span className={styles.layerNameMark}>エフェクトA</span>
                  <span className={styles.labelMark}>手動マーク</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「エフェクトA.jpg」として出力
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconMark}>★</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>自動マーク</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 先頭に _ を付けたレイヤーフォルダにより自動
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span style={{ color: 'var(--color-border-strong)', fontSize: '0.85rem' }}>☆</span>
                  <span className={styles.layerName}>レイヤー1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → マークなし（セル出力に含まれる）
                  </span>
                </div>
              </div>

              <h3 className={styles.h2}>自動マーク vs 手動マーク</h3>
              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th></th>
                    <th>自動マーク</th>
                    <th>手動マーク</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>マーク方法</td>
                    <td>CSP側でレイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付ける</td>
                    <td>CSP Paperback 読み込み後に ★ ボタンクリック</td>
                  </tr>
                  <tr>
                    <td>対象</td>
                    <td>フォルダのみ</td>
                    <td>レイヤー・フォルダ両方</td>
                  </tr>
                  <tr>
                    <td>CSP側での準備</td>
                    <td>フォルダ名変更のみ</td>
                    <td>不要（Paperback上で設定）</td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutInfo}>
                マークされたレイヤーは、フレーム枠線やメモなど周囲の共通素材と重なった状態で出力されます。
                アニメーションセルの素材には混ぜ込まず、合成モード（乗算、スクリーン等）もそのまま反映されます。
              </div>
            </section>

            {/* ===== 7. 手動アニメーションフォルダ指定 ===== */}
            <section className={styles.section} data-section="manual-anim-folder">
              <h2 className={styles.h1}>🎬 手動アニメーションフォルダ指定</h2>

              <p className={styles.p}>
                <span className={styles.strong}>手動アニメーションフォルダ指定</span>は、
                XDTSで検出されなかったPSD内のフォルダを
                <span className={styles.em}>アニメーションフォルダとして扱う</span>ための機能です。
                これは単体出力ではなく、フォルダ直下の子をセルとして1枚ずつ出すための補助機能です。
                通常はPSDとXDTSをセットで読み込み、XDTSで検出できなかったフォルダだけを補います。
                右ペインのレイヤーツリーで対象フォルダの横にある 🎬 ボタンをクリックすると、
                そのフォルダ直下の子レイヤー/子フォルダがセルとして出力されます。
              </p>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>⚠ 非表示とXDTS：</span>
                CSP側でアニメーションフォルダを非表示にしたままXDTSを書き出すと、そのトラックがXDTSに入らないことがあります。
                XDTSに入っていないフォルダは、PSDに残っていても自動ではセル出力になりません。
                必要な場合は、親フォルダも含めて表示状態にしてから 🎬 で指定してください。
                アプリ上で非表示にしたアニメーションフォルダやセルは書き出されません。
              </div>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_原図</span>
                  <span className={styles.labelMark}>★ 自動</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconAnim}>🎬</span>
                  <span className={styles.layerNameAnim}>_BOOK1</span>
                  <span className={styles.labelAnim}>手動アニメーション</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → _BOOK1_0001.jpg などをセルごとに出力
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>2</span>
                </div>
              </div>

              <h3 className={styles.h2}>使う場面</h3>
              <ul className={styles.ul}>
                <li>
                  CSP側でアニメーションフォルダが非表示だったため、XDTSにそのトラックが書き出されなかった場合
                </li>
                <li>
                  どうしてもXDTSを用意できない状態で、PSD上のフォルダ構造からセルごとに出力したい場合
                </li>
                <li>
                  背景・BOOK・参考素材などを、単体画像ではなくフォルダ直下のセル1枚ずつに分けて出力したい場合
                </li>
                <li>
                  紙スキャン素材をPSDに並べただけでタイムシートがないカットを、CSPでタイムシートを作り直さずにフォルダ直下の素材をセルとして扱いたい場合
                </li>
                <li>
                  PSDだけで受け取った素材が独自ルールのフォルダに入っていて、そのフォルダ直下のレイヤー/フォルダを1枚ずつ出力したい場合
                </li>
              </ul>

              <h3 className={styles.h2}>同名フォルダがある場合</h3>
              <p className={styles.p}>
                XDTSで検出されたアニメーションフォルダを優先し、手動指定したフォルダはその後ろに追加されたものとして扱います。
                同じ出力名になりそうな場合は、PSDのフォルダ名は変えずに、出力名だけ
                <code className={styles.code}>A(2)</code> のように自動でずらします。
              </p>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>PSD内のフォルダ</th>
                    <th>扱い</th>
                    <th>出力例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code className={styles.code}>作画/A</code></td>
                    <td>XDTSで検出</td>
                    <td><code className={styles.code}>A/A_0001.jpg</code></td>
                  </tr>
                  <tr>
                    <td><code className={styles.code}>素材/A</code></td>
                    <td>🎬で手動指定</td>
                    <td><code className={styles.code}>A(2)/A(2)_0001.jpg</code></td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>指定できない場合：</span>
                すでにアニメーションフォルダを含む親フォルダや、アニメーションフォルダ配下の子フォルダには 🎬 ボタンが出ません。
                親と子を同時にアニメーションフォルダとして扱うと「どこからどこまでを1セルにするか」が曖昧になるためです。
                その場合は、セルとして出したい一番内側のフォルダだけを指定します。
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 単体出力との違い：</span>
                <code className={styles.code}>_BOOK1</code> をそのままにすると1枚の単体画像として出力されます。
                🎬 で手動アニメーションフォルダにすると、直下の子をセルとして
                <code className={styles.code}>_BOOK1_0001.jpg</code> のように1枚ずつ出力します。
              </div>
            </section>

            {/* ===== 7b. 自動アニメフォルダ化 ===== */}
            <section className={styles.section} data-section="auto-anim-folder">
              <h2 className={styles.h1}>🎬 自動アニメーションフォルダ化（オレンジ）</h2>

              <p className={styles.p}>
                <span className={styles.strong}>自動アニメーションフォルダ化</span>は、
                <code className={styles.code}>_</code> で始まるフォルダ（単体出力の対象）の
                <span className={styles.em}>直下に工程フォルダ</span>（<code className={styles.code}>_e</code> や <code className={styles.code}>_s</code> 等、工程フォルダリストに登録されている名前）がある場合に、
                その <code className={styles.code}>_</code> フォルダを
                <span className={styles.em}>自動的にアニメーションフォルダとして扱う</span>仕組みです。
                作画マンの背景原図と、それに対する演出修正などを、手動指定なしで別々のファイルとして書き出せます。
                対象フォルダはレイヤーツリー上で<span className={styles.em}>オレンジ色</span>で表示されます。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_原図</span>
                  <span className={styles.labelMark}>★ 自動</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconAnim} style={{ filter: 'drop-shadow(0 0 3px var(--color-orange))' }}>🎬</span>
                  <span className={styles.layerNameAnim} style={{ color: 'var(--color-orange)' }}>_BG</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    ← 直下に <code className={styles.code}>_e</code> があるので自動アニメ化
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>BG1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → <code className={styles.code}>_BG_BG1.jpg</code>（作画マンの原図）
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_e</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → <code className={styles.code}>_BG_e.jpg</code>（演出修正）
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BOOK1</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    ← 直下に工程フォルダがないので単体出力のまま
                  </span>
                </div>
              </div>

              <h3 className={styles.h2}>発動条件</h3>
              <ul className={styles.ul}>
                <li>
                  フォルダ名が <code className={styles.code}>_</code> で始まり、_付きフォルダの除外リストに入っていない
                </li>
                <li>
                  そのフォルダの<span className={styles.strong}>直下</span>に、工程フォルダリストへ登録した名前のフォルダがある（孫階層は見ません）
                </li>
                <li>
                  そのフォルダがXDTS検出や🎬手動指定で、すでにセル出力のフォルダになっていない
                </li>
                <li>
                  そのフォルダが、別のアニメーションフォルダの中に入っていない
                </li>
                <li>
                  そのフォルダの中に、すでにセル出力になるフォルダがない（入れ子になった場合は<span className={styles.strong}>内側を優先</span>）
                </li>
              </ul>

              <div className={styles.calloutInfo}>
                CSPで非表示にして保存した <code className={styles.code}>_</code> フォルダも、読み込み直後は「出したい素材」として表示ONになり、この判定の対象になります。
                一方、CSPではアニメーションフォルダだったが非表示のままXDTSに出なかったフォルダは、この自動アニメ化だけでは拾われません。
                必要な場合は表示状態にして 🎬 で手動指定してください。
              </div>

              <h3 className={styles.h2}>セル名の扱い</h3>
              <p className={styles.p}>
                自動アニメ化されたフォルダ配下のセル名は、出力名の設定（連番／連番セル名／セル名）に関わらず
                <span className={styles.strong}>直下のフォルダ／レイヤー名から <code className={styles.code}>_</code> を取り除いたもの</span>
                を使用します。
                <code className={styles.code}>_BG</code> のような親フォルダに対して、中身の <code className={styles.code}>BG1</code>、<code className={styles.code}>BOOK1</code> などは素材そのものの意味情報を持っているため、連番で上書きせず名前をそのまま残します。
              </p>

              <h3 className={styles.h2}>使う場面</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>背景原図＋演出修正を別の「紙」として出したい</span>
                  （作画マンの絵と、それに対する演出修正を別ファイルに）
                </li>
                <li>
                  PSDには<code className={styles.code}>_BG</code>、<code className={styles.code}>_BOOK1</code>など素材分類フォルダを作り、工程修正（<code className={styles.code}>_e</code>等）を素材ごとに入れている運用
                </li>
                <li>
                  手動で 🎬 を押して回る手間を省きたい場合
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 優先順位：</span>
                アニメーションフォルダの判定は
                <span className={styles.em}>XDTS検出 → 手動指定 → 自動アニメ化 → 単体出力</span>
                の順で決まります。XDTSや🎬で明示した方が常に優先されます。
                手動指定をやめたい場合は🎬を外し、自動アニメ化だけを止めたい場合は工程フォルダリストから該当名を取り除いてください。
              </div>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>工程フォルダリスト：</span>
                工程として扱うフォルダ名は<span className={styles.em}>右上の「設定」ダイアログ</span>から編集できます。
                プリセットは <code className={styles.code}>_e / 演出</code>、<code className={styles.code}>_s / 作監</code> など。
                リストが空の場合は自動アニメ化は発動しません。
              </div>
            </section>

            {/* ===== 8. 仮想セル ===== */}
            <section className={styles.section} data-section="virtual-set">
              <h2 className={styles.h1}>🧩 仮想セル</h2>

              <p className={styles.p}>
                <span className={styles.strong}>仮想セル</span>は、PSD 内の複数のレイヤーを
                自由に組み合わせて<span className={styles.em}>1枚の合成画像</span>として出力する機能です。
                CSP のアニメーションフォルダとは無関係に、任意のレイヤーを束ねることができます。BGとセルをコピーせずにレイアウト画像を作りたい時などにも使用できます。
              </p>

              <div className={styles.stepList}>
                <div className={styles.step}>
                  <div className={styles.stepNum}>1</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>仮想セルを作成</div>
                    <div className={styles.stepDesc}>
                      左ペインの「仮想セル」パネルで「＋ 追加」をクリック
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>2</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>メンバーレイヤーを追加</div>
                    <div className={styles.stepDesc}>
                      右ペインのレイヤーツリーからドラッグ＆ドロップで、
                      仮想セルに含めたいレイヤーを追加します
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>3</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>挿入位置を設定</div>
                    <div className={styles.stepDesc}>
                      仮想セルの ⠿ ハンドルをレイヤーツリーにドラッグすると、
                      出力時の挿入位置（どのレイヤーの上/下に合成するか）を指定できます。
                      挿入位置が未設定の場合、その仮想セルは出力対象になりません
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>4</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>出力</div>
                    <div className={styles.stepDesc}>
                      メンバーと挿入位置が設定されている仮想セルは、出力ボタンから ZIP / フォルダ書き出しの対象に含まれます
                    </div>
                  </div>
                </div>
              </div>

              <h3 className={styles.h2}>仮想セルのカスタマイズ</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>合成モード・不透明度のオーバーライド</span> —
                  メンバーごとに元のレイヤーとは異なる合成モードや不透明度を設定可能
                </li>
                <li>
                  <span className={styles.strong}>表示/非表示の切り替え</span> —
                  仮想セル内でのメンバーの表示状態を個別に制御
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 使用例：</span>
                「キャラ + BG+ BOOK」のような
                複合的な出力パターンを、仮想セルとして名前を付けて管理できます。
              </div>
            </section>

            {/* ===== 9. 工程フォルダリスト ===== */}
            <section className={styles.section} data-section="process-table">
              <h2 className={styles.h1}>🏭 工程フォルダリスト</h2>

              <p className={styles.p}>
                修正工程（演出、作監修正など）をセル出力時に自動でサフィックス付きの別ファイルとして分離出力できます。
                <span className={styles.strong}>工程フォルダリスト</span>にフォルダ名とサフィックスの対応を登録するだけで、
                テンプレートの構造に関係なく同じ設定で使えます。
                フォルダ名やサフィックスは固定ではなく、各スタジオのテンプレートや命名ルールに合わせて調整してください。
              </p>

              <div className={styles.calloutInfo}>
                工程フォルダリストは<span className={styles.strong}>2つのテンプレート形式</span>に対応しています。
                カット担当と修正担当が別フォルダで作業する「トラック分離型」でも、
                1つのセルフォルダ内に工程サブフォルダを置く「セル内蔵型」でも、
                同じ工程フォルダリスト設定で自動分離出力できます。
              </div>

              {/* --- パターン1: トラック分離型 --- */}
              <h3 className={styles.h2}>パターン1：トラック分離型（サンプル: 演出フォルダ）</h3>
              <p className={styles.p}>
                カット担当者と修正担当者がそれぞれ<span className={styles.strong}>別のフォルダ</span>に
                同じセル名の構造をコピーして作業するテンプレートです。
                工程フォルダリストに登録したフォルダ名が
                <span className={styles.em}>アニメーションフォルダの直接の親フォルダ名</span>に一致すると、
                そのトラック全体のセルにサフィックスが付きます。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>LO</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>演出</span>
                  <span className={styles.labelContext}>工程（親フォルダ）</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → A_0001_e.jpg
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>作画</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → A_0001.jpg（本体）
                  </span>
                </div>
              </div>

              <p className={styles.p}>
                親フォルダ名「演出」が工程フォルダリストの <code className={styles.code}>_e</code> に一致するため、
                その中のアニメーションフォルダ A のセルは <code className={styles.code}>A_0001_e.jpg</code> のように出力されます。
                一方、親フォルダ名「作画」はテーブル未登録なので本体（サフィックスなし）として出力されます。
                セル名が同じ「1」でも、フォルダ構造から自動で区別されます。
              </p>

              {/* --- パターン2: セル内蔵型 --- */}
              <h3 className={styles.h2}>パターン2：セル内蔵型（サンプル: _s フォルダ）</h3>
              <p className={styles.p}>
                1つのアニメーションフォルダ内で、各セルフォルダの中に
                <span className={styles.strong}>工程サブフォルダ</span>を置くテンプレートです。
                セル内のフォルダ名が工程フォルダリストに一致すると、その内容だけがサフィックス付きで分離出力されます。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>B</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_s</span>
                  <span className={styles.labelContext}>工程（サブフォルダ）</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>作監修正</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>線画1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>影</span>
                  <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    影1 / 影2
                  </span>
                </div>
              </div>

              <div className={styles.sectionArrow}>↓</div>

              <div className={styles.outputGrid}>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>本体</div>
                  <div className={styles.outputFilename}>B/B_0001.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>_s</div>
                  <div className={styles.outputFilename}>B/B_0001_s.jpg</div>
                </div>
              </div>

              <p className={styles.p}>
                工程フォルダ（_s）の内容はサフィックス付きの別ファイルとして出力され、
                それ以外の作画担当者の線画・影レイヤーとは合成されずに分離できます。
              </p>

              {/* --- 共通設定 --- */}
              <h3 className={styles.h2}>工程フォルダリストの設定</h3>
              <p className={styles.p}>
                設定ダイアログで以下のようにフォルダ名とサフィックスの対応を登録します。
                フォルダ名はカンマ区切りで複数指定でき、大文字・小文字を区別しません。
                初期設定では以下のテーブルが登録されています。
                必要に応じて、各スタジオで使っているテンプレートや命名ルールに合わせて変更してください。
              </p>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>サフィックス</th>
                    <th>フォルダ名</th>
                    <th>出力例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code className={styles.code}>_e</code></td>
                    <td>_e, 演出</td>
                    <td><code className={styles.code}>A_0001_e.jpg</code></td>
                  </tr>
                  <tr>
                    <td><code className={styles.code}>_s</code></td>
                    <td>_s, 作監</td>
                    <td><code className={styles.code}>B_0001_s.jpg</code></td>
                  </tr>
                  <tr>
                    <td><code className={styles.code}>_k</code></td>
                    <td>_k, 監督</td>
                    <td><code className={styles.code}>A_0001_k.jpg</code></td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 どちらの形式でも同じ工程フォルダリスト設定が使えます。</span>
                サンプルでは「演出」がトラック分離型（アニメーションフォルダの親フォルダ名）として、
                「_s」がセル内蔵型（セル内のサブフォルダ名）として、それぞれ自動的にマッチして分離出力されます。
              </div>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>📎 自動アニメーションフォルダ化との連動：</span>
                ここに登録したフォルダ名は、<code className={styles.code}>_</code> で始まるフォルダの直下に存在するとき、
                その親フォルダを<span className={styles.em}>自動的にアニメーションフォルダとして扱う</span>条件にも使われます。
                詳しくは「自動アニメフォルダ化」の項を参照してください。
              </div>
            </section>

            {/* ===== 10. 出力設定 ===== */}
            <section className={styles.section} data-section="export-settings">
              <h2 className={styles.h1}>⚙ 出力設定</h2>

              <p className={styles.p}>
                プレビューパネルの出力設定で、出力形式をカスタマイズできます。
              </p>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>設定</th>
                    <th>選択肢</th>
                    <th>説明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className={styles.strong}>フォーマット</span></td>
                    <td>JPG / PNG</td>
                    <td>出力画像の形式。JPGは軽量、PNGは透明対応</td>
                  </tr>
                  <tr>
                    <td><span className={styles.strong}>背景</span></td>
                    <td>白ベタ / 透明</td>
                    <td>透明はPNGのみ。JPG選択時は白ベタ固定</td>
                  </tr>
                  <tr>
                    <td><span className={styles.strong}>フォルダ分け</span></td>
                    <td>階層 / フラット</td>
                    <td>
                      階層: <code className={styles.code}>A/A_0001.jpg</code> のようにセルフォルダ名で分け{'\n'}
                      フラット: 全ファイルを同一階層に出力
                    </td>
                  </tr>
                  <tr>
                    <td><span className={styles.strong}>出力名</span></td>
                    <td>連番 / 連番セル名 / セル名 / シート連番</td>
                    <td>
                      連番: <code className={styles.code}>A_0001.jpg</code>{'\n'}
                      連番セル名: <code className={styles.code}>A_01_ア.jpg</code>{'\n'}
                      セル名: <code className={styles.code}>A_ア.jpg</code>{'\n'}
                      シート連番: タイムシート上の順番で番号を合わせる
                    </td>
                  </tr>
                  <tr>
                    <td><span className={styles.strong}>工程名の位置</span></td>
                    <td>後ろ / 前</td>
                    <td>
                      後ろ: <code className={styles.code}>A_0001_e.jpg</code>（セルごとに本体と修正を並べて確認しやすい）{'\n'}
                      前: <code className={styles.code}>A_e_0001.jpg</code>（工程ごとにシーケンス読み込みしやすい）
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3 className={styles.h2}>出力名のかんたん例</h3>
              <p className={styles.p}>
                たとえばアニメーションフォルダ <code className={styles.code}>A</code> に
                セル <code className={styles.code}>1</code>、<code className={styles.code}>2</code>、<code className={styles.code}>3</code> があり、
                2番だけ演出修正（<code className={styles.code}>_e</code>）がある場合です。
              </p>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>出力名</th>
                    <th>どういう時に使う？</th>
                    <th>出力例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>連番</td>
                    <td>セル名より、出力順の番号でそろえたい</td>
                    <td>
                      <code className={styles.code}>A_0001.jpg</code><br />
                      <code className={styles.code}>A_0002.jpg</code><br />
                      <code className={styles.code}>A_0003.jpg</code>
                    </td>
                  </tr>
                  <tr>
                    <td>連番セル名</td>
                    <td>番号もセル名も残したい</td>
                    <td>
                      <code className={styles.code}>A_01_1.jpg</code><br />
                      <code className={styles.code}>A_02_2.jpg</code><br />
                      <code className={styles.code}>A_03_3.jpg</code>
                    </td>
                  </tr>
                  <tr>
                    <td>セル名</td>
                    <td>CSPのセル名をそのままファイル名に使いたい</td>
                    <td>
                      <code className={styles.code}>A_1.jpg</code><br />
                      <code className={styles.code}>A_2.jpg</code><br />
                      <code className={styles.code}>A_3.jpg</code>
                    </td>
                  </tr>
                  <tr>
                    <td>シート連番</td>
                    <td>本体と修正工程を、タイムシート上の同じ位置の番号でそろえたい</td>
                    <td>
                      <code className={styles.code}>A_0001.jpg</code><br />
                      <code className={styles.code}>A_0002.jpg</code><br />
                      <code className={styles.code}>A_0002_e.jpg</code><br />
                      <code className={styles.code}>A_0003.jpg</code>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 シート連番はこういう意味です：</span>
                修正工程が2番にだけある場合、普通の連番だと修正工程側では最初の1枚なので
                <code className={styles.code}>A_0001_e.jpg</code> になりがちです。
                シート連番にすると、タイムシート上で2番目の位置にある修正として
                <code className={styles.code}>A_0002_e.jpg</code> になります。
              </div>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>DPI情報：</span>
                PSD に含まれる DPI（解像度）情報は、出力する JPG/PNG ファイルにも埋め込まれます。
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>クイック書き出しとの関係：</span>
                デスクトップ版で PSD と XDTS を EXE にドロップして書き出す場合も、この画面で保存されている出力設定を使います。
                先に通常起動で設定を確認しておくと、その後はドロップだけで同じ設定の書き出しを繰り返せます。
              </div>

              <h3 className={styles.h2}>合成エンジンの不透明度ルール</h3>
              <p className={styles.p}>
                CSP Paperback の合成エンジンは
                <span className={styles.em}>「一枚の紙に作画された状態を再現する」</span>
                という考え方で設計されています。
                アニメーション制作では、作業中の視認性のためにフォルダやセルの不透明度を下げて
                透かし表示にすることがよくあります。
                しかし、これは<span className={styles.strong}>作業用の設定であり、最終出力には反映すべきではありません</span>。
              </p>

              <table className={styles.comparisonTable}>
                <thead>
                  <tr>
                    <th>レイヤーの種類</th>
                    <th>不透明度の扱い</th>
                    <th>理由</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <span className={styles.strong}>フォルダなどの入れ物</span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                        工程フォルダ本体、アニメーションフォルダ直下の単体セルレイヤー など
                      </span>
                    </td>
                    <td><span className={styles.em}>100% に強制</span></td>
                    <td>作業中の透かし設定を出力に持ち込まないため</td>
                  </tr>
                  <tr>
                    <td>
                      <span className={styles.strong}>アートワーク</span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-dim)' }}>
                        セル内の線画・彩色・影付けなどの実作画レイヤー
                      </span>
                    </td>
                    <td>PSD の値をそのまま保持</td>
                    <td>作画者が意図した表現（半透明エフェクト等）を尊重するため</td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 なぜ便利？：</span>
                CSP 上でセルの不透明度を下げてオニオンスキン的に前後の動きを確認する、
                工程フォルダを薄くして下のレイヤーを透かし見する、
                といった作業スタイルでも、出力時にいちいち不透明度を100%に戻す必要がありません。
                CSP Paperback が構造上の「入れ物」と「中身の絵」を自動判別し、
                入れ物の透かしだけをリセットして正しい出力を生成します。
              </div>
            </section>

            {/* ===== 11. 操作Tips ===== */}
            <section className={styles.section} data-section="shortcuts">
              <h2 className={styles.h1}>⌨ 操作Tips</h2>

              <h3 className={styles.h2}>キーボードショートカット</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutAction}>元に戻す</span>
                  <span><span className={styles.kbd}>Ctrl</span> + <span className={styles.kbd}>Z</span></span>
                </div>
                <div className={styles.shortcutRow}>
                  <span className={styles.shortcutAction}>やり直し</span>
                  <span><span className={styles.kbd}>Ctrl</span> + <span className={styles.kbd}>Shift</span> + <span className={styles.kbd}>Z</span></span>
                </div>
              </div>

              <h3 className={styles.h2}>レイヤーツリー操作</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>フォルダの展開/折りたたみ</span> —
                  フォルダ名のシェブロンをクリック。<span className={styles.kbd}>Alt</span> + クリックで子フォルダも再帰的に展開/折りたたみ
                </li>
                <li>
                  <span className={styles.strong}>表示/非表示トグル</span> —
                  👁 アイコンをクリック。ドラッグで複数レイヤーを一括切り替え
                </li>
                <li>
                  <span className={styles.strong}>Shift + スクロール</span> —
                  表示中のレイヤーを順番に切り替え
                </li>
              </ul>

              <h3 className={styles.h2}>ファイルの読み込み</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>ドラッグ＆ドロップ</span> —
                  PSD、XDTS、JSON ファイルをウィンドウにドロップで読み込み
                </li>
                <li>
                  <span className={styles.strong}>EXEへのドロップ</span> —
                  デスクトップ版では PSD と XDTS を1つずつ EXE またはショートカットにドロップすると、そのままクイック書き出しを開始
                </li>
                <li>
                  <span className={styles.strong}>複数ファイル同時選択</span> —
                  「ファイルを開く」で PSD + XDTS を同時に選んで開けます
                </li>
              </ul>

              <h3 className={styles.h2}>設定の保存・共有</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>設定を書き出す / 読み込む</span> —
                  工程フォルダリストと _付きフォルダの除外リストを保存・読み込みできます。スタジオ内で同じ設定を共有したり、別端末へ移したりするときに使います
                </li>
              </ul>

            </section>

          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
