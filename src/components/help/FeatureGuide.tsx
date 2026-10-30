import { HelpFigure } from './HelpFigure'
import { HELP_HIGHLIGHTS } from './helpHighlights'
import { ja } from '../../i18n/ja'
import { ClipCompatibilityInstructions } from './ClipCompatibilityInstructions'
import { OutputSettingsGuide } from './OutputSettingsGuide'
import { LayerExpandIcon, LayerVisibilityIcon } from '../LayerTreeRow'
import { LayerIcon } from '../LayerIcon'
import { HelpLayerTree } from './HelpLayerTree'
import { HelpAnimationFolderExample } from './HelpAnimationFolderExample'
import { individualLayers, clipAnimationLayers, trackProcessLayers, celProcessLayers } from './layerExamples'
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
          alt="仮想セルを開いたCSP Paperbackのツールバーとプレビュー・レイヤー"
          caption="中央にプレビュー、右に出力一覧と素材ツリーを表示します。左の仮想セルは必要なときだけ開きます。"
          highlights={[
            HELP_HIGHLIGHTS.virtualCels,
            HELP_HIGHLIGHTS.preview,
            HELP_HIGHLIGHTS.layers,
          ]}
        />

        <div className={styles.cardGrid}>
          <div className={styles.infoCard}>
            <h3>上部ツールバー</h3>
            <p>素材を開く、操作を戻す、仮想セルを開く、ヘルプ・設定・出力を使う操作を1行にまとめています。アプリ名やバージョンは左端のメニューから確認できます。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>左：仮想セル</h3>
            <p>初期状態では閉じています。上部の「仮想セル」で開くと、読み込んだレイヤーを組み合わせるツリーが左に表示されます。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>中央：大きなプレビュー</h3>
            <p>読み込み直後は出力一覧の画像をタイル表示します。ホイール・ピンチで指した場所をズームし、左ドラッグ・１本指で移動できます。ズーム中は配置を変えません。タイルをダブルクリックすると１点表示になり、もう一度ダブルクリックすると元の位置へ戻ります。タッチではダブルタップで切り替わります。中央上端の「キャンバス／書き出し画像」で確認する状態を切り替えます。「書き出し画像」では右隣のアイコンでタイル表示・１点表示を選べます。未選択で１点表示に切り替えると、一覧の先頭を表示します。倍率は元画像のピクセルが基準で、「100%」は画像の1ピクセルを画面の1ピクセルで表示します。「画面に収める」で見渡し、「整列」で現在の表示幅に合わせて配置を作り直せます。書き出し設定はアプリ上部のボタンから開きます。</p>
          </div>
          <div className={styles.infoCard}>
            <h3>右：出力一覧と素材ツリー</h3>
            <p>素材ツリーでレイヤーの表示、個別書き出し、補助的なアニメーションフォルダ指定を操作します。</p>
            <p>アニメーションフォルダや個別出力する素材の名前をダブルクリック、または選択してF2を押すと、出力用の別名を指定できます。素材ツリーの≡メニューからも操作できます。入力中に現在の設定での出力名と文字・同名の調整を確認し、Enterで確定、Escで取り消します。別名は点線の下線で示し、ツールチップには元の名前を表示します。「元の名前を使う」で解除でき、確定・解除ともUndoで戻せます。元のCLIP・PSDは変更しません。</p>
            <p>別名は、自動で検出されたアニメーションフォルダと、_・辞書・手動指定による出力にも使えます。非表示や出力OFF、指定の解除中も保持され、再指定すると復帰します。セル番号・工程名・トラック名を省く設定はそのまま適用されます。別名は現在の文書だけで使い、新しい文書の読み込みやリセットで消えます。</p>
            <p>右ペインに、サムネイル付きの出力一覧と素材レイヤーを並べて表示します。PCでは幅を狭めても横並びを保ち、接続線で画像の構成を確認できます。モバイルのレイヤータブでは上下に並びます。階層保持では保存先の相対パスを表示し、上部の検索ボタンからファイル名で絞り込めます。検索は中央のタイルにも反映され、×で解除できます。</p>
            <p>出力一覧の行を選ぶと中央の画像を選択し、合成に使う素材へ線が伸びます。実線はその出力の素材、点線は一緒に合成する用紙・指示などです。画面外の合成元にはツリーの上端・下端で件数と名前を示し、押すと名前の一覧からその場所へ移動できます。閉じたフォルダも合成元として強調され、↗で出力元まで展開できます。</p>
            <p>一覧・タイルともCtrl（MacはCommand）で選択を追加・解除、Shiftで連続した範囲を選択、Ctrl＋Shiftで範囲を追加できます。タイルではShift＋ドラッグで矩形範囲を追加、Ctrl＋ドラッグで反転、Ctrl＋Shift＋ドラッグで解除します。通常のドラッグは移動です。タッチでは「範囲選択」をONにし、タップで追加・解除、ドラッグで範囲追加できます。２本指の移動・ズームも使えます。空白クリックやEsc、≡メニューの「選択を解除」で未選択に戻せます。範囲をドラッグしている途中のEscは、その範囲操作を取り消します。</p>
            <p>出力一覧の左端と、タイルのファイル名の右側にある出力除外アイコンで、画像を出力OFFにできます。通常はグレーの用紙アイコン、除外中は斜線付きの赤い用紙アイコンで表示されます。選択中の画像のアイコンを押すと、選択した出力をまとめて切り替えます。選択していない画像のアイコンは、その画像だけを切り替えます。アイコンを押したままなぞると、通過した画像を最初に押したアイコンと同じ状態にそろえます。除外中のアイコンから始めれば出力に戻せます。なぞり操作も1回のUndoで戻せます。</p>
            <p>右クリック、または各ペイン右上の≡メニューからも「選択を出力から外す」「選択を出力に戻す」「すべて出力に戻す」を実行できます。画像はそのまま確認でき、レイヤーの表示状態や書き出し設定は変えません。ファイル名・工程サフィックス・見た目が変わってもOFFを保ち、一度非表示にして戻した場合も維持します。新しい文書を開くとリセットされます。</p>
            <p>出力一覧上部の≡メニューから選択項目だけを書き出せます。出力OFFは全件・選択のどちらの書き出しにも含めません。検索で隠れた選択も件数に含まれます。タイル表示は選択数によらず一覧全体を対象とし、枚数に応じて縮小画像を使います。タイル・１点表示とも、拡大すると見えている部分を原寸で読み込み、100%以上では元画像のドットを確認できます。大きい画像も必要な部分から表示します。未配置の仮想セルには「未配置」と表示し、通常のJPEG／PNG出力には含めません。仮想セルのメニューからのPSD保存は利用できます。</p>
            <p>素材ツリーのクリックは合成モード・不透明度の編集対象を選びます。中央の出力やタイムラインは切り替わりません。Space、または目のボタンで素材単体を確認し、Escapeで戻れます。素材レイヤー上部の≡メニューから、表示状態を読み込み時へ戻せます。クイックルックは選んだ素材の表示状態を一時的に無視しますが、子の表示状態は保ち、出力設定や履歴を変更しません。</p>
          </div>
        </div>

        <div className={styles.callout}>
          デスクトップでは左右ペインの幅を境界のドラッグで変更できます。
          中央の表示を切り替えても、右の出力一覧と素材ツリーの位置は変わりません。
          仮想セルを閉じると、その分だけ中央のプレビューを広く使えます。
        </div>
      </Section>

      <Section id="files" title="2. CLIPを読み込む・必要に応じてPSDを追加する">
        <p className={styles.paragraph}>
          クリスタでCLIPを保存し、そのまま開きます。
          アニメーションフォルダ・セル・タイムラインを直接読み取り、素材を描画します。
          複数のタイムラインがある場合は、中央の「キャンバス」表示内にある選択欄で切り替えられます。
        </p>
        <p className={styles.paragraph}>
          {ja.input.psdOptional}
          PSDを追加しても、CLIPのタイムラインとセルの対応、マーク・仮想セルの設定は引き継ぎます。
        </p>
        <div className={styles.fileGrid}>
          <div className={styles.fileCard}><strong>CLIP</strong><span>クリスタで保存したファイルを、そのまま開きます。複数のタイムラインは画面で選択できます。</span></div>
          <div className={styles.fileCard}><strong>PSD（任意）</strong><span>同じCLIPから{ja.input.psdMenu}で保存します。{ja.input.psdVisibility}</span></div>
          <div className={styles.fileCard}><strong>設定JSON（任意）</strong><span>保存した出力名・工程フォルダ・個別書き出しなどの設定を一緒に読み込めます。</span></div>
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
                <td>保存された文字の描画画像を優先します。画像を取得できない場合は文字情報から近似描画し、「再現状況」で案内します。</td>
              </tr>
              <tr>
                <td>3Dレイヤー</td>
                <td>CLIP内の保存画像を使います。画像を取得できない場合は透明な画像として扱い、書き出しを続けます。</td>
              </tr>
              <tr>
                <td>ベクター</td>
                <td>保存された描画画像を優先します。画像がない場合は独自処理で近似描画し、「再現状況」で案内します。</td>
              </tr>
              <tr>
                <td>水彩境界</td>
                <td>「通常」を近似描画します。縁の濃さやぼかしに差があるため、「再現状況」で案内します。「ビビッド」など未対応の種類は、効果を除いた元の描画を書き出します。</td>
              </tr>
              <tr>
                <td>トーン、その他の効果</td>
                <td>トーンは未対応です。使用している場合は「再現状況」で案内し、トーン化前の描画を書き出します。一部の色調補正にも未対応の設定があります。PSDの通常レイヤーに含まれる描画は利用できますが、フォルダ効果はPSDにも含まれない場合があります。</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={styles.callout}><ClipCompatibilityInstructions /></div>
        <p className={styles.paragraph}>
          一部の素材を再現できない場合も、対応できる範囲で書き出しを続けます。
          再現に関する補足があるときは、上部バーの「再現状況」から一覧を開けます。
          警告は種類ごとにまとまり、開くと対象レイヤーを確認できます。互換情報の保存方法は一覧上部の「クリスタでの保存手順」にまとめています。
          音声・ビデオレイヤーは静止画出力の対象外です。ツリーには音符・フィルムのアイコンで表示し、表示欄は操作できない「—」になります。再現状況の警告には含めません。
          狭い画面では、中央のプレビュー上部に表示します。
        </p>
      </Section>

      <Section id="preview" title="3. タイムラインと書き出し画像">
        <HelpFigure
          src="whole-preview.png"
          alt="中央のキャンバスとタイムライン"
          caption="キャンバス表示で現在のフレームを確認します。出力一覧から項目を選ぶと、実際に保存される画像へ切り替わります。"
          highlights={[
            HELP_HIGHLIGHTS.navigator,
          ]}
        />

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>キャンバス</h3>
            <p>
              CSPのタイムラインで、そのフレームに表示されるセルの重なりを確認するプレビューです。
              中央上端の「キャンバス」で表示し、下端のシークバーでフレームを選びます。書き出し画像の表示と切り替えても拡大率を保持します。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>書き出し画像</h3>
            <p>
              セル・個別書き出し・仮想セルを、書き出し設定を反映した画像で確認します。
              タイル表示は出力一覧の検索条件に合う画像を並べ、１点表示は現在選択している画像を表示します。
            </p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>どちらのプレビューも、ホイールで拡大縮小、ドラッグで表示位置を移動できます。</li>
          <li>中央の表示を切り替えても、それぞれの拡大率と表示位置を保ちます。タイムラインは中央の「キャンバス」表示内にあります。</li>
          <li>レイヤーを非表示にしたり工程チェックをOFFにしたりして選択画像が出力されなくなると、その理由を中央に表示します。他の画像へは切り替えず、元の設定に戻すと同じ出力を表示します。</li>
          <li>未配置の仮想セルは出力一覧の別枠で確認できます。通常のJPEG／PNG出力の件数には含まれませんが、PSDとして保存できます。左ペインで仮想セルを編集しても中央の選択は変わりません。「◧」で明示的にプレビューできます。</li>
          <li>タイル表示では各画像の下に名前を表示します。１点表示では画像下のファイル名を押すと、省略された長い名前やフォルダ階層を確認できます。描画に警告がある場合は画像の近くに警告ボタンが表示されます。</li>
        </ul>
        <p className={styles.paragraph}>
          2Dカメラや変形アニメーションは適用せず、元の素材の状態でプレビュー・書き出しします。
        </p>
      </Section>

      <Section id="output-settings" title="4. 書き出し設定">
        <OutputSettingsGuide />
      </Section>

      <Section id="export" title="5. ZIP・フォルダへ書き出す">
        <p className={styles.paragraph}>書き出し中は画面下部に進捗、処理中のファイル名、完了枚数を表示します。設定変更・再読み込みは一時的に止まり、完了すると自動で操作に戻れます。完了表示は時間がたつと閉じます。</p>
        <HelpFigure
          src="output-menu.png"
          alt="出力メニューのZIP、フォルダ作成、直接書き出し"
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
            <h3>フォルダを作って書き出し</h3>
            <p>
              選択した場所に入力ファイル名のサブフォルダを作り、生成画像を直接保存します。
              同名フォルダがある場合は再利用でき、同名画像があれば上書きを確認します。「新しいフォルダに保存」を選ぶと、フォルダ名に番号を付けます。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>選択フォルダに直接書き出し</h3>
            <p>外側のフォルダを作らず、選択したフォルダ直下へ全画像を保存します。「フォルダ分け」がONでも、この保存方法ではフラットにまとめます。</p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>同名画像がある場合は、保存前に上書き件数と新規追加件数を確認できます。直接書き出しで「別名で保存」を選ぶと、画像名に _2、_3 などを付けます。</li>
          <li>上書きは今回出す同名画像だけを更新します。今回出さない古い画像や、ほかのファイルは残ります。</li>
          <li>同じ書き出し内のセルやカット同士は、上書きを選んでも互いに置き換えません。使用できない文字を置換し、同名は番号で区別します。保存先の重複によって、出力一覧からファイル名が調整される場合があります。</li>
          <li>フォルダがメニューに表示されないブラウザではZIPを使用してください。</li>
          <li>入力ファイルにDPI情報がある場合は、出力するJPG／PNGにも引き継ぎます。</li>
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
          非表示のレイヤーやフォルダは、プレビューにも出力にも含まれません。
          出力したい素材は、親フォルダを含めて表示してください。
        </div>

        <div className={styles.iconList}>
          <div>
            <span><LayerVisibilityIcon /></span>
            <p>
              <strong>レイヤーの表示／非表示（目のアイコン）</strong>：
              表示状態はプレビューと書き出しに反映されます。左端の列をクリックすると1件、縦にドラッグすると複数行を切り替えられます。
            </p>
          </div>
          <div>
            <span>★</span>
            <p>
              <strong>個別書き出し（名前の前の★）</strong>：
              そのレイヤーやフォルダを独立した静止画として出力し、セル画像や他の個別書き出しには混ぜません。
            </p>
          </div>
          <div>
            <span><LayerIcon kind="animation" /></span>
            <p>
              <strong>アニメーションフォルダの補助指定</strong>：
              フォルダ直下の子をセルとして扱い、1枚ずつ出力します。
            </p>
          </div>
          <div>
            <span><LayerExpandIcon /></span>
            <p>
              <strong>展開</strong>：
              Altを押しながらクリックすると、子フォルダもまとめて展開／折りたたみします。
            </p>
          </div>
        </div>

        <ul className={styles.list}>
          <li>選択したレイヤーの合成モードと不透明度は、レイヤーツリー直上の1行で変更できます。</li>
          <li>名前の前に、元のレイヤー種類、マスク、レイヤーカラー・境界効果、出力指定の順で記号が並びます。種類以外は該当する場合だけ表示されます。境界とマスクは併記し、無効なマスクには斜線を付けます。目のアイコン欄の背景色はCLIPのパレットカラーで、非表示にしても残ります。</li>
          <li>行を右クリック、タッチでは長押しすると、出力名の編集・個別書き出し・アニメーションフォルダの手動指定を操作できます。行を選択してShift+F10またはメニューキーでも開けます。自動指定か手動指定かは記号にポインターを合わせるか、メニューで確認できます。</li>
          <li>出力との関係は接続線と行の強調で確認できます。右側には警告や必要な行だけの「出力OFF」「一部OFF」「除外指定」を表示します。元のツリーでは非表示でも、選択した出力の仮想セル内で使う素材には「仮想セル」と表示します。詳細は各表示にポインターを合わせて確認できます。一覧で画像をOFFにしてもツリーの状態表示は変更しません。</li>
          <li>素材レイヤー上部の≡メニューから、レイヤーの表示状態を初期状態へ戻します。合成モード・不透明度や個別書き出し・手動アニメーション指定、画像ごとの出力OFFはそのままです。</li>
          <li>Shift＋スクロールで、書き出される画像単位（セル本体・工程別画像・個別書き出し・仮想セル）を順番に確認できます。セル内の補助レイヤーや、出力設定で除外した項目は飛ばします。</li>
          <li>巡回先は出力画像の行まで一時的に展開し、通り過ぎると元の閉じた状態に戻ります。手動で開いたフォルダは開いたままです。一時展開中も手動で開閉でき、次の巡回では必要な経路を再び開きます。</li>
          <li>Ctrl＋Z／Ctrl＋Shift＋Zで、操作を戻す／やり直すことができます。</li>
        </ul>
      </Section>

      <Section id="single-output" title="7. 静止画素材を個別書き出しする">
        <p className={styles.paragraph}>
          背景原図、BOOK、撮影指示、PAN・SL指示など、タイムラインへセルとして登録する必要がない
          静止画素材を、アニメーションフォルダへ移さず別画像として書き出す機能です。
        </p>

        <div className={styles.callout}>
          撮影指示やキャラのスライド指示は、作画・チェックの邪魔にならないようCSPではフォルダを非表示のまま保存できます。
          詳細設定の「対象フォルダを非表示でも表示して読み込む」がONなら、名前が「_」で始まるフォルダと登録名のフォルダは、
          Paperbackへ読み込む際に表示されます。子の描画レイヤーの非表示は維持します。元のCLIP・PSDは変更しません。
          書き出すかどうかは「出力対象」の素材名で切り替えます。
        </div>

        <HelpLayerTree label="個別書き出しのレイヤー構成と出力" layers={individualLayers} exampleId="individual-layers" />

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>指定方法</th><th>使う場面</th><th>結果</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>名前を「_」で始める</td>
                <td>CSP側で、毎回同じ素材を個別書き出しにしておく</td>
                <td><code>_BG</code>が<code>_BG.jpg</code>として出力される</td>
              </tr>
              <tr>
                <td>設定へフォルダ名を登録</td>
                <td>名前を変えず、同名フォルダを毎回自動指定する</td>
                <td>「撮影指示」「原図」など登録名と完全一致したフォルダが個別書き出しになる</td>
              </tr>
              <tr>
                <td>行を右クリックし「この素材を別画像として書き出す」を選ぶ</td>
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
            note={<>個別書き出しの<code>_BG</code>や<code>_PAN</code>は混ざりません。</>}
          />
          <OutputExample
            filename="_BG.jpg"
            formula={<>memo ＋ Frame ＋ _原図/_BG</>}
            note={<>通常の共通レイヤーは重なり、別の個別書き出し素材は混ざりません。</>}
          />
        </div>

        <div className={styles.callout}>
          <code>_原図</code>や<code>_撮影指示</code>の直下が個別書き出しだけの場合、
          親は整理用フォルダとして扱い、親自身の重複画像は作りません。
          また、自動指定のフォルダが空、または配下がフォルダだけの場合も出力しません。非表示や透明でも描画レイヤーがあれば対象に残ります。必要なら空のフォルダもメニューから手動指定できます。
        </div>
      </Section>

      <Section id="animation-folders" title="8. アニメーションフォルダを指定する">
        <p className={styles.paragraph}>
          CLIPに保存されたアニメーションフォルダを直接認識し、
          直下のセルを1枚ずつ出力します。通常フォルダをセル群として扱いたい場合は、
          素材レイヤーの行を右クリックまたは長押しし、「このフォルダを手動でアニメーションフォルダとして扱う」を選びます。
        </p>

        <p className={styles.paragraph}>
          元のフォルダの記号を残し、その隣にアニメーション指定の記号が付きます。直下の子の名前がセルの色になり、種類アイコンは元の種類を保ちます。
          指定中はアニメーション指定が優先され、個別書き出しの★は表示しません。同じメニューから手動指定を解除できます。
          CLIP本来のアニメーションフォルダは種類アイコン自体で示します。工程構成からの自動指定にはオレンジの記号が付きます。
        </p>

        <div className={styles.priorityFlow}>
          <span>CLIPから直接認識</span>
          <b>→</b>
          <span>必要なフォルダだけ手動指定</span>
          <b>→</b>
          <span>直下の子を1枚ずつ出力</span>
        </div>

        <div className={styles.compareGrid}>
          <div>
            <HelpLayerTree label="CLIPから認識される例" layers={clipAnimationLayers} exampleId="clip-animation" />
            <p className={styles.paragraph}>CLIPから認識されたフォルダは、最初からアニメーションフォルダの記号です。手動指定の操作は表示されません。アニメーションフォルダAのタイムラインと、直下のセル1・2を対応付けます。</p>
          </div>
          <div>
            <HelpAnimationFolderExample />
            <p className={styles.paragraph}>エフェクトフォルダを指定すると、直下の1・2をセルとして出力します。フォルダ全体を1枚にする★の個別書き出しとは使い分けます。</p>
          </div>
        </div>

        <div className={styles.calloutWarning}>
          タイムライン未使用セルは通常、初期OFFになります。「兼用カット」をONにすると未使用セルも表示状態に従って出力できます。目アイコンで個別に調整できます。
        </div>
      </Section>

      <Section id="process" title="9. 演出・作監などの修正工程を分けて出力する">
        <p className={styles.paragraph}>
          「書き出し設定」内の「詳細設定…」の工程フォルダリストへ、工程のフォルダ名と出力ファイルへ付けるサフィックスを登録します。
          演出や作監修正を、本体と同じセル番号の別画像として出力できます。
        </p>

        <div className={styles.compareGrid}>
          <div>
            <HelpLayerTree label="トラック分離型" layers={trackProcessLayers} exampleId="track-process" />
            <p className={styles.paragraph}>
              アニメーションフォルダAの親「演出」が登録名に一致すると、
              その中のセルへ<code>_e</code>が付きます。
            </p>
          </div>
          <div>
            <HelpLayerTree label="セル内蔵型" layers={celProcessLayers} exampleId="cel-process" />
            <p className={styles.paragraph}>
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
          <li>「書き出し設定」の工程チップをOFFにすると、その工程画像だけを書き出し対象から外せます。</li>
        </ul>
      </Section>

      <Section id="virtual-cels" title="10. 仮想セル">
        <HelpFigure
          src="loaded-overview.png"
          alt="左ペインの仮想セル"
          caption="赤枠の仮想セルへ、右ペインから出力に使うレイヤーを追加します。"
          compact
          highlights={[HELP_HIGHLIGHTS.virtualCels]}
        />

        <p className={styles.paragraph}>
          読み込んだ複数のレイヤーを組み合わせ、JPEG／PNGの合成画像や、レイヤーを保持したPSDを作る機能です。
          元の作画データを複製せず、セル・BG・BOOKなどの組み合わせを追加できます。
        </p>

        <div className={styles.callout}>
          背景原図と任意のキャラクターのセルを重ねたレイアウト確認画像や、背景原図用のPSDファイルを作れます。
          背景原図・BOOK・修正・参照用のセルなど、必要な素材を仮想セルのツリーで整理して書き出します。
        </div>

        <ol className={styles.numberedList}>
          <li>上部ツールバーの「仮想セル」で左ペインを開きます。初期状態では閉じています。</li>
          <li>左ペインの「＋追加」で仮想セルを作成し、出力ファイル名になる名前を付けます。</li>
          <li>右ペインから、画像に含めたいレイヤーを仮想セルの入れたい位置へドラッグします。行の間は赤い挿入線、フォルダ内はフォルダ行の強調で示します。空のフォルダにも追加できます。</li>
          <li>追加したレイヤーは行をドラッグして並べ替え、フォルダの内外へ移動できます。Ctrl（MacはCommand）で複数選択、Shiftで範囲選択し、まとめて移動できます。閉じたフォルダに重ねて待つと展開します。</li>
          <li>名前のダブルクリック、F2、右クリック・長押しメニューの「名前を変更」で、仮想セル内だけの名前を付けられます。Enterで確定、Escapeで取消です。</li>
          <li>ツリー上部のフォルダ＋アイコンか行メニューの「新規レイヤーフォルダ」でフォルダを作れます。選択したフォルダの中、または選択したレイヤーの上に作成します。未選択なら一番下に作成します。</li>
          <li>目、合成モード、不透明度を仮想セル内で調整します。ツリー上部のゴミ箱アイコンで選択した素材を取り除けます。複数選択にも対応し、フォルダは中身もまとめて取り除きます。行の右クリック・長押しメニューにも「仮想セルから取り除く」があります。元の素材ツリーは変わらず、名前変更・作成・削除もUndoで戻せます。一括削除は1回のUndoで戻ります。</li>
        </ol>

        <h3 className={styles.subsectionTitle}>背景原図用PSDとして保存する</h3>
        <HelpFigure src="virtual-psd-menu.png" alt="仮想セルのタイトル行のメニューからPSDとして書き出す"
          caption="各仮想セルの≡メニューから、赤枠の「PSDとして書き出す」を選びます。" compact
          highlights={[HELP_HIGHLIGHTS.psdExport]} />
        <ol className={styles.numberedList}>
          <li>仮想セル内で、背景原図や参照用の素材の階層・名前・表示状態・合成モード・不透明度を調整します。</li>
          <li>その仮想セルのタイトル行右端にある≡メニューを開き、「PSDとして書き出す」を選びます。</li>
          <li>保存先を選びます。保存画面に対応していないブラウザでは、そのままダウンロードします。ファイル名は仮想セル名に .psd を付けたものです。</li>
        </ol>
        <p className={styles.paragraph}>
          PSDには仮想セル側のツリーを保存します。仮想セル全体を包むフォルダは追加しません。
          挿入位置の指定は不要で、周囲の用紙やフレームは仮想セルへ追加したものだけを含めます。
          フォルダ構造・並び順・名前・表示状態・合成モード・不透明度、マスクとクリッピングを保持します。
          効果による画像化の対象以外は、非表示レイヤーや空フォルダも残します。
        </p>
        <p className={styles.paragraph}>
          描画レイヤーは読み込み時に取得した画像を使い、画像素材・テキスト・ベクターもラスタライズ画像として保存します。
          元の編集形式やアニメーションのタイムラインは引き継ぎません。アニメーションフォルダは通常のフォルダとして、ツリー内の子レイヤーをすべて保存します。
          CLIPのレイヤーカラー・境界線・通常の水彩境界は画像に焼き込みます。
          効果付きフォルダは、仮想セル内で追加・移動した素材も含む表示中の子を合成して、同名の1枚の画像レイヤーにします。
          変換したフォルダの子レイヤーや非表示の編集元はPSDに残しません。アプリ上の仮想セルツリーは変更しません。
          水彩境界の近似や、トーンなど引き継げない効果は書き出し結果に案内を表示します。
          描画画像を取得できない素材がある場合はPSD保存を中止し、対象の素材名を表示します。
        </p>

        <h3 className={styles.subsectionTitle}>JPEG／PNGの合成画像として保存する</h3>
        <ol className={styles.numberedList}>
          <li>仮想セルの⠿を右ペインへドラッグし、素材のレイヤー順のどこへ挿入するか指定します。</li>
          <li>上部の「書き出し画像」で合成結果を確認し、通常の出力ボタンから保存します。</li>
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
          JPEG／PNGの書き出し画像を作ります。レイヤーが1件もない、または挿入位置がない仮想セルは、この画像出力には含まれません。
          左ペインを閉じても、作成した仮想セルの設定は残ります。
        </div>
      </Section>

      <Section id="detailed-settings" title="11. 詳細設定と設定JSON">
        <p className={styles.paragraph}>上部の「書き出し設定」を開き、パネル下端の「詳細設定…」を押します。</p>
        <HelpFigure
          src="settings-dialog.png"
          alt="書き出し詳細設定ダイアログ"
          caption="赤枠の詳細設定で、工程名、個別書き出し、除外リスト、設定の保存・読み込みを行います。"
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
                <td>工程に属さないセル画像</td>
                <td>「出力対象」に表示するグループ名。初期設定は「作画」。BG・撮影指示などの個別書き出しは含みません</td>
                <td>確定すると表示名へ反映。分類・ファイル名・出力ON/OFFは変わりません</td>
              </tr>
              <tr>
                <td>工程フォルダリスト</td>
                <td>グループ名、対応フォルダ名、出力名に付ける文字、確認フチの色を登録。書き出し設定にはグループ名とフチ色を表示。グループ名を変えても対応フォルダ名や出力名は変わりません</td>
                <td>現在の出力名・プレビュー・書き出しへ反映</td>
              </tr>
              <tr>
                <td>個別に書き出すフォルダ名</td>
                <td>「_」以外にも自動で個別書き出しにするフォルダ名を完全一致で登録</td>
                <td>次に素材を読み込んだときに反映</td>
              </tr>
              <tr>
                <td>名前による指定の除外</td>
                <td>「_old」などに一致するフォルダと配下を、自動の工程・個別書き出しの検出と自動表示から外す。ツリーには「除外指定」と表示。手動指定・仮想セルでの使用や、表示中の共通素材としての合成は可能</td>
                <td>次に素材を読み込んだときに反映</td>
              </tr>
              <tr>
                <td>デスクトップ版の更新確認</td>
                <td>自動確認をオフ、起動するたび、1週間ごと（初期設定）から選ぶ。新版があればリンクで通知し、自動ダウンロードはしません</td>
                <td>この端末に記憶。起動時・起動中に確認し、クイック書き出しでは処理終了後に確認します。設定JSONには含めません</td>
              </tr>
              <tr>
                <td>設定を書き出す／読み込む</td>
                <td>出力名、連番、グループ名、工程フォルダ、個別書き出し、除外リストをJSONとして保存・復元</td>
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
              <li>左端のメニュー内にある「表示サイズ」で文字や操作部品の大きさを調整します。</li>
              <li>「書き出し設定」を押すと、設定パネルが画面に重なって開きます。</li>
              <li>仮想セルの挿入位置は、右ペインでレイヤーを選んで上／下ボタンでも指定できます。</li>
            </ul>
          </div>
        </div>

        <div className={styles.callout}>
          クイック書き出しでは、読み込み後に個別書き出しやアニメーションフォルダの手動指定を追加する画面は表示されません。
          カットごとに指定を変えたい場合は、通常起動で素材を読み込んでから書き出してください。
        </div>
      </Section>
    </article>
  )
}
