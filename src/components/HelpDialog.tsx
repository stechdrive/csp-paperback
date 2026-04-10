import { useRef, useCallback } from 'react'
import styles from './HelpDialog.module.css'

interface HelpDialogProps {
  onClose: () => void
}

const TOC = [
  { id: 'problem', label: 'CSPセル出力の課題' },
  { id: 'overview', label: 'CSP Paperbackとは' },
  { id: 'workflow', label: '基本ワークフロー' },
  { id: 'example', label: 'サンプルで理解する' },
  { id: 'auto-mark', label: '単体出力の指定方法' },
  { id: 'single-mark', label: '★で後から指定' },
  { id: 'manual-anim-folder', label: '手動アニメフォルダ 🎬' },
  { id: 'virtual-set', label: '仮想セル' },
  { id: 'process-table', label: '工程フォルダテーブル' },
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
                アニメーションフォルダ内のセルを個別に書き出す機能です。
                しかし、<span className={styles.em}>アニメーションフォルダの「外」にあるレイヤー</span>の扱いに
                大きな制約があります。
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
                    <td><span className={styles.checkMark}>✓</span> 工程テーブルにフォルダ名を登録することで対応</td>
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
                CSP から PSD と XDTS を書き出し → CSP Paperback で読み込み → 柔軟なセル出力を ZIP で取得。
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
                  <span className={styles.strong}>修正工程テーブル</span> — セル内のフォルダ名に応じて、演出、作監など
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
                  <div className={styles.flowBoxValue}>ZIP出力</div>
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
                      CSP側で非表示だったためXDTSに出てこないフォルダなど、XDTSから拾えないものだけレイヤーツリーから補助的に手動指定できます。
                      出力対象のレイヤーを選ぶと出力時のプレビューが表示されます。XDTS読み込み済みの場合はシークバーでタイムシートを再生した状態を確認できます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>3</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>必要に応じてマーク設定 → ZIP出力</div>
                    <div className={styles.stepDesc}>
                      単体出力と 🎬 手動アニメーションフォルダ指定を確認し、「出力」ボタンで ZIP をダウンロード。
                      出力形式（JPG/PNG）、背景透過、出力時にセル名でフォルダを作るかをカスタマイズできます。
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 Tips：</span>
                PSD と XDTS は同時に選択して「ファイルを開く」で読み込めます。
                PSDとXDTSを読み込み済みの状態で新しいPSDまたはXDTSを開くと、新規プロジェクトとして読み直します。
                工程テーブルとアーカイブ除外パターンは設定ダイアログから JSON で共有できます。
              </div>
            </section>

            {/* ===== 4. サンプルで理解する ===== */}
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
                  <span className={styles.labelContext}>コンテキスト（全出力に合成）</span>
                </div>
                {/* Frame */}
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>Frame</span>
                  <span className={styles.labelContext}>コンテキスト（全出力に合成）</span>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    PAN指示
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_SL</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    BOOK1
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span className={styles.layerName} style={{ color: '#6c7086' }}>用紙</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    （自動非表示）
                  </span>
                </div>
              </div>

              <div className={styles.calloutInfo}>
                このサンプルには CSP Paperback の主要機能がすべて詰まっています：
                <span className={styles.strong}>単体出力</span>（_撮影指示、_原図、_BOOK1、_BG はレイヤーフォルダ名の先頭に _ を付けて自動指定）、
                <span className={styles.strong}>工程フォルダ</span>のトラック分離型（演出）とセル内蔵型（_s）、
                <span className={styles.strong}>アーカイブ除外</span>（_pool）。
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
                <span className={styles.strong}>コンテキストレイヤー</span>（memo, Frame）を合成した結果です。
                合成式はレイヤーツリーの上（前面）→ 下（背面）の順で表記しています。
              </p>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>入れ子になった、先頭に _ を付けたレイヤーフォルダは親から抜かれません。</span>
                親フォルダ自体が自動マークされている場合、その出力は配下の表示内容をまとめて合成します。
                配下にある別の「先頭に _ を付けたレイヤーフォルダ」は、親の画像に含まれたまま、追加で個別ファイルとしても出力されます。
                たとえば <code className={styles.code}>_原図.jpg</code> は <code className={styles.code}>_BOOK1</code> と
                <code className={styles.code}>_BG</code> を含む原図全体で、
                <code className={styles.code}>_BOOK1.jpg</code> と <code className={styles.code}>_BG.jpg</code> は
                それぞれを取り出した追加出力です。
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
                    親フォルダ「演出」が工程テーブルの <code className={styles.code}>_e</code> に一致 → サフィックス付き
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
                    セル内のフォルダ「_s」が工程テーブルに一致 → サフィックス付きで分離出力
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
                    親フォルダ「作画」は工程テーブル未登録 → サフィックスなし（本体）
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_撮影指示.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_撮影指示</span>
                  </div>
                  <div className={styles.compositeNote}>
                    _撮影指示配下をまとめて出力。_PAN/_SL は除外されず、この後で個別にも出力
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
                    親の _撮影指示 に含まれたまま、_PAN 単体としても追加出力
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
                    親の _撮影指示 に含まれたまま、_SL 単体としても追加出力
                  </div>
                </div>
                <div className={styles.compositeItem}>
                  <div className={styles.compositeFilename}>_原図.jpg</div>
                  <div className={styles.compositeFormula}>
                    <span className={styles.compositeCtx}>memo</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeCtx}>Frame</span>
                    <span className={styles.compositeOp}>+</span>
                    <span className={styles.compositeTarget}>_原図（_BOOK1 + _BG を含む）</span>
                  </div>
                  <div className={styles.compositeNote}>
                    _原図配下をまとめて出力。_BOOK1/_BG は除外されず、この後で個別にも出力
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
                    親の _原図 に含まれたまま、_BOOK1 単体としても追加出力
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
                    親の _原図 に含まれたまま、_BG 単体としても追加出力
                  </div>
                </div>
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 コンテキストレイヤーとは：</span>
                ルート直下でアニメーションフォルダでも★マークでもない通常レイヤーは
                <span className={styles.em}>コンテキストレイヤー</span>として、すべての出力画像に合成されます。
                フレーム枠線やメモなど、全セルに共通して含めたいレイヤーをルート直下に置くだけで自動的に反映されます。
                一方 <code className={styles.code}>_pool</code> はアーカイブ除外パターンに一致するため出力されません。
              </div>
            </section>

            {/* ===== 5. 単体出力の指定方法 ===== */}
            <section className={styles.section} data-section="auto-mark">
              <h2 className={styles.h1}>📁 単体出力の指定方法</h2>

              <p className={styles.p}>
                単体出力は、セルの合成には混ぜたくないけれど ZIP には出したい素材を、
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → CSP側の名前を変えずに「撮影指示.jpg」として出力
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_撮影指示</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「_撮影指示.jpg」として出力
                  </span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_PAN</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「_原図.jpg」として出力
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 出力されない（アーカイブ除外）
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_old</span>
                  <span className={styles.labelArchive}>除外</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 出力されない（アーカイブ除外）
                  </span>
                </div>
              </div>

              <h3 className={styles.h2}>ルール</h3>
              <ul className={styles.ul}>
                <li>
                  レイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付ける方法は
                  <span className={styles.strong}>フォルダ限定</span>の事前指定です。
                  <span className={styles.em}>★</span> は読み込み後にレイヤー・フォルダのどちらにも付けられます
                </li>
                <li>
                  単体出力にした素材は、アニメーションセルの合成対象から外れ、別ファイルとして出力されます
                </li>
                <li>
                  親子で単体出力にした場合、親の出力には子の表示内容も含まれ、子は追加で個別にも出力されます
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
                  <span className={styles.strong}>アーカイブ除外パターン</span>
                  （デフォルト: <code className={styles.code}>_old</code>、<code className={styles.code}>_pool</code>）
                  に一致するフォルダは自動マークされません
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 使い分け：</span>
                CSPで作業している時点から「セル合成には混ぜず、別素材として出す」と決めている背景原図や撮影指示は、
                レイヤーフォルダ名の先頭に <code className={styles.code}>_</code> を付けておくのが推奨です。
                CSP Paperbackで読み込んだ時点で単体出力として扱われるため、カットごとに ★ を押し直す必要がありません。
                読み込み後に追加で別出力したい素材や、CSP側の名前を変えたくない素材は ★ で後から指定します。
                「設定」ダイアログの「アーカイブ除外パターン」で、<code className={styles.code}>_old</code> や
                <code className={styles.code}>_pool</code> のような作業用フォルダを自動マークから除外できます。
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「エフェクトA.jpg」として出力
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconMark}>★</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>自動マーク</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 先頭に _ を付けたレイヤーフォルダにより自動
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span style={{ color: '#45475a', fontSize: '0.85rem' }}>☆</span>
                  <span className={styles.layerName}>レイヤー1</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                マークされたレイヤーは、上下のコンテキストレイヤー（アニメーションフォルダ外の通常レイヤー）
                と合成された状態で出力されます。アニメーションセルの素材には混ぜ込まず、合成モード（乗算、スクリーン等）もそのまま反映されます。
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                      メンバーと挿入位置が設定されている仮想セルは、出力ボタンでZIPに含まれます
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

            {/* ===== 9. 工程フォルダテーブル ===== */}
            <section className={styles.section} data-section="process-table">
              <h2 className={styles.h1}>🏭 工程フォルダテーブル</h2>

              <p className={styles.p}>
                修正工程（演出、作監修正など）をセル出力時に自動でサフィックス付きの別ファイルとして分離出力できます。
                <span className={styles.strong}>工程テーブル</span>にフォルダ名とサフィックスの対応を登録するだけで、
                テンプレートの構造に関係なく同じ設定で使えます。
              </p>

              <div className={styles.calloutInfo}>
                工程テーブルは<span className={styles.strong}>2つのテンプレート形式</span>に対応しています。
                カット担当と修正担当が別フォルダで作業する「トラック分離型」でも、
                1つのセルフォルダ内に工程サブフォルダを置く「セル内蔵型」でも、
                同じ工程テーブル設定で自動分離出力できます。
              </div>

              {/* --- パターン1: トラック分離型 --- */}
              <h3 className={styles.h2}>パターン1：トラック分離型（サンプル: 演出フォルダ）</h3>
              <p className={styles.p}>
                カット担当者と修正担当者がそれぞれ<span className={styles.strong}>別のフォルダ</span>に
                同じセル名の構造をコピーして作業するテンプレートです。
                工程テーブルに登録したフォルダ名が
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → A_0001.jpg（本体）
                  </span>
                </div>
              </div>

              <p className={styles.p}>
                親フォルダ名「演出」が工程テーブルの <code className={styles.code}>_e</code> に一致するため、
                その中のアニメーションフォルダ A のセルは <code className={styles.code}>A_0001_e.jpg</code> のように出力されます。
                一方、親フォルダ名「作画」はテーブル未登録なので本体（サフィックスなし）として出力されます。
                セル名が同じ「1」でも、フォルダ構造から自動で区別されます。
              </p>

              {/* --- パターン2: セル内蔵型 --- */}
              <h3 className={styles.h2}>パターン2：セル内蔵型（サンプル: _s フォルダ）</h3>
              <p className={styles.p}>
                1つのアニメーションフォルダ内で、各セルフォルダの中に
                <span className={styles.strong}>工程サブフォルダ</span>を置くテンプレートです。
                セル内のフォルダ名が工程テーブルに一致すると、その内容だけがサフィックス付きで分離出力されます。
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
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
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
              <h3 className={styles.h2}>工程テーブルの設定</h3>
              <p className={styles.p}>
                設定ダイアログで以下のようにフォルダ名とサフィックスの対応を登録します。
                フォルダ名はカンマ区切りで複数指定でき、大文字・小文字を区別しません。
                初期設定では以下のテーブルが登録されています。
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
                <span className={styles.strong}>💡 どちらの形式でも同じ工程テーブル設定が使えます。</span>
                サンプルでは「演出」がトラック分離型（アニメーションフォルダの親フォルダ名）として、
                「_s」がセル内蔵型（セル内のサブフォルダ名）として、それぞれ自動的にマッチして分離出力されます。
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
                    <td><span className={styles.strong}>セル命名</span></td>
                    <td>連番 / セル名</td>
                    <td>
                      連番: <code className={styles.code}>A_0001.jpg</code>{'\n'}
                      セル名: <code className={styles.code}>A_ア.jpg</code>（セル名をそのまま使用）
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

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>DPI情報：</span>
                PSD に含まれる DPI（解像度）情報は、出力する JPG/PNG ファイルにも埋め込まれます。
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
                      <span className={styles.strong}>構造コンテナ</span>
                      <br />
                      <span style={{ fontSize: '0.75rem', color: '#9399b2' }}>
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
                      <span style={{ fontSize: '0.75rem', color: '#9399b2' }}>
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
                  <span className={styles.strong}>複数ファイル同時選択</span> —
                  「ファイルを開く」で PSD + XDTS を同時に選んで開けます
                </li>
              </ul>

              <h3 className={styles.h2}>設定の保存と復元</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>JSON エクスポート/インポート</span> —
                  設定ダイアログから工程テーブルとアーカイブ除外パターンを JSON で共有できます
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
