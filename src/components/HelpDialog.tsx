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
  { id: 'auto-mark', label: '_フォルダ自動マーク' },
  { id: 'single-mark', label: '単体出力マーク ★' },
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
                「背景は含めるがエフェクトは含めない」「特定のレイヤーだけ別途出力したい」といった
                きめ細かい制御ができません。
              </div>

              <h3 className={styles.h2}>具体的に困るケース</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>背景（BG）</span>をセルと合成して出力したいが、
                  エフェクトレイヤーは別ファイルにしたい
                </li>
                <li>
                  <span className={styles.strong}>複数のアニメーションフォルダ</span>（A/B/C セル）があるとき、
                  それぞれに異なる外部レイヤーを組み合わせたい
                </li>
                <li>
                  <span className={styles.strong}>撮影指示用のレイヤー</span>（エフェクト、フレア、グロウなど）を
                  セルとは独立して個別出力したい
                </li>
                <li>
                  <span className={styles.strong}>工程ごとの分離出力</span>（線画、演出、彩色など）を
                  セル単位で自動分割したい
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
                    <td>BGと合成してセル出力</td>
                    <td><span className={styles.crossMark}>△</span> 全外部レイヤー込み</td>
                    <td><span className={styles.checkMark}>✓</span> 選択的に合成</td>
                  </tr>
                  <tr>
                    <td>特定レイヤーだけ別出力</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> ★マーク / _フォルダ</td>
                  </tr>
                  <tr>
                    <td>レイヤーの任意組み合わせ</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> 仮想セル</td>
                  </tr>
                  <tr>
                    <td>工程ごとの分離出力</td>
                    <td><span className={styles.crossMark}>✗</span> 不可</td>
                    <td><span className={styles.checkMark}>✓</span> 工程テーブル</td>
                  </tr>
                  <tr>
                    <td>DPI情報の保持</td>
                    <td><span className={styles.checkMark}>✓</span></td>
                    <td><span className={styles.checkMark}>✓</span> JPG/PNG共に対応</td>
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
                CSP から PSD で書き出し → CSP Paperback で読み込み → 柔軟なセル出力を ZIP で取得。
                アニメ制作現場の「痒いところに手が届く」出力パターンを自動化します。
              </div>

              <h3 className={styles.h2}>主な機能</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>_フォルダ自動マーク</span> — フォルダ名の先頭に
                  <code className={styles.code}>_</code> をつけるだけで、セルとは別に単体出力
                </li>
                <li>
                  <span className={styles.strong}>★ 単体出力マーク</span> — 任意のレイヤーに手動マークして個別出力
                </li>
                <li>
                  <span className={styles.strong}>仮想セル</span> — 好きなレイヤーを自由に組み合わせて合成画像を出力
                </li>
                <li>
                  <span className={styles.strong}>工程テーブル</span> — セル内のフォルダ名に応じて
                  自動でサフィックス付き分離出力
                </li>
                <li>
                  <span className={styles.strong}>XDTSタイムシート</span> — CLIP STUDIO のタイムシートから
                  アニメーションフォルダを自動検出
                </li>
                <li>
                  <span className={styles.strong}>合成モード保持</span> — 乗算・スクリーンなどの
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
                  <div className={styles.flowBoxValue}>CSPでPSD書き出し</div>
                </div>
                <span className={styles.flowArrow}>→</span>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 2</div>
                  <div className={styles.flowBoxValue}>XDTS書き出し</div>
                </div>
                <span className={styles.flowArrow}>→</span>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 3</div>
                  <div className={styles.flowBoxValue}>Paperbackで開く</div>
                </div>
                <span className={styles.flowArrow}>→</span>
                <div className={styles.flowBox}>
                  <div className={styles.flowBoxLabel}>Step 4</div>
                  <div className={styles.flowBoxValue}>ZIP出力</div>
                </div>
              </div>

              <div className={styles.stepList}>
                <div className={styles.step}>
                  <div className={styles.stepNum}>1</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>CSPからPSD書き出し</div>
                    <div className={styles.stepDesc}>
                      CLIP STUDIO PAINT で ファイル → 別名で保存 → Photoshopドキュメント（.psd）で保存します。
                      レイヤー構造がそのまま保持されます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>2</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>XDTSタイムシート書き出し</div>
                    <div className={styles.stepDesc}>
                      ファイル → アニメーション書き出し → タイムシート情報の書き出し → XDTS形式を選択。
                      これによりアニメーションフォルダの検出が自動化されます。
                      XDTSがなくても手動でアニメーションフォルダを指定できます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>3</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>CSP Paperback で開く</div>
                    <div className={styles.stepDesc}>
                      「ファイルを開く」ボタンで PSD と XDTS を同時選択して開きます
                      （ドラッグ＆ドロップにも対応）。
                      レイヤーツリーが右ペインに表示され、アニメーションフォルダが自動検出されます。
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>4</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>必要に応じてマーク設定 → ZIP出力</div>
                    <div className={styles.stepDesc}>
                      _フォルダや★マークでの出力指定を確認し、「出力」ボタンで ZIP をダウンロード。
                      出力形式（JPG/PNG）、背景色、フォルダ構造をカスタマイズできます。
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 Tips：</span>
                PSD と XDTS を同時に選択して「ファイルを開く」で読み込めます。
                また .cspb ファイルにはマーク・仮想セル・工程設定を保存できるので、
                次回は .cspb を開くだけで前回の設定を復元できます。
              </div>
            </section>

            {/* ===== 4. サンプルで理解する ===== */}
            <section className={styles.section} data-section="example">
              <h2 className={styles.h1}>📋 サンプルで理解する</h2>

              <p className={styles.p}>
                以下のようなPSDレイヤー構造とXDTSタイムシートがあるとします。
              </p>

              <h3 className={styles.h2}>PSD レイヤー構造</h3>
              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_エフェクト</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>フレア</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>グロウ</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>2</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>3</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>B</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>2</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>★ 自動マーク</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>空</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>地面</span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_old</span>
                  <span className={styles.labelArchive}>除外</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>ボツ案...</span>
                </div>
              </div>

              <h3 className={styles.h2}>XDTS タイムシート（抜粋）</h3>
              <p className={styles.p}>
                XDTS ファイルにはアニメーションのタイミング情報が記録されています。
                この例では、トラック A と B がそれぞれセルを持ちます。
              </p>
              <div className={styles.timesheetDiagram}>
                <table className={styles.timesheetTable}>
                  <thead>
                    <tr>
                      <th>フレーム</th>
                      <th>A</th>
                      <th>B</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>0</td>
                      <td className={styles.cellActive}>1</td>
                      <td className={styles.cellActive}>1</td>
                    </tr>
                    <tr>
                      <td>1</td>
                      <td className={styles.cellActive}>↓ (ホールド)</td>
                      <td className={styles.cellActive}>↓ (ホールド)</td>
                    </tr>
                    <tr>
                      <td>6</td>
                      <td className={styles.cellActive}>2</td>
                      <td className={styles.cellActive}>↓</td>
                    </tr>
                    <tr>
                      <td>12</td>
                      <td className={styles.cellActive}>3</td>
                      <td className={styles.cellActive}>2</td>
                    </tr>
                    <tr>
                      <td>…</td>
                      <td className={styles.cellEmpty}>…</td>
                      <td className={styles.cellEmpty}>…</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className={styles.calloutInfo}>
                XDTSのトラック名とPSDのフォルダ名が一致すると、自動的にアニメーションフォルダとして認識されます。
                上の例では PSD 内の「A」フォルダと「B」フォルダがアニメーションフォルダになります。
              </div>

              <h3 className={styles.h2}>出力結果</h3>
              <p className={styles.p}>
                このPSD + XDTS の組み合わせで出力すると、以下のファイルが生成されます。
              </p>

              <div className={styles.outputGrid}>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>A</div>
                  <div className={styles.outputFilename}>A/A_0001.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>A</div>
                  <div className={styles.outputFilename}>A/A_0002.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>A</div>
                  <div className={styles.outputFilename}>A/A_0003.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>B</div>
                  <div className={styles.outputFilename}>B/B_0001.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>B</div>
                  <div className={styles.outputFilename}>B/B_0002.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>★</div>
                  <div className={styles.outputFilename}>エフェクト.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>★</div>
                  <div className={styles.outputFilename}>BG.jpg</div>
                </div>
              </div>

              <p className={styles.p}>
                <span className={styles.em}>_エフェクト</span> と <span className={styles.em}>_BG</span> フォルダは
                先頭の <code className={styles.code}>_</code> により自動マークされ、
                セルとは独立した画像として出力されます（フォルダ名から <code className={styles.code}>_</code> は除去されます）。
                一方 <span className={styles.code}>_old</span> フォルダはアーカイブ除外パターンに一致するため、出力されません。
              </p>
            </section>

            {/* ===== 5. _フォルダ自動マーク ===== */}
            <section className={styles.section} data-section="auto-mark">
              <h2 className={styles.h1}>📁 _フォルダ自動マーク</h2>

              <p className={styles.p}>
                フォルダ名の先頭に <code className={styles.code}>_</code>（アンダースコア）をつけると、
                そのフォルダは<span className={styles.em}>自動的に単体出力マーク</span>されます。
                CSP側でフォルダ名を変えるだけなので、追加の操作は不要です。
              </p>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_BG</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「BG.jpg」として出力
                  </span>
                </div>
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerNameMark}>_エフェクト</span>
                  <span className={styles.labelMark}>★ 自動</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 「エフェクト.jpg」として出力
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
                <div className={styles.layerRow}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>_pool</span>
                  <span className={styles.labelArchive}>除外</span>
                  <span style={{ color: '#6c7086', fontSize: '0.72rem', marginLeft: '0.5rem' }}>
                    → 出力されない（アーカイブ除外）
                  </span>
                </div>
              </div>

              <h3 className={styles.h2}>ルール</h3>
              <ul className={styles.ul}>
                <li>
                  対象は<span className={styles.strong}>フォルダ</span>のみ（通常レイヤーは対象外）
                </li>
                <li>
                  <span className={styles.strong}>アニメーションフォルダの中</span>にある _フォルダは自動マークされません
                  （アニメーションセルとして扱われます）
                </li>
                <li>
                  出力ファイル名からは先頭の <code className={styles.code}>_</code> が除去されます
                </li>
                <li>
                  <span className={styles.strong}>アーカイブ除外パターン</span>
                  （デフォルト: <code className={styles.code}>_old</code>、<code className={styles.code}>_pool</code>）
                  に一致するフォルダは自動マークされません
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 アーカイブ除外パターンのカスタマイズ：</span>
                「設定」ダイアログの「アーカイブ除外パターン」で、自動マークから除外するフォルダ名のプレフィックスを
                自由に追加・編集できます。ボツ案や素材プールなどの作業用フォルダを誤って出力しないようにできます。
              </div>
            </section>

            {/* ===== 6. 単体出力マーク ===== */}
            <section className={styles.section} data-section="single-mark">
              <h2 className={styles.h1}>⭐ 単体出力マーク</h2>

              <p className={styles.p}>
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
                    → _フォルダにより自動
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
                    <td>フォルダ名 <code className={styles.code}>_</code> プレフィックス</td>
                    <td>★ボタンクリック</td>
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
                と合成された状態で出力されます。合成モード（乗算、スクリーン等）もそのまま反映されます。
              </div>
            </section>

            {/* ===== 7. 仮想セル ===== */}
            <section className={styles.section} data-section="virtual-set">
              <h2 className={styles.h1}>🧩 仮想セル</h2>

              <p className={styles.p}>
                <span className={styles.strong}>仮想セル</span>は、PSD 内の複数のレイヤーを
                自由に組み合わせて<span className={styles.em}>1枚の合成画像</span>として出力する機能です。
                CSP のアニメーションフォルダとは無関係に、任意のレイヤーを束ねることができます。
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
                    <div className={styles.stepTitle}>挿入位置を設定（任意）</div>
                    <div className={styles.stepDesc}>
                      仮想セルの ⠿ ハンドルをレイヤーツリーにドラッグすると、
                      出力時の挿入位置（どのレイヤーの上/下に合成するか）を指定できます
                    </div>
                  </div>
                </div>
                <div className={styles.step}>
                  <div className={styles.stepNum}>4</div>
                  <div className={styles.stepBody}>
                    <div className={styles.stepTitle}>出力</div>
                    <div className={styles.stepDesc}>
                      出力ボタンでZIPに含まれます。挿入位置が設定されていない場合は独立した画像として出力されます
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
                <li>
                  <span className={styles.strong}>アニメーションセルへの展開</span> —
                  アニメーションフォルダに挿入した場合、全セルに自動展開するオプション
                </li>
              </ul>

              <div className={styles.calloutTip}>
                <span className={styles.strong}>💡 使用例：</span>
                「キャラの影レイヤー（乗算）+ ハイライト（スクリーン）+ 背景の一部」のような
                複合的な出力パターンを、仮想セルとして名前を付けて管理できます。
              </div>
            </section>

            {/* ===== 8. 工程フォルダテーブル ===== */}
            <section className={styles.section} data-section="process-table">
              <h2 className={styles.h1}>🏭 工程フォルダテーブル</h2>

              <p className={styles.p}>
                アニメーションセルの中にフォルダを作って工程を分離している場合、
                <span className={styles.strong}>工程テーブル</span>を設定することで
                工程ごとに自動分離出力できます。
              </p>

              <h3 className={styles.h2}>例：セルの中に「EN」フォルダがある場合</h3>

              <div className={styles.layerDiagram}>
                <div className={styles.layerRow}>
                  <span className={styles.iconAnim}>📁</span>
                  <span className={styles.layerNameAnim}>A</span>
                  <span className={styles.labelAnim}>アニメーション</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent1}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>1</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconFolder}>📁</span>
                  <span className={styles.layerName}>EN</span>
                  <span className={styles.labelContext}>工程</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent3}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>演出線</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>線画</span>
                </div>
                <div className={`${styles.layerRow} ${styles.indent2}`}>
                  <span className={styles.iconLayer}>◆</span>
                  <span className={styles.layerName}>彩色</span>
                </div>
              </div>

              <p className={styles.p}>
                設定ダイアログで以下のように工程テーブルを設定します:
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
                    <td><code className={styles.code}>_en</code></td>
                    <td>EN, 演出, ens</td>
                    <td><code className={styles.code}>A_0001_en.jpg</code></td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.sectionArrow}>↓</div>

              <h3 className={styles.h2}>出力結果</h3>
              <div className={styles.outputGrid}>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>本体</div>
                  <div className={styles.outputFilename}>A/A_0001.jpg</div>
                </div>
                <div className={styles.outputCard}>
                  <div className={styles.outputThumb}>EN</div>
                  <div className={styles.outputFilename}>A/A_0001_en.jpg</div>
                </div>
              </div>

              <p className={styles.p}>
                工程フォルダ（EN）の内容はサフィックス付きの別ファイルとして出力され、
                それ以外の線画・彩色は本体ファイルに含まれます。
                フォルダ名はカンマ区切りで複数指定でき、大文字・小文字を区別しません。
              </p>
            </section>

            {/* ===== 9. 出力設定 ===== */}
            <section className={styles.section} data-section="export-settings">
              <h2 className={styles.h1}>⚙ 出力設定</h2>

              <p className={styles.p}>
                プレビューパネル下部の出力設定で、出力形式をカスタマイズできます。
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
                    <td><span className={styles.strong}>フォルダ構造</span></td>
                    <td>階層 / フラット</td>
                    <td>
                      階層: <code className={styles.code}>A/A_0001.jpg</code> のようにフォルダ分け{'\n'}
                      フラット: 全ファイルを同一階層に出力
                    </td>
                  </tr>
                  <tr>
                    <td><span className={styles.strong}>セル命名</span></td>
                    <td>連番 / セル名</td>
                    <td>
                      連番: <code className={styles.code}>A_0001.jpg</code>{'\n'}
                      セル名: <code className={styles.code}>A_1.jpg</code>（セル名をそのまま使用）
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.calloutInfo}>
                <span className={styles.strong}>DPI情報：</span>
                PSD に含まれる DPI（解像度）情報は、出力する JPG/PNG ファイルにも埋め込まれます。
                Photoshop や After Effects で開いた際に正しい解像度で表示されます。
              </div>
            </section>

            {/* ===== 10. 操作Tips ===== */}
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
                  フォルダ名の ▶ をクリック。<span className={styles.kbd}>Shift</span> + クリックで子フォルダも再帰的に展開/折りたたみ
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
                  PSD、XDTS、.cspb、JSON ファイルをウィンドウにドロップで読み込み
                </li>
                <li>
                  <span className={styles.strong}>複数ファイル同時選択</span> —
                  「ファイルを開く」で PSD + XDTS を同時に選んで開けます
                </li>
              </ul>

              <h3 className={styles.h2}>設定の保存と復元</h3>
              <ul className={styles.ul}>
                <li>
                  <span className={styles.strong}>.cspb ファイル</span> —
                  「設定保存」ボタンで、マーク・仮想セル・工程設定・XDTS を1ファイルにまとめて保存。
                  次回は .cspb を読み込むだけで復元できます
                </li>
                <li>
                  <span className={styles.strong}>JSON エクスポート/インポート</span> —
                  設定ダイアログから工程テーブルなどの設定を JSON で共有できます
                </li>
              </ul>

              <h3 className={styles.h2}>手動アニメーションフォルダ指定</h3>
              <p className={styles.p}>
                XDTS がなくても、レイヤーツリーでフォルダを選択し、
                アニメーションフォルダとして手動指定できます。
                アニメーションフォルダとして認識されたフォルダの子レイヤーは、
                それぞれ個別のセルとして出力されます。
              </p>
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
