import { HelpFigure } from './HelpFigure'
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

export function FeatureGuide() {
  return (
    <article className={styles.article}>
      <div className={styles.pageHero}>
        <div className={styles.eyebrow}>機能ガイド</div>
        <h1 className={styles.pageTitle}>画面と機能をひと通り把握する</h1>
        <p className={styles.pageLead}>
          通常のセル書き出しから、単体出力・修正工程・仮想セルまでを、実際の画面に沿って説明します。
          最初から全部設定する必要はありません。必要になった章だけ参照してください。
        </p>
      </div>

      <Section id="screen" title="1. 画面全体">
        <HelpFigure
          src="loaded-overview.png"
          alt="CSP Paperbackのツールバーと3ペイン"
          caption="左が仮想セル、中央がプレビューと書き出し設定、右がPSDのレイヤーツリーです。"
          highlights={[
            { label: '仮想セル', x: 0.6, y: 20.8, width: 19, height: 32.5 },
            { label: 'プレビュー', x: 20.5, y: 6.7, width: 56, height: 92.5 },
            { label: 'レイヤー', x: 76.6, y: 6.7, width: 23.1, height: 92.5 },
          ]}
        />

        <div className={styles.cardGrid}>
          <div className={styles.infoCard}>
            <h3>上部ツールバー</h3>
            <p>ファイルを開く、元に戻す／やり直し、ヘルプ、更新確認、詳細設定、出力をまとめています。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>左：仮想セル</h3>
            <p>PSD内の任意レイヤーを組み合わせ、1枚の独立した出力として管理します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>中央：プレビュー</h3>
            <p>PSD全体、タイムライン、出力設定、実際に保存される画像を確認します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>右：レイヤー</h3>
            <p>表示状態、単体出力、アニメーションフォルダ、合成モード、不透明度を操作します。</p>
          </div>
        </div>

        <div className={styles.callout}>
          デスクトップでは左右ペインの幅と中央ナビゲーターの高さをドラッグで変更できます。
          左ペインは境界のボタンで折りたためます。
        </div>
      </Section>

      <Section id="files" title="2. ファイルを読み込む">
        <div className={styles.fileGrid}>
          <div className={styles.fileCard}>
            <strong>PSD</strong>
            <span>必須。CLIPファイルを「複製を保存」でPSDへ書き出したものです。</span>
          </div>
          <div className={styles.fileCard}>
            <strong>XDTS</strong>
            <span>推奨。タイムラインのトラック・セル・尺を読み取り、アニメーションフォルダを自動検出します。</span>
          </div>
          <div className={styles.fileCard}>
            <strong>JSON</strong>
            <span>任意。詳細設定から書き出した工程名、出力名、自動マークなどの共有設定です。</span>
          </div>
        </div>

        <ul className={styles.list}>
          <li>画面へドラッグするか、「ファイルを開く」から複数ファイルを同時選択できます。</li>
          <li>PSDとXDTSをセットで読み込むと、XDTSトラックとPSDフォルダの対応が読込時に確定します。</li>
          <li>別のPSDまたはXDTSを開くと、新しいプロジェクトとして読み直します。</li>
          <li>XDTSトラックに対応するフォルダが見つからない場合は、書き出し設定の上に警告が表示されます。</li>
        </ul>

        <div className={styles.calloutWarning}>
          XDTSを書き出すときはCSVではなくXDTS形式を選びます。PSDと異なるカットのXDTSを組み合わせると、
          トラック名やセル名が一致せず、期待した出力になりません。
        </div>
      </Section>

      <Section id="preview" title="3. ナビゲーターと出力プレビュー">
        <HelpFigure
          src="loaded-overview.png"
          alt="中央ペインのナビゲーターと出力プレビュー"
          caption="上はPSD全体の確認、下は選択中の出力画像です。同じ拡大・移動操作で細部を確認できます。"
          highlights={[
            { label: '全体（ナビゲーター）', x: 20.5, y: 6.7, width: 56, height: 42.4 },
            { label: '出力プレビュー', x: 20.5, y: 73.7, width: 56, height: 25.8 },
          ]}
        />

        <ul className={styles.list}>
          <li><strong>全体（ナビゲーター）</strong>はPSDの現在の表示状態を確認する場所です。</li>
          <li>XDTS読込時はシークバーを動かし、タイムライン上の表示セルを確認できます。</li>
          <li><strong>出力プレビュー</strong>は、右ペインで選んだセル・単体素材、または左の仮想セルの完成画像を表示します。</li>
          <li>出力プレビュー上部には、現在の設定で保存されるファイル名が表示されます。</li>
          <li>ホイールで拡大縮小し、ドラッグで表示位置を移動できます。</li>
        </ul>

        <div className={styles.callout}>
          ナビゲーターは確認用の全体像、出力プレビューは保存結果です。
          書き出し前は出力プレビューの画像とファイル名を確認してください。
        </div>
      </Section>

      <Section id="output-settings" title="4. 書き出し設定">
        <HelpFigure
          src="loaded-overview.png"
          alt="中央ペインの書き出し設定"
          caption="頻繁に使う設定は中央ペインへ集約されています。変更すると出力例とプレビューへすぐ反映されます。"
          highlights={[
            { label: '書き出し設定', x: 20.5, y: 49, width: 56, height: 24.8 },
          ]}
        />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>設定</th><th>内容</th></tr>
            </thead>
            <tbody>
              <tr><td>フォーマット</td><td>JPG、または透明背景に対応するPNG。</td></tr>
              <tr><td>背景</td><td>白ベタ／透明。透明はPNG選択時だけ使えます。</td></tr>
              <tr><td>出力名</td><td>連番、連番＋セル名、CSPのセル名、XDTSに沿ったシート連番。</td></tr>
              <tr><td>連番桁数</td><td>最大番号に合わせる自動、または0001形式の4桁固定。</td></tr>
              <tr><td>フォルダ名との区切り</td><td><code>A_1</code>の「_ あり」、または<code>A1</code>の「なし」。</td></tr>
              <tr><td>XDTSフォルダ名</td><td>セル名モードで、セル名が「1」なら付ける、「A1」なら付けないのが目安です。</td></tr>
              <tr><td>兼用カット</td><td>ONで、同じPSDを使う別カット用の未使用セルも一緒に出力します。</td></tr>
              <tr><td>フォルダ分け</td><td>ONで<code>A/A1.png</code>、OFFですべてを出力先直下へまとめます。</td></tr>
              <tr><td>工程名の位置</td><td><code>A1_e</code>の後ろ、または<code>A_e1</code>の前。</td></tr>
              <tr><td>修正工程フチ</td><td>演出・作監などの分離画像へ、工程色の確認フチを付けるか選びます。</td></tr>
              <tr><td>出力する修正工程</td><td>工程サフィックスと自動マーク素材を個別または一括でON／OFFします。</td></tr>
            </tbody>
          </table>
        </div>

        <div className={styles.callout}>
          起動直後の設定は「保存済み設定」を変更します。PSD読込後は現在のプロジェクトへ反映され、
          次回起動とデスクトップ版の自動書き出しにも引き継がれます。
        </div>
      </Section>

      <Section id="export" title="5. ZIP・フォルダへ書き出す">
        <HelpFigure
          src="output-menu.png"
          alt="出力メニューのZIPとフォルダ"
          caption="出力先を選ぶと、現在の書き出し設定ですべての対象画像を生成します。"
          compact
          highlights={[
            { label: '出力メニュー', x: 89.5, y: 1, width: 9.5, height: 17.5 },
          ]}
        />

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>ZIP</h3>
            <p>画像を1つのZIPへまとめます。対応ブラウザとデスクトップ版では保存場所を選べます。</p>
          </div>
          <div className={styles.compareCard}>
            <h3>フォルダ</h3>
            <p>選択した場所にPSD名のサブフォルダを作り、画像を書き込みます。同名時は番号を付けます。</p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>出力中はツールバーに進捗が表示されます。</li>
          <li>PSDにDPI情報がある場合は、JPG／PNGへ引き継ぎます。</li>
          <li>フォルダ出力に未対応のブラウザではZIPのみ利用できます。</li>
          <li>ブラウザのフォルダ権限は、ローカルへ生成画像を書き込むためのものです。</li>
        </ul>
      </Section>

      <Section id="layer-tree" title="6. 右ペインのレイヤー操作">
        <HelpFigure
          src="loaded-overview.png"
          alt="右ペインのレイヤーツリー"
          caption="目、フォルダ展開、★、🎬をレイヤーごとに操作できます。選択した対象は中央の出力プレビューへ連動します。"
          compact
          highlights={[
            { label: 'レイヤー', x: 76.6, y: 6.7, width: 23.1, height: 92.5 },
          ]}
        />

        <div className={styles.iconList}>
          <div><span>👁</span><p><strong>表示切替</strong>：クリック、または縦にドラッグして複数行を切り替えます。PSDファイル自体は変更しません。</p></div>
          <div><span>★</span><p><strong>単体出力</strong>：セルとは別の1枚として出力します。</p></div>
          <div><span>🎬</span><p><strong>手動アニメーションフォルダ</strong>：直下の子をセルとして1枚ずつ出力します。</p></div>
          <div><span>›</span><p><strong>展開</strong>：Altを押しながらクリックすると、子フォルダもまとめて展開／折りたたみします。</p></div>
        </div>

        <ul className={styles.list}>
          <li>選択レイヤーの合成モードと不透明度は、右ペイン上部で変更できます。</li>
          <li>「初期状態に戻す」で、アプリ上の表示変更をPSD読込時の状態へ戻せます。</li>
          <li>Shift＋スクロールで表示中のレイヤー・セル・仮想セルを順番にプレビューできます。</li>
          <li>Ctrl＋Z／Ctrl＋Shift＋Zで操作を戻す／やり直すことができます。</li>
        </ul>
      </Section>

      <Section id="single-output" title="7. 背景原図・撮影指示などを単体出力する">
        <p className={styles.paragraph}>
          単体出力は、アニメーションセルへ混ぜず、背景原図・BOOK・撮影指示などを別ファイルにする機能です。
          指定方法は3つあります。
        </p>

        <ol className={styles.numberedList}>
          <li><strong>フォルダ名を「_」で始める</strong>：CSP側であらかじめ出力対象を決める運用です。</li>
          <li><strong>設定へ名前を登録する</strong>：初期状態では「撮影指示」「原図」が完全一致で登録されています。</li>
          <li><strong>読込後に★を付ける</strong>：PSD上の名前を変えず、カットごとに追加指定できます。</li>
        </ol>

        <div className={styles.ruleDiagram}>
          <div><code>_原図/</code><span>整理用コンテナ</span></div>
          <div className={styles.ruleChild}><code>_BG/</code><span>→ _BG.png</span></div>
          <div className={styles.ruleChild}><code>_BOOK1/</code><span>→ _BOOK1.png</span></div>
        </div>

        <ul className={styles.list}>
          <li>表示中の単体出力素材は、他のセル画像へ混ざらず別画像になります。</li>
          <li>直下が単体出力素材だけの親フォルダは整理用と判断され、親自身は重複出力しません。</li>
          <li>除外リストに一致する名前は、先頭が「_」でも自動マークしません。</li>
          <li>工程やアニメーションフォルダとして判定された対象は、単体出力より優先されます。</li>
        </ul>
      </Section>

      <Section id="animation-folders" title="8. アニメーションフォルダの検出と補助指定">
        <div className={styles.priorityFlow}>
          <span>XDTS検出</span><b>→</b><span>手動🎬</span><b>→</b><span>工程名による自動化</span><b>→</b><span>単体出力</span>
        </div>

        <div className={styles.cardGrid}>
          <div className={styles.infoCard}>
            <h3>XDTS検出</h3>
            <p>XDTSトラック名・セル名・PSD内の候補を照合し、読込時に対応フォルダを決定します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>手動🎬</h3>
            <p>XDTSにないフォルダを補助的に指定し、直下の子をセルとして出力します。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>工程名による自動化</h3>
            <p>「_」フォルダ直下に工程フォルダがある場合、親を自動的にアニメーションフォルダとして扱います。</p>
          </div>
        </div>

        <div className={styles.calloutWarning}>
          CSP側で非表示のアニメーションフォルダはXDTSへ出ない場合があります。
          必要なフォルダを表示してPSD／XDTSを再書き出すか、読込後に🎬で補助指定してください。
        </div>
      </Section>

      <Section id="process" title="9. 工程フォルダと修正工程フチ">
        <p className={styles.paragraph}>
          工程フォルダリストへ「フォルダ名・サフィックス・フチ色」を登録すると、
          演出・作監などを本体と分けて自動出力します。2種類のPSD構造に対応します。
        </p>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>トラック分離型</h3>
            <pre>{`LO/
  演出/
    A/1  → A1_e.png
  作画/
    A/1  → A1.png`}</pre>
            <p>アニメーションフォルダの直接の親名が工程名に一致します。</p>
          </div>
          <div className={styles.compareCard}>
            <h3>セル内蔵型</h3>
            <pre>{`B/
  1/
    線画
    _s/作監修正
      → B1_s.png`}</pre>
            <p>セル内のサブフォルダ名が工程名に一致します。</p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>サフィックスは入力した文字をそのまま使います。<code>_e</code>、<code>e</code>、<code>-e</code>は別の指定です。</li>
          <li>修正工程フチは分離された工程画像だけに付き、本体画像には付きません。</li>
          <li>初期設定は内側70px、乗算、不透明度80%です。工程ごとに色を変更できます。</li>
          <li>中央の工程チップで、カットごとに出力する修正工程を絞れます。</li>
        </ul>
      </Section>

      <Section id="virtual-cels" title="10. 仮想セル">
        <HelpFigure
          src="loaded-overview.png"
          alt="左ペインの仮想セル"
          caption="メンバー、挿入位置、仮想セル内だけの表示・合成設定を左ペインで管理します。"
          compact
          highlights={[
            { label: '仮想セル', x: 0.6, y: 20.8, width: 19, height: 32.5 },
          ]}
        />

        <ol className={styles.numberedList}>
          <li>左ペインの「＋追加」で仮想セルを作成し、名前を付けます。</li>
          <li>右ペインから含めたいレイヤーを左のドロップ領域へ追加します。</li>
          <li>仮想セルの⠿を右ペインへドラッグし、レイヤーツリー上の挿入位置を決めます。</li>
          <li>中央の出力プレビューを確認し、通常の出力ボタンから書き出します。</li>
        </ol>

        <ul className={styles.list}>
          <li>同じPSDレイヤーをコピーせず、キャラ＋BG＋BOOKなどの組み合わせを作れます。</li>
          <li>メンバーの順番、表示状態、合成モード、不透明度を仮想セル内だけで上書きできます。</li>
          <li>挿入位置が未設定の仮想セルは出力されません。</li>
          <li>タッチ端末では、右ペインでレイヤーを選び、左ペインの「上／下」ボタンでも挿入位置を設定できます。</li>
        </ul>
      </Section>

      <Section id="detailed-settings" title="11. 詳細設定・保存・共有">
        <HelpFigure
          src="settings-dialog.png"
          alt="書き出し詳細設定ダイアログ"
          caption="テーマ、工程フォルダ、自動マーク、除外リスト、設定共有を1か所で管理します。"
          highlights={[
            { label: '詳細設定', x: 19.5, y: 7.5, width: 61.1, height: 85 },
          ]}
        />

        <div className={styles.cardGrid}>
          <div className={styles.infoCard}><h3>カラーテーマ</h3><p>ミッドナイト、グラファイト、ペーパーを端末ごとに保存します。</p></div>
          <div className={styles.infoCard}><h3>工程フォルダリスト</h3><p>工程サフィックス、複数のフォルダ名、修正工程フチ色を編集します。</p></div>
          <div className={styles.infoCard}><h3>単体出力の自動マーク</h3><p>「_」以外に自動検出したいフォルダ名を完全一致で登録します。</p></div>
          <div className={styles.infoCard}><h3>自動マークの除外</h3><p>アーカイブや素材置き場など、自動マークさせない名前を前方一致で登録します。</p></div>
        </div>

        <p className={styles.paragraph}>
          「設定を書き出す／読み込む」で、出力名、連番、工程表、フチ色、自動マーク、除外リストをJSONとして共有できます。
          自動マーク名を変更した場合は、PSDとXDTSを読み直すと反映されます。
        </p>
      </Section>

      <Section id="desktop-mobile" title="12. デスクトップ版とモバイル">
        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>デスクトップ版</h3>
            <ul>
              <li>PSD＋XDTSをEXEへ同時にドロップする自動書き出し</li>
              <li>ネイティブのファイル／フォルダ選択</li>
              <li>手動の更新確認</li>
            </ul>
          </div>
          <div className={styles.compareCard}>
            <h3>タッチ端末</h3>
            <ul>
              <li>下部タブで仮想セル／プレビュー／レイヤーを切替</li>
              <li>Aaボタンで表示サイズを調整</li>
              <li>書き出し設定は開閉式ドロワー</li>
            </ul>
          </div>
        </div>

        <div className={styles.callout}>
          更新確認はデスクトップ版でボタンを押した時だけGitHub Releasesの情報を取得します。
          アプリ内で自動更新やバイナリのダウンロードは行いません。
        </div>
      </Section>

      <Section id="troubleshooting" title="13. 困ったとき">
        <div className={styles.faqList}>
          <details>
            <summary>アニメーションフォルダが検出されない</summary>
            <p>PSDとXDTSが同じカットか、トラック名とフォルダ名が対応しているか、CSP側で親フォルダまで表示されているか確認してください。必要なら🎬で補助指定できます。</p>
          </details>
          <details>
            <summary>出力対象がない／画像が足りない</summary>
            <p>右ペインの表示状態、中央の工程チップ、兼用カット設定を確認します。仮想セルは挿入位置が必要です。</p>
          </details>
          <details>
            <summary>余計な素材がセル画像へ重なる</summary>
            <p>別ファイルにしたい素材へ★を付けるか、フォルダ名を「_」で始めます。作業用フォルダは非表示または自動マーク除外へ登録します。</p>
          </details>
          <details>
            <summary>ファイル名がAA1のように重複する</summary>
            <p>セル名モードでセル名がA1のようにフォルダ名を含む場合、「XDTSフォルダ名」を「付けない」にします。</p>
          </details>
          <details>
            <summary>フォルダ書き出しが表示されない</summary>
            <p>ブラウザがFile System Access APIへ対応していない場合はZIPを使用してください。デスクトップ版では常にフォルダ出力を利用できます。</p>
          </details>
          <details>
            <summary>画面上の変更はPSDへ保存される？</summary>
            <p>保存されません。表示、★、🎬、仮想セル、合成設定はCSP Paperback内の出力状態であり、元のPSDを上書きしません。</p>
          </details>
        </div>
      </Section>
    </article>
  )
}
