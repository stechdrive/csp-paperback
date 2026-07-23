import { ja } from '../../i18n/ja'
import styles from '../HelpDialog.module.css'
import { HelpFigure } from './HelpFigure'

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
        src="loaded-overview.png"
        alt="中央ペインの書き出し設定"
        caption="赤枠の書き出し設定を変更すると、出力例と出力プレビューへ反映されます。"
        highlights={[
          { label: '書き出し設定', x: 20.5, y: 49, width: 56, height: 24.8 },
        ]}
      />

      <h3 className={styles.subsectionTitle}>画像形式と保存先の構成</h3>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>設定</th><th>選択肢</th><th>何が変わるか</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>フォーマット</td>
              <td>JPG</td>
              <td>{ja.export.formatJpgHint}</td>
            </tr>
            <tr>
              <td>フォーマット</td>
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
        アニメーションフォルダ<code>A</code>にセル<code>1</code>、<code>2</code>、<code>3</code>があり、
        2番だけ演出修正<code>_e</code>がある例です。区切りは「なし」、工程名は「後ろ」とします。
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
                <code>A1.jpg</code><br />
                <code>A2.jpg</code><br />
                <code>A3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>連番セル名</td>
              <td>{ja.settings.cellNamingSequenceCellnameHint}</td>
              <td>
                <code>A1_1.jpg</code><br />
                <code>A2_2.jpg</code><br />
                <code>A3_3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>セル名</td>
              <td>{ja.settings.cellNamingCellnameHint}</td>
              <td>
                <code>A1.jpg</code><br />
                <code>A2.jpg</code><br />
                <code>A3.jpg</code>
              </td>
            </tr>
            <tr>
              <td>シート連番</td>
              <td>
                XDTSのタイムライン順に番号を付け、本体と修正工程の番号を同じセル位置へそろえます。
              </td>
              <td>
                <code>A1.jpg</code><br />
                <code>A2.jpg</code><br />
                <code>A2_e.jpg</code><br />
                <code>A3.jpg</code>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.callout}>
        シート連番では、2番にだけある演出修正も<code>A2_e.jpg</code>になります。
        修正工程側で最初の1枚だからといって<code>A1_e.jpg</code>にはなりません。
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
              <td>XDTSフォルダ名</td>
              <td>付ける／付けない</td>
              <td><HintText text={ja.settings.xdtsTrackPrefixHint} /></td>
            </tr>
            <tr>
              <td>兼用カット</td>
              <td>ON／OFF</td>
              <td><HintText text={ja.export.sharedCutHint} /></td>
            </tr>
            <tr>
              <td>工程名の位置</td>
              <td>前／後ろ</td>
              <td><HintText text={ja.export.processSuffixPositionHint} /></td>
            </tr>
            <tr>
              <td>修正工程のフチ</td>
              <td>フチあり／なし</td>
              <td><HintText text={ja.export.revisionBorderHint} /></td>
            </tr>
            <tr>
              <td>出力する修正工程</td>
              <td>工程チップ／自動マーク</td>
              <td>
                青いチップの工程だけを書き出します。全ON／全OFFでまとめて切り替えられます。
                本体セルの出力には影響しません。
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className={styles.callout}>
        現在のファイル名は「出力例」に表示されます。設定を変えたら、出力例と出力プレビューの
        ファイル名・画像を確認してください。
      </div>
    </>
  )
}
