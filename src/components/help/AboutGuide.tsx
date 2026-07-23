import { SampleTemplateDownloadButton } from '../SampleTemplateDownloadButton'
import { UpdateCheckPanel } from '../UpdateCheckPanel'
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

export function AboutGuide() {
  return (
    <article className={styles.article}>
      <div className={styles.pageHero}>
        <div className={styles.eyebrow}>このツールについて</div>
        <h1 className={styles.pageTitle}>CSPのセル出力で、素材ごとの出し分けをできるようにする</h1>
        <p className={styles.pageLead}>
          CLIP STUDIO PAINTの標準機能では難しい出力と、CSP Paperbackで画像がどう分かれるかを
          実際のレイヤー名とファイル名で説明します。
        </p>
      </div>

      <Section id="problem" title="1. CSP標準のセル出力で困ること">
        <p className={styles.paragraph}>
          CLIP STUDIO PAINTの「アニメーションセル出力」には、
          アニメーションフォルダ外のレイヤーを出力へ含める設定があります。
          ただし選べるのはON／OFFだけなので、素材ごとに「セルへ重ねる」「別画像にする」を分けられません。
        </p>

        <div className={styles.compareGrid}>
          <div className={styles.compareCard}>
            <h3>フレームと撮影指示</h3>
            <p>
              フレームはすべてのセルへ重ねたい一方で、PAN・SLなどの撮影指示は
              セルへ混ぜず、確認用の静止画として別に出したい。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>背景原図とBOOK</h3>
            <p>
              タイムラインへセルとして登録する必要はないが、BGやBOOKを
              アニメーションセルとは別の静止画としてまとめて出したい。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>演出・作監修正</h3>
            <p>
              セル内の修正工程を本体へ混ぜず、<code>B1.jpg</code>と
              <code>B1_s.jpg</code>のように同じセル番号の別画像へ分けたい。
            </p>
          </div>
          <div className={styles.compareCard}>
            <h3>複数レイヤーの組み合わせ</h3>
            <p>
              元のPSDを複製せず、キャラ・BG・BOOKなどを選んだ確認用画像を追加したい。
            </p>
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>やりたいこと</th><th>CSP Paperbackでの指定</th><th>出力結果</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>フレームはセルへ重ね、撮影指示は別にする</td>
                <td>フレームは通常レイヤー、撮影指示は単体出力</td>
                <td><code>A1.jpg</code>と<code>_PAN.jpg</code>を別々に生成</td>
              </tr>
              <tr>
                <td>背景原図・BOOKを静止画として出す</td>
                <td>フォルダ名を「_」で始める、登録名を使う、または★を付ける</td>
                <td><code>_BG.jpg</code>、<code>_BOOK1.jpg</code></td>
              </tr>
              <tr>
                <td>修正工程を本体から分ける</td>
                <td>工程フォルダ名とサフィックスを設定</td>
                <td><code>B1.jpg</code>、<code>B1_s.jpg</code></td>
              </tr>
              <tr>
                <td>任意のレイヤーを組み合わせる</td>
                <td>仮想セルへレイヤーと挿入位置を指定</td>
                <td><code>仮想セルテスト.jpg</code>など指定名の画像</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="features" title="2. CSP Paperbackでできること">
        <ul className={styles.list}>
          <li>
            <strong>単体出力</strong>：
            アニメーションしないBG、BOOK、撮影指示をタイムラインへ登録せず、独立した静止画として出力します。
          </li>
          <li>
            <strong>修正工程の分離</strong>：
            セル内の<code>_s</code>や別トラックの「演出」を、本体と同じセル番号の
            <code>B1_s.jpg</code>、<code>A1_e.jpg</code>として出力します。
          </li>
          <li>
            <strong>仮想セル</strong>：
            PSD内のレイヤーを選び、指定したレイヤー順へ挿入した1枚の合成画像を追加します。
          </li>
          <li>
            <strong>タイムライン表示</strong>：
            XDTSを使って、CSPのタイムラインで各フレームに表示されるセルの重なりを確認します。
          </li>
          <li>
            <strong>ファイル名の調整</strong>：
            連番、CSPのセル名、シート順、工程サフィックスを組み合わせて
            <code>A2_e.jpg</code>などの出力名を作ります。
          </li>
        </ul>
      </Section>

      <Section id="compositing" title="3. どのレイヤーがどの画像に含まれるか">
        <p className={styles.paragraph}>
          次の例では、通常レイヤーの<code>memo</code>と<code>Frame</code>を表示したまま、
          作画セル、単体出力、修正工程を書き出します。
        </p>

        <div className={styles.outputExampleGrid}>
          <OutputExample
            filename="A1.jpg"
            formula={<>memo ＋ Frame ＋ 作画/A/1</>}
            note={<>通常の作画セル。単体出力の<code>_BG</code>や<code>_PAN</code>は入りません。</>}
          />
          <OutputExample
            filename="_BG.jpg"
            formula={<>memo ＋ Frame ＋ _原図/_BG</>}
            note={<>背景原図を単体出力。別の単体出力素材や作画セルは入りません。</>}
          />
          <OutputExample
            filename="B1.jpg"
            formula={<>memo ＋ Frame ＋ B/1の線画 ＋ 影</>}
            note={<>セル内の作監修正フォルダ<code>_s</code>は本体へ入りません。</>}
          />
          <OutputExample
            filename="B1_s.jpg"
            formula={<>memo ＋ Frame ＋ B/1/_s</>}
            note={<>作監修正だけを、本体と同じセル番号の別画像として出力します。</>}
          />
        </div>

        <div className={styles.callout}>
          目がOFFのレイヤーやフォルダは、どの画像にも含まれません。
          単体出力や別工程にした素材は他の出力へ混ざらず、表示中の通常レイヤーだけが
          PSDの前後関係を保って重なります。
        </div>

        <h3 className={styles.subsectionTitle}>仮想セルの場合</h3>
        <p className={styles.paragraph}>
          仮想セルへ追加したレイヤーを合成し、右ペインで指定した挿入位置へ置いた場合の前後関係を使います。
          たとえば仮想セルを<code>_撮影指示</code>の上へ挿入すると、その位置より前面・背面にある
          通常レイヤーも含めて出力プレビューを作ります。
        </p>
      </Section>

      <Section id="opacity" title="4. 不透明度が出力でどう扱われるか">
        <p className={styles.paragraph}>
          CSPで前後のセルや修正を見比べるために、アニメーションフォルダやセル全体を一時的に薄くしていても、
          その作業用の透かしは完成画像へ持ち込みません。一方、半透明の影やエフェクトはPSDの値を使います。
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>レイヤーの種類</th><th>出力時の不透明度</th><th>具体例</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>構造上の入れ物</td>
                <td>100%として扱う</td>
                <td>アニメーションフォルダ、セルフォルダ、工程フォルダ</td>
              </tr>
              <tr>
                <td>実際に描かれたレイヤー</td>
                <td>PSDの値を使う</td>
                <td>線画、彩色、影、半透明エフェクト</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className={styles.paragraph}>
          合成モード、表示状態、マスク、レイヤー順も、出力対象の構成に合わせて反映します。
          最終結果は出力プレビューで確認できます。
        </p>
      </Section>

      <Section id="privacy" title="5. 通信とファイルアクセス">
        <div className={styles.privacyStatement}>
          <strong>作品データは外部へ送信しません。</strong>
          <span>PSD、XDTS、設定内容、ファイル名、生成画像の処理はブラウザ内または端末内で完結します。</span>
        </div>

        <ul className={styles.list}>
          <li>アカウントやサーバーは不要です。</li>
          <li>ブラウザ版のフォルダ権限は、選択したローカルフォルダへ生成画像を書き込むために使います。</li>
          <li>デスクトップ版は「更新確認」を押した時だけ、GitHub Releasesの最新バージョン情報を取得します。</li>
          <li>最新版のダウンロードはアプリ内では行わず、既定ブラウザでGitHub Releasesを開きます。</li>
        </ul>

        <UpdateCheckPanel />
      </Section>

      <Section id="template" title="6. サンプル作画テンプレート">
        <p className={styles.paragraph}>
          サンプルテンプレートには、作画セル、演出・作監修正、背景原図、BOOK、撮影指示が入っています。
          機能ガイドの<code>A1.jpg</code>、<code>B1_s.jpg</code>、<code>_BG.jpg</code>などの
          出力例を実際に確認できます。
        </p>

        <div className={styles.callout}>
          このテンプレートを使う必要はありません。
          普段のCLIPファイルから同じカットのPSDとXDTSを書き出して利用できます。
        </div>

        <div className={styles.templateAction}>
          <SampleTemplateDownloadButton
            className={styles.primaryAction}
            statusClassName={styles.actionStatus}
            errorClassName={styles.actionError}
            label="サンプル作画テンプレート（.clip）をダウンロード"
          />
        </div>
      </Section>
    </article>
  )
}
