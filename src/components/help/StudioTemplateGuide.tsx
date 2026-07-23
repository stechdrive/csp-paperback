import { HelpFigure } from './HelpFigure'
import styles from '../HelpDialog.module.css'

export function StudioTemplateGuide() {
  return (
    <section
      className={styles.section}
      data-help-section="studio-templates"
      aria-labelledby="studio-template-guide-title"
    >
      <h2 id="studio-template-guide-title" className={styles.sectionTitle}>
        各社テンプレートに対応するには
      </h2>
      <p className={styles.paragraph}>
        CSP Paperbackには一般的なフォルダ名とサフィックスが登録されています。
        スタジオのテンプレートに同じ役割のフォルダや独自の命名規則がある場合は、
        「書き出し詳細設定」をスタジオの仕様に合わせます。
      </p>

      <h3 className={styles.subsectionTitle}>
        1. 工程フォルダの名称とサフィックスを登録する
      </h3>
      <p className={styles.paragraph}>
        演出・作画などの工程ごとに、PSD内のフォルダ名と、
        出力ファイル名へ付けるサフィックスを同じ行へ登録します。
        フォルダ名とサフィックスは、どちらもスタジオの仕様に合わせて変更できます。
      </p>

      <HelpFigure
        src="settings-dialog.png"
        alt="書き出し詳細設定の工程フォルダリスト"
        caption="赤枠の工程フォルダリストで、サフィックスと対応するフォルダ名を設定します。"
        highlights={[
          { label: '工程設定', x: 20.8, y: 44.2, width: 58.6, height: 37.2 },
        ]}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>工程</th>
              <th>アプリのデフォルト</th>
              <th>スタジオ向けの設定例</th>
              <th>出力例</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>演出</td>
              <td>フォルダ名「演出」／<code>_e</code></td>
              <td>フォルダ名「EN」／<code>_en</code></td>
              <td><code>A1_en.jpg</code></td>
            </tr>
            <tr>
              <td>作画</td>
              <td>工程登録なし／サフィックスなし</td>
              <td>フォルダ名「作画」／<code>_l</code></td>
              <td><code>A1_l.jpg</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.callout}>
        作画はアプリのデフォルトではサフィックスなしで出力します。
        作画を<code>_l</code>付きで出すスタジオでは、工程フォルダリストへ
        「作画」と<code>_l</code>の組み合わせを追加します。
        サフィックスは入力した文字をそのまま使います。
      </div>

      <h3 className={styles.subsectionTitle}>
        2. 静止画素材をまとめる親フォルダの名称を登録する
      </h3>
      <p className={styles.paragraph}>
        アニメーションフォルダではない静止画素材をまとめる親フォルダに、
        スタジオ独自の名称を使っている場合は「単体出力の自動マーク」へ追加します。
      </p>

      <div className={styles.compareGrid}>
        <div className={styles.compareCard}>
          <h3>アプリのデフォルト</h3>
          <pre>{`撮影指示/
  _PAN/
  _SL/`}</pre>
        </div>
        <div className={styles.compareCard}>
          <h3>スタジオのテンプレート例</h3>
          <pre>{`CAMERA/
  _PAN/  → _PAN.jpg
  _SL/   → _SL.jpg`}</pre>
        </div>
      </div>

      <div className={styles.callout}>
        この場合は「単体出力の自動マーク」へ<code>CAMERA</code>を追加します。
        <code>CAMERA</code>は静止画素材をまとめる親フォルダとして扱われ、
        配下の<code>_PAN</code>と<code>_SL</code>がそれぞれ静止画として出力されます。
      </div>

      <h3 className={styles.subsectionTitle}>3. 設定を保存・共有する</h3>
      <p className={styles.paragraph}>
        スタジオ用の設定ができたら「設定を書き出す」でJSONとして保存します。
        ほかの人や別の端末では「設定を読み込む」で同じ設定を使えます。
      </p>

      <div className={styles.priorityFlow} aria-label="設定を共有する手順">
        <span>設定を書き出す</span>
        <b>→</b>
        <span>設定JSONを共有</span>
        <b>→</b>
        <span>設定を読み込む</span>
      </div>

      <div className={styles.callout}>
        JSONには、出力名、連番、工程フォルダリスト、自動マークするフォルダ名、
        自動マークの除外リストが保存されます。
      </div>
    </section>
  )
}
