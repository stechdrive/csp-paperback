import { HelpFigure } from './HelpFigure'
import { HELP_HIGHLIGHTS } from './helpHighlights'
import { ja } from '../../i18n/ja'
import { OutputSettingsGuide } from './OutputSettingsGuide'
import styles from '../HelpDialog.module.css'

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.section} data-help-section={id}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

function OutputExample({
  filename,
  formula,
  note,
}: {
  filename: string
  formula: React.ReactNode
  note: React.ReactNode
}) {
  return (
    <div className={styles.outputExample}>
      <div className={styles.outputExampleFilename}>{filename}</div>
      <div className={styles.outputExampleFormula}>{formula}</div>
      <div className={styles.outputExampleNote}>{note}</div>
    </div>
  )
}

export function FeatureGuide() {
  return (
    <article className={styles.article}>
      <div className={styles.pageHero}>
        <div className={styles.eyebrow}>機能ガイド</div>
        <h1 className={styles.pageTitle}>操作すると何が出力されるかを確認する</h1>
        <p className={styles.pageLead}>
          各機能について、操作する場所、出力に与える変化、生成されるファイル名を実例で説明します。
          必要な機能の章だけ参照してください。
        </p>
      </div>

      <Section id="screen" title="1. 画面全体">
        <HelpFigure
          src="loaded-overview.png"
          alt="CSP Paperbackのツールバーと3ペイン"
          caption="左は仮想セル、中央はタイムラインと書き出し設定・出力プレビュー、右は素材のレイヤーです。"
          highlights={[
            HELP_HIGHLIGHTS.virtualCels,
            HELP_HIGHLIGHTS.preview,
            HELP_HIGHLIGHTS.layers,
          ]}
        />

        <div className={styles.cardGrid}>
          <div className={styles.infoCard}>
            <h3>上部ツールバー</h3>
            <p>CLIPなどの素材を開く、操作を戻す、設定を開く、画像を書き出す操作を行います。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>左：仮想セル</h3>
            <p>読み込んだレイヤーを選んで組み合わせ、独立した1枚の画像として書き出します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>中央：プレビューと設定</h3>
            <p>CSPのタイムライン表示、書き出し設定、実際に保存される画像とファイル名を確認します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>右：レイヤー</h3>
            <p>出力に含めるレイヤー、単体出力、補助的なアニメーションフォルダ指定を操作します。</p>
          </div>
        </div>

        <div className={styles.callout}>
          デスクトップでは左右ペインの幅と中央上部の高さをドラッグで変更できます。
          左ペインは境界のボタンで折りたためます。
        </div>
      </Section>

      <Section id="files" title="2. CLIPを読み込む・必要に応じてPSDを追加する">
        <p className={styles.paragraph}>
          クリスタで、書き出したい素材が表示される状態にしてCLIPを保存し、そのまま開きます。
          アニメーションフォルダ・セル・タイムラインを直接読み取り、素材を描画します。
          複数のタイムラインがある場合は、中央ペインで切り替えられます。
        </p>
        <p className={styles.paragraph}>
          {ja.input.psdOptional}
          PSDを追加しても、CLIPのタイムラインとセルの対応、マーク・仮想セルの設定は引き継ぎます。
        </p>
        <div className={styles.fileGrid}>
          <div className={styles.fileCard}><strong>CLIP</strong><span>クリスタで保存したファイルを、そのまま開きます。複数のタイムラインは画面で選択できます。</span></div>
          <div className={styles.fileCard}><strong>PSD（任意）</strong><span>同じCLIPから{ja.input.psdMenu}で保存します。{ja.input.psdVisibility}</span></div>
          <div className={styles.fileCard}><strong>設定JSON（任意）</strong><span>保存した出力名・工程フォルダ・自動マークなどの設定を一緒に読み込めます。</span></div>
        </div>
        <div className={styles.callout}>CLIPを画面へドロップするか、「ファイルを開く」から選択してください。対応PSDは同時でも後からでも追加できます。</div>

        <h3>CLIPだけで使う場合の描画範囲</h3>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>素材・効果</th><th>現在の対応</th></tr></thead>
            <tbody>
              <tr>
                <td>通常の描画とレイヤー効果</td>
                <td>ラスターレイヤー、マスク、画像素材の配置、レイヤーカラー、単色の境界線などに対応しています。</td>
              </tr>
              <tr>
                <td>テキスト</td>
                <td>文字も画像として書き出します。フォントや縦書き・ルビなどは、クリスタと見た目が異なる場合があります。</td>
              </tr>
              <tr>
                <td>ベクター・3Dレイヤー、その他の効果</td>
                <td>ベクター・3Dレイヤー、トーン・水彩境界・一部の色調補正などは、CLIPだけでは正しく再現できない場合があります。クリスタの描画結果を使う場合はPSDを追加してください。</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={styles.paragraph}>
          一部の素材を再現できない場合も、対応できる範囲で書き出しを続けます。
          再現に関する補足があるときは、「プレビュー」右側の「再現状況」から一覧を開けます。
        </p>
      </Section>

      <Section id="preview" title="3. タイムラインと出力プレビュー">
        <HelpFigure
          src="loaded-overview.png"
          alt="中央ペインのタイムライン表示と出力プレビュー"
          caption="上の赤枠はCSPのタイムライン表示、下の赤枠は実際に保存される画像です。"
          highlights={[
            HELP_HIGHLIGHTS.navigator,
            HELP_HIGHLIGHTS.output,
          ]}
        />

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>全体（ナビゲーター）</h3>
            <p>
              CSPのタイムラインで、そのフレームに表示されるセルの重なりを確認するプレビューです。
              シークバーを動かすと、フレームごとの表示へ切り替わります。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>出力プレビュー</h3>
            <p>
              右ペインで選択したセル・単体出力、または左ペインの仮想セルが、
              実際に保存される画像とファイル名を表示します。
            </p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>どちらのプレビューも、ホイールで拡大縮小、ドラッグで表示位置を移動できます。</li>
          <li>書き出す前に、出力プレビュー上部のファイル名と画像を確認してください。</li>
        </ul>
        <p className={styles.paragraph}>
          2Dカメラや変形アニメーションは適用せず、元の素材の状態でプレビュー・書き出しします。
        </p>
      </Section>

      <Section id="output-settings" title="4. 書き出し設定">
        <OutputSettingsGuide />
      </Section>

      <Section id="export" title="5. ZIP・フォルダへ書き出す">
        <HelpFigure
          src="output-menu.png"
          alt="出力メニューのZIPとフォルダ"
          caption="赤枠の「出力」を押し、画像の保存方法を選びます。"
          compact
          highlights={[HELP_HIGHLIGHTS.outputMenu]}
        />

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>ZIP</h3>
            <p>すべての生成画像を1つのZIPファイルへまとめて保存します。</p>
          </div>
          <div className={styles.compareCard}>
            <h3>フォルダ</h3>
            <p>
              選択した場所に入力ファイル名のサブフォルダを作り、生成画像を直接保存します。
              同名フォルダがある場合は末尾に番号を付けます。
            </p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>フォルダがメニューに表示されないブラウザではZIPを使用してください。</li>
          <li>入力ファイルにDPI情報がある場合は、出力するJPG／PNGにも引き継ぎます。</li>
          <li>出力中はツールバーに進捗が表示され、完了すると保存先またはファイルが確定します。</li>
        </ul>
      </Section>

      <Section id="layer-tree" title="6. 右ペインのレイヤー操作">
        <HelpFigure
          src="loaded-overview.png"
          alt="右ペインのレイヤーツリー"
          caption="赤枠のレイヤーで、出力に含める素材と別画像にする素材を指定します。"
          compact
          highlights={[HELP_HIGHLIGHTS.layers]}
        />

        <div className={styles.calloutWarning}>
          目がOFFのレイヤーやフォルダは、プレビューにも出力にも含まれません。
          出力したい素材は、親フォルダを含めて目をONにしてください。
        </div>

        <div className={styles.iconList}>
          <div>
            <span>👁</span>
            <p>
              <strong>出力に含める／外す</strong>：
              ONの素材だけを合成します。クリックで1件、縦ドラッグで複数行を切り替えます。
            </p>
          </div>
          <div>
            <span>★</span>
            <p>
              <strong>単体出力</strong>：
              そのレイヤーやフォルダを独立した静止画として出力し、セル画像や他の単体出力には混ぜません。
            </p>
          </div>
          <div>
            <span>🎬</span>
            <p>
              <strong>アニメーションフォルダの補助指定</strong>：
              フォルダ直下の子をセルとして扱い、1枚ずつ出力します。
            </p>
          </div>
          <div>
            <span>›</span>
            <p>
              <strong>展開</strong>：
              Altを押しながらクリックすると、子フォルダもまとめて展開／折りたたみします。
            </p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>選択したレイヤーの合成モードと不透明度は、右ペイン上部で変更できます。</li>
          <li>「初期状態に戻す」で、目・★・🎬などを素材読込時の状態へ戻します。</li>
          <li>Shift＋スクロールで、表示中のセル・単体出力・仮想セルを順番に確認できます。</li>
          <li>Ctrl＋Z／Ctrl＋Shift＋Zで、操作を戻す／やり直すことができます。</li>
        </ul>
      </Section>

      <Section id="single-output" title="7. 静止画素材を単体出力する">
        <p className={styles.paragraph}>
          背景原図、BOOK、撮影指示、PAN・SL指示など、タイムラインへセルとして登録する必要がない
          静止画素材を、アニメーションフォルダへ移さず別画像として書き出す機能です。
        </p>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>素材のレイヤー構成</h3>
            <pre>{`_原図/
  _BG/
  _BOOK1/

_撮影指示/
  _PAN/
  _SL/`}</pre>
          </div>
          <div className={styles.compareCard}>
            <h3>生成される静止画</h3>
            <pre>{`_BG.jpg
_BOOK1.jpg
_PAN.jpg
_SL.jpg`}</pre>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>指定方法</th><th>使う場面</th><th>結果</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>名前を「_」で始める</td>
                <td>CSP側で、毎回同じ素材を単体出力にしておく</td>
                <td><code>_BG</code>が<code>_BG.jpg</code>として出力される</td>
              </tr>
              <tr>
                <td>設定へフォルダ名を登録</td>
                <td>名前を変えず、同名フォルダを毎回自動指定する</td>
                <td>「撮影指示」「原図」など登録名と完全一致したフォルダが単体出力になる</td>
              </tr>
              <tr>
                <td>右ペインで★を付ける</td>
                <td>読み込んだカットだけ追加で別画像にする</td>
                <td>★を付けたレイヤーまたはフォルダが、その名前の静止画として出力される</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={styles.outputExampleGrid}>
          <OutputExample
            filename="A1.jpg"
            formula={<>memo ＋ Frame ＋ 作画/A/1</>}
            note={<>単体出力の<code>_BG</code>や<code>_PAN</code>は混ざりません。</>}
          />
          <OutputExample
            filename="_BG.jpg"
            formula={<>memo ＋ Frame ＋ _原図/_BG</>}
            note={<>通常の共通レイヤーは重なり、別の単体出力素材は混ざりません。</>}
          />
        </div>

        <div className={styles.callout}>
          <code>_原図</code>や<code>_撮影指示</code>の直下が単体出力だけの場合、
          親は整理用フォルダとして扱い、親自身の重複画像は作りません。
        </div>
      </Section>

      <Section id="animation-folders" title="8. アニメーションフォルダを指定する">
        <p className={styles.paragraph}>
          CLIPに保存されたアニメーションフォルダを直接認識し、
          直下のセルを1枚ずつ出力します。通常フォルダをセル群として扱いたい場合は、右ペインの🎬で追加指定します。
        </p>

        <div className={styles.priorityFlow}>
          <span>CLIPから直接認識</span>
          <b>→</b>
          <span>必要なフォルダだけ🎬で追加</span>
          <b>→</b>
          <span>直下の子を1枚ずつ出力</span>
        </div>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>CLIPから認識される例</h3>
            <pre>{`CLIPのアニメーションフォルダ
A/
  1/  → A1.jpg
  2/  → A2.jpg`}</pre>
            <p>アニメーションフォルダAのタイムラインと、直下のセル1・2を対応付けます。</p>
          </div>
          <div className={styles.compareCard}>
            <h3>🎬で追加する例</h3>
            <pre>{`エフェクト/
  1/  → エフェクト1.jpg
  2/  → エフェクト2.jpg`}</pre>
            <p>エフェクトフォルダへ🎬を付けると、直下の1・2をセルとして出力します。</p>
          </div>
        </div>

        <div className={styles.calloutWarning}>
          タイムライン未使用セルは通常、初期OFFになります。「兼用カット」をONにすると未使用セルも表示状態に従って出力できます。目アイコンで個別に調整できます。
        </div>
      </Section>

      <Section id="process" title="9. 演出・作監などの修正工程を分けて出力する">
        <p className={styles.paragraph}>
          「設定」の工程フォルダリストへ、工程のフォルダ名と出力ファイルへ付けるサフィックスを登録します。
          演出や作監修正を、本体と同じセル番号の別画像として出力できます。
        </p>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>トラック分離型</h3>
            <pre>{`LO/
  演出/
    A/
      1/ → A1_e.jpg
  作画/
    A/
      1/ → A1.jpg`}</pre>
            <p>
              アニメーションフォルダAの親「演出」が登録名に一致すると、
              その中のセルへ<code>_e</code>が付きます。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>セル内蔵型</h3>
            <pre>{`B/
  1/
    線画・影 → B1.jpg
    _s/
      作監修正 → B1_s.jpg`}</pre>
            <p>
              セル内の<code>_s</code>だけを本体から分離し、同じセル番号の
              <code>B1_s.jpg</code>として出力します。
            </p>
          </div>
        </div>

        <div className={styles.outputExampleGrid}>
          <OutputExample
            filename="B1.jpg"
            formula={<>memo ＋ Frame ＋ 線画 ＋ 影</>}
            note={<>作監修正フォルダ<code>_s</code>の内容は本体へ混ざりません。</>}
          />
          <OutputExample
            filename="B1_s.jpg"
            formula={<>memo ＋ Frame ＋ B/1/_s</>}
            note={<>作監修正だけを、同じセル番号の別画像として出力します。</>}
          />
        </div>

        <ul className={styles.list}>
          <li>サフィックスは入力した文字をそのまま使います。<code>_e</code>、<code>e</code>、<code>-e</code>は別の指定です。</li>
          <li>修正工程のフチは分離した工程画像だけに付き、本体画像には付きません。</li>
          <li>中央の工程チップをOFFにすると、その工程画像だけを書き出し対象から外せます。</li>
        </ul>
      </Section>

      <Section id="virtual-cels" title="10. 仮想セル">
        <HelpFigure
          src="loaded-overview.png"
          alt="左ペインの仮想セル"
          caption="赤枠の仮想セルへ、右ペインから出力に使うレイヤーを追加します。"
          compact
          highlights={[
            { label: '仮想セル', x: 0.6, y: 20.8, width: 19, height: 32.5 },
          ]}
        />

        <p className={styles.paragraph}>
          読み込んだ複数のレイヤーを選び、1枚の合成画像として出力する機能です。
          元の作画データを複製せず、セル・BG・BOOKなどの組み合わせを追加できます。
        </p>

        <ol className={styles.numberedList}>
          <li>左ペインの「＋追加」で仮想セルを作成し、出力ファイル名になる名前を付けます。</li>
          <li>右ペインから、画像に含めたいレイヤーを仮想セルへドラッグして追加します。</li>
          <li>追加したレイヤーの順番、目、合成モード、不透明度を仮想セル内で調整します。</li>
          <li>仮想セルの⠿を右ペインへドラッグし、素材のレイヤー順のどこへ挿入するか指定します。</li>
          <li>出力プレビューを確認し、通常の出力ボタンから保存します。</li>
        </ol>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>サンプルの仮想セルに追加するレイヤー</h3>
            <pre>{`LO/作画/B
LO/作画/A
_原図`}</pre>
          </div>
          <div className={styles.compareCard}>
            <h3>挿入位置と出力</h3>
            <pre>{`_撮影指示 の上へ挿入

仮想セルテスト.jpg`}</pre>
          </div>
        </div>

        <div className={styles.callout}>
          挿入位置を指定すると、その位置より前面・背面にある通常レイヤーとの重なりも含めて
          出力プレビューを作ります。レイヤーが1件もない、または挿入位置がない仮想セルは出力されません。
        </div>
      </Section>

      <Section id="detailed-settings" title="11. 詳細設定と設定JSON">
        <HelpFigure
          src="settings-dialog.png"
          alt="書き出し詳細設定ダイアログ"
          caption="赤枠の詳細設定で、工程名、自動マーク、除外リスト、設定の保存・読み込みを行います。"
          highlights={[HELP_HIGHLIGHTS.settingsDialog]}
        />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>項目</th><th>何を設定するか</th><th>いつ反映されるか</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>カラーテーマ</td>
                <td>ミッドナイト、グラファイト、ペーパーから画面の配色を選ぶ</td>
                <td>選択するとすぐ画面へ反映</td>
              </tr>
              <tr>
                <td>工程フォルダリスト</td>
                <td>演出・作監などのフォルダ名、サフィックス、確認フチの色を登録</td>
                <td>現在の出力名・プレビュー・書き出しへ反映</td>
              </tr>
              <tr>
                <td>単体出力の自動マーク</td>
                <td>「_」以外にも自動で単体出力にするフォルダ名を完全一致で登録</td>
                <td>次に素材を読み込んだときに反映</td>
              </tr>
              <tr>
                <td>自動マークの除外</td>
                <td>「_old」など、先頭が「_」でも単体出力にしない名前を前方一致で登録</td>
                <td>次に素材を読み込んだときに反映</td>
              </tr>
              <tr>
                <td>設定を書き出す／読み込む</td>
                <td>出力名、連番、工程フォルダ、自動マーク、除外リストをJSONとして保存・復元</td>
                <td>別端末や別環境で同じ設定を使いたいときに読み込む</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="desktop-mobile" title="12. デスクトップ版とタッチ端末">
        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>デスクトップ版のクイック書き出し</h3>
            <ol>
              <li>通常起動で書き出し設定を決めます。</li>
              <li>
                CLIPをEXEまたはショートカットへドロップします。対応PSDを一緒に追加することもできます。
              </li>
              <li>CLIPと同じ場所へ、CLIP名を元にしたフォルダを作って自動出力します。</li>
            </ol>
            <p>
              保存時の選択タイムラインと、保存済み書き出し設定を使います。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>タッチ端末</h3>
            <ul>
              <li>下部タブで仮想セル／プレビュー／レイヤーを切り替えます。</li>
              <li>Aaボタンで表示サイズを調整します。</li>
              <li>書き出し設定は開閉式の領域に表示されます。</li>
              <li>仮想セルの挿入位置は、右ペインでレイヤーを選んで上／下ボタンでも指定できます。</li>
            </ul>
          </div>
        </div>

        <div className={styles.callout}>
          クイック書き出しでは、読み込み後に★や🎬を追加する画面は表示されません。
          カットごとに指定を変えたい場合は、通常起動で素材を読み込んでから書き出してください。
        </div>
      </Section>
    </article>
  )
}
