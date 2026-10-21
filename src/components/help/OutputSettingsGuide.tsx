import { ja } from '../../i18n/ja'
import styles from '../HelpDialog.module.css'
import { HelpFigure } from './HelpFigure'
import { HELP_HIGHLIGHTS } from './helpHighlights'

function HintText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, index, lines) => (
        <span key={`${index}-${line}`}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  )
}

export function OutputSettingsGuide() {
  return (
    <>
      <HelpFigure
        src="export-settings.png"
        alt="中央下部のボタンから開いた書き出し設定パネル"
        caption="赤枠の書き出し設定を変更すると、出力例と出力プレビューへ反映されます。"
        highlights={[HELP_HIGHLIGHTS.exportSettings]}
      />

      <p className={styles.paragraph}>
        素材を読み込んだあとは、中央下部の「書き出し設定」で設定パネルを開きます。
        設定は画面に重なって表示されるため、開閉してもプレビューやレイヤーの配置は変わりません。
        閉じている間も、下部の1行で現在の設定を確認できます。
      </p>

      <h3 className={styles.subsectionTitle}>画像形式と保存先の構成</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>設定</th><th>選択肢</th><th>何が変わるか</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{ja.export.format}</td>
              <td>JPG</td>
              <td>{ja.export.formatJpgHint}</td>
            </tr>
            <tr>
              <td>{ja.export.format}</td>
              <td>PNG</td>
              <td>{ja.export.formatPngHint}</td>
            </tr>
            <tr>
              <td>背景</td>
              <td>白ベタ</td>
              <td>{ja.export.bgWhiteHint}</td>
            </tr>
            <tr>
              <td>背景</td>
              <td>透明</td>
              <td>{ja.export.bgTransparentHint}</td>
            </tr>
            <tr>
              <td>フォルダ分け</td>
              <td>ON／OFF</td>
              <td><HintText text={ja.export.structureHint} /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className={styles.subsectionTitle}>出力名の違いを実例で確認する</h3>
      <p className={styles.paragraph}>
        セル名は、クリスタのセルのレイヤー名・レイヤーフォルダ名です。「1」「2」など、すでに付けた番号も使えます。
        アニメーションフォルダ<code>A</code>にセル<code>1</code>、<code>2</code>、<code>3</code>があり、
        2枚目と同じフレームから始まる演出修正<code>_e</code>が1枚だけある例です。初期設定の「フォルダ名あり・区切りあり・修正記号は後ろ」とします。
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>出力名</th><th>選ぶ目的</th><th>生成されるファイル</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>連番</td>
              <td>{ja.settings.cellNamingSequenceHint}</td>
              <td>
                <code>A_1.jpg</code><br />
                <code>A_2.jpg</code><br />
                <code>A_3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>{ja.settings.cellNamingSequenceCellname}</td>
              <td>連番の後ろに元のセル名を付けます。</td>
              <td>
                <code>A_1_1.jpg</code><br />
                <code>A_2_2.jpg</code><br />
                <code>A_3_3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>セル名</td>
              <td>クリスタで付けた番号や名前を使います。</td>
              <td>
                <code>A_1.jpg</code><br />
                <code>A_2.jpg</code><br />
                <code>A_3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>{ja.settings.cellNamingSheetSequence}</td>
              <td>
                クリスタのタイムラインで、作画と同じフレームから始まる修正に、作画と同じ番号を付けます。
              </td>
              <td>
                作画：<br />
                <code>A_1.jpg</code><br />
                <code>A_2.jpg</code><br />
                <code>A_3.jpg</code><br />
                演出修正：<br />
                <code>A_2_e.jpg</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className={styles.paragraph}>
        または、Aフォルダの1番目のセルが<code>ア</code>なら、
        「連番＋セル名」は<code>A_1_ア.jpg</code>、「セル名」は<code>A_ア.jpg</code>になります。
      </p>

      <div className={styles.callout}>
        「{ja.settings.cellNamingSheetSequence}」では、修正が1枚だけでも、作画に合わせて「2」で書き出します。
        作画の<code>A_2.jpg</code>と演出修正の<code>A_2_e.jpg</code>を、ファイル名で対応付けられます。
      </div>

      <h3 className={styles.subsectionTitle}>ファイル名と出力対象を調整する設定</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>設定</th><th>選択肢</th><th>何が変わるか・具体例</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>連番桁数</td>
              <td>自動／4桁</td>
              <td><HintText text={ja.settings.sequenceDigitsHint} /></td>
            </tr>
            <tr>
              <td>フォルダ名との区切り</td>
              <td>_ あり／なし</td>
              <td><HintText text={ja.settings.cellPrefixSeparatorHint} /></td>
            </tr>
            <tr>
              <td>アニメーションフォルダ名</td>
              <td>ON／OFF</td>
              <td><HintText text={ja.settings.xdtsTrackPrefixHint} /></td>
            </tr>
            <tr>
              <td>兼用カット</td>
              <td>ON／OFF</td>
              <td><HintText text={ja.export.sharedCutHint} /></td>
            </tr>
            <tr>
              <td>{ja.export.processSuffixPosition}</td>
              <td>前／後ろ</td>
              <td><HintText text={ja.export.processSuffixPositionHint} /></td>
            </tr>
            <tr>
              <td>{ja.export.revisionBorder}</td>
              <td>ON／OFF</td>
              <td><HintText text={ja.export.revisionBorderHint} /></td>
            </tr>
            <tr>
              <td>出力対象</td>
              <td>作画／工程名／素材名</td>
              <td>
                読み込んだ素材に該当する工程と、個別に書き出す素材名を表示します。同名の素材はまとめて切り替えます。
                「作画」をOFFにしても、同じセル内の修正は書き出せます。工程名の前にある色見本は、その工程のフチ色です。
                レイヤーの表示状態は変わらず、ツリーに「出力OFF」または「一部OFF」が表示されます。OFFにした項目もここに残ります。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.callout}>
        ファイル名設定の直下に「出力例」が表示されます。設定にポインターを合わせると、名前の対応する部分に下線が付きます。変更時の下線は短時間で消えます。
        説明の吹き出しは出力例を避けて表示されます。出力例の文字をクリックすると、その部分の設定へ移動できます。
      </div>
    </>
  )
}
