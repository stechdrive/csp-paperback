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

export function AboutGuide() {
  return (
    <article className={styles.article}>
      <div className={styles.pageHero}>
        <div className={styles.eyebrow}>このツールの考え方</div>
        <h1 className={styles.pageTitle}>CSPの作業構造を、必要な「紙」へ戻す</h1>
        <p className={styles.pageLead}>
          ここは操作手順ではなく、CSP Paperbackが何を補い、どのような基準で合成しているかを説明する章です。
        </p>
      </div>

      <Section id="why" title="なぜ作ったか">
        <p className={styles.paragraph}>
          CLIP STUDIO PAINTの「アニメーションセル出力」は、タイムライン上のセルをまとめて画像にできる便利な機能です。
          一方、アニメーションフォルダ外の素材を含める指定は大きな単位になりやすく、
          「フレームは重ねたいが撮影指示は別にしたい」「セル内の演出修正だけ別紙にしたい」といった
          制作現場の細かな出し分けには手作業が残ります。
        </p>

        <div className={styles.problemGrid}>
          <div><strong>背景原図・BOOK</strong><span>セルとは別ファイルにしたい</span></div>
          <div><strong>フレーム・メモ</strong><span>必要な出力へ共通で重ねたい</span></div>
          <div><strong>演出・作監修正</strong><span>本体と同じセル番号の別紙にしたい</span></div>
          <div><strong>任意の組み合わせ</strong><span>PSDを複製せず確認素材を作りたい</span></div>
        </div>

        <p className={styles.paragraph}>
          CSP Paperbackは、CSPのレイヤー構造とXDTSのタイムラインを読み取り、
          作業中のPSDを組み替えずに、必要な完成画像へ一括で戻すための補助ツールです。
        </p>
      </Section>

      <Section id="paper-model" title="メンタルモデル：「紙に戻す」">
        <div className={styles.paperFlow}>
          <div>
            <span className={styles.paperLabel}>CSPの作業ファイル</span>
            <strong>1つのPSDに素材と工程をまとめる</strong>
          </div>
          <b>→</b>
          <div>
            <span className={styles.paperLabel}>CSP Paperback</span>
            <strong>役割・位置・タイムラインを解釈する</strong>
          </div>
          <b>→</b>
          <div>
            <span className={styles.paperLabel}>書き出し</span>
            <strong>セル本体・修正・原図を別々の紙へ戻す</strong>
          </div>
        </div>

        <p className={styles.paragraph}>
          アニメーション制作では、同じセル番号の中に作画担当者の線、演出修正、作監修正が同居することがあります。
          画面上では重ねて作業していても、確認や受け渡しでは
          <code>A2.png</code>、<code>A2_e.png</code>、<code>A2_s.png</code>のように
          別々の紙として扱いたい。その変換を自動化するのが中心の考え方です。
        </p>
      </Section>

      <Section id="context" title="重なる素材と「別の紙」">
        <div className={styles.contextDiagram}>
          <div className={styles.contextLayerTop}>前面の共通素材：メモ・フレーム・指示線</div>
          <div className={styles.contextTarget}>出力対象：Aセル／背景原図／仮想セル</div>
          <div className={styles.contextLayerBottom}>背面の共通素材：用紙・背景・レイアウト</div>
        </div>

        <p className={styles.paragraph}>
          出力対象の祖先や兄弟にある通常レイヤーは、PSD上の前後関係を保って重なります。
          一方、★や「_」で単体出力にした素材、別のアニメーションフォルダ、別の工程素材は、
          他の画像へ勝手に混ざらず「別の紙」として隔離されます。
        </p>

        <div className={styles.callout}>
          仮想セルも同じ考え方です。メンバーだけを合成するのではなく、
          指定した挿入位置にその仮想セルが存在した場合の前後関係を再現します。
        </div>
      </Section>

      <Section id="opacity" title="不透明度の考え方">
        <p className={styles.paragraph}>
          CSPでは、前後のセルや修正工程を見比べるため、フォルダ全体を一時的に薄くすることがあります。
          この「作業用の透かし」と、半透明エフェクトのような「絵として意図した不透明度」を区別します。
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>種類</th><th>出力時</th><th>理由</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>アニメフォルダ、セル、工程など構造上の入れ物</td>
                <td>100%として扱う</td>
                <td>作業中の透かしを完成画像へ持ち込まないため</td>
              </tr>
              <tr>
                <td>線画、彩色、影、エフェクトなど実際のアートワーク</td>
                <td>PSDの値を尊重</td>
                <td>作画者が意図した半透明表現を保つため</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className={styles.paragraph}>
          合成モード、表示状態、マスク、レイヤー順も可能な範囲でPSDの意図を保ち、
          ナビゲーターと出力プレビューを分けることで「PSDの現在」と「保存される画像」の両方を確認できるようにしています。
        </p>
      </Section>

      <Section id="privacy" title="通信とファイルアクセス">
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

      <Section id="template" title="サンプル作画テンプレート">
        <p className={styles.paragraph}>
          サンプルテンプレートは、工程フォルダ、単体出力、セル内蔵型の修正工程などを試しやすいようにした
          CLIP STUDIO PAINT用の作画テンプレートです。使用は必須ではありません。
          普段のCLIPファイルから書き出したPSD／XDTSでも利用できます。
        </p>

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
