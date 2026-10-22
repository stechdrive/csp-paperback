# テストの保証範囲と実行方法

テストは、入力から出力までの契約、合成画像、利用者の操作を分担して検証する。
件数やカバレッジは検証量の目安であり、CSPとの完全互換や全端末での動作保証ではない。
コマンドと閾値の定義は [package.json](../package.json)、[Vitest設定](../vite.config.ts)、
[Playwright設定](../playwright.config.ts)を正とする。

## 何を保証するか

| 対象 | 主なテスト・実行環境 | 成功したときに言えること／限界 |
|---|---|---|
| 入力の解析・組み合わせ | [CLIP解析](../src/test/engine/clip-import.test.ts)、[プロジェクト読込](../src/test/utils/project-loader.test.ts)、[CLIP状態統合](../src/test/store/clip-slice.test.ts) | 検証素材の階層・タイムライン・PSD照合を保ち、不正入力や不一致で既存文書を壊さない。未知のCLIP構造すべてを網羅するものではない。 |
| 工程・セル・出力名 | [抽出](../src/test/engine/cell-extractor.test.ts)、[出力計画](../src/test/utils/output-plan.test.ts)、[名前](../src/test/utils/naming.test.ts)、[除外](../src/test/utils/archive-output.test.ts) | コンテナの不透明度、工程の照合、表示／非表示、衝突名、仮想セルの対象をモデル上で判定する。Canvasモックを使うテストは画素を保証しない。 |
| 合成・マスク・描画位置 | [合成の実画素](../src/test/engine/compositor.test.ts)、[マスク](../src/test/engine/mask-clipping-pixel.test.ts)、[c001画像](../src/test/engine/c001-golden-image.test.ts) | Node上の実Canvasで背景、不透明度、乗算、重なり、クリッピング、入力3経路の画像を比較する。ブラウザ独自の描画差は別のE2Eで確認する。 |
| CLIP固有の描画 | [効果](../src/test/engine/clip-effects.test.ts)、[レイヤーカラー](../src/test/engine/clip-layer-color.test.ts)、[ベクター](../src/test/engine/clip-vector-native.test.ts) | 保存したCSP参照画像と合成データの範囲を検証する。水彩境界・ブラシなどの近似を完全一致と扱わない。詳細は[CLIP対応範囲](clip-import.md)。 |
| 編集状態・保存設定・Undo | [履歴](../src/test/store/history-slice.test.ts)、[出力ゲート](../src/test/store/output-gate.test.ts)、[別名](../src/test/store/output-alias.test.ts)、[永続設定](../src/test/store/persisted-output-settings.test.ts) | 状態遷移、出力IDの維持、Undo/Redo、文書切替時に保持／初期化する設定を確認する。DOM側の操作はE2Eが補う。 |
| 出力データ・保存処理 | [ZIP](../src/test/utils/zip-builder.test.ts)、[遅延出力](../src/test/utils/lazy-export.test.ts)、[ネイティブ保存](../src/test/utils/zip-native-save.test.ts) | 実ZIP内の名前・拡張子・衝突・パス、進捗、キャンセル・失敗時の後処理、逐次描画を確認する。OSのファイルAPIをモックしたテストは実ディスクや権限ダイアログを保証しない。 |
| 実際に保存する画像 | [ブラウザのPNG比較](../e2e/export-golden.spec.ts) | Webビルドを読み込み、UIで設定し、ZIPを保存・展開して全PNGの名前・枚数・寸法・画素を比較する。CLIP、CLIP＋PSD、PSD＋XDTS、サンプルの仮想セルを通す。 |
| 操作・表示・復帰 | [別名編集](../e2e/output-alias.spec.ts)、[出力操作](../e2e/output-gate.spec.ts)、[重なるUI](../e2e/overlay-interactions.spec.ts)、[プレビュー](../e2e/output-board.spec.ts) | ChromiumのDOM、フォーカス、タッチ模擬、選択、表示／非表示、Undo、検索、ズーム、WebGL喪失・Canvas復帰を確認する。スクリーンショットの保存だけでは見た目の正しさを自動判定しない。 |
| 資源量・大量出力 | [レンダー待ち行列](../src/test/utils/output-render-queue.test.ts)、[ストリーミング](../src/test/utils/quick-export-streaming.test.ts)、[大量表示](../e2e/output-board.spec.ts)、[画素倍率](../e2e/preview-pixels.spec.ts) | キャッシュ上限、描画回数、逐次処理、全件アクセス、表示面積を超えないCanvasを検証する。アプリ全体の実メモリ使用量やすべてのGPUでの速度測定ではない。 |
| 公開処理 | [公開スクリプト](../scripts/test-deploy-pages.mjs) | 一時ローカルGitリポジトリで、正確なバイト列・履歴・変更なし・拒否時の保護を検証する。実GitHubへの公開成功や公開済み配布物の動作は別の確認が必要。 |

## 変更に応じた実行

| 変更 | 最初に行う検証 | 追加する条件 |
|---|---|---|
| 純粋な判定・名前・状態 | `npm run test:run -- <関連ファイル>`、`npm run typecheck` | UI操作や保存結果まで変わる場合は対応するE2Eも実行する。 |
| 読み込み・合成・出力 | 関連する解析・画像・出力テスト | `npm run test:e2e -- e2e/export-golden.spec.ts e2e/clip-import.spec.ts`。新しい描画仕様には対応する参照画像を追加する。 |
| UI、CSS、フォーカス、タッチ | 関連するコンポーネントテストとE2E | jsdomには実レイアウトがない。寸法・画素・フォーカス・ポインター動作はブラウザで検証する。 |
| パーサー・Canvas・テスト基盤の依存や設定 | `npm run check:ci` | OS、フォント、ブラウザの差に関係する場合は対象環境でも確認する。 |
| 文書だけ | 記述とリンクの確認 | アプリの全テストやビルドは不要。 |

- `npm run test:run -- <ファイル>` は関連テストだけを終了する形で実行する。`test` と `test:ui` は対話用。
- `npm run typecheck` はアプリ、Vitest、E2Eとその補助コードを型検査する。Playwright自身は型検査を行わない。
- `npm run test:e2e -- <spec>` はWebビルドを作ってからテストする。
- 同じソース・依存・設定のWebビルドが既に成功していれば `npm run test:e2e:built -- <spec>` で再ビルドを省ける。古い `dist` やTauri用の相対baseビルドを使わない。
- `npm run check` はlint、公開スクリプト、全Vitest、型検査を含むWebビルド。`npm run check:ci` はカバレッジと全E2Eも含み、Webビルドは一度だけ行う。
- リリース時はこれに配布用Tauriビルド、成果物監査、追跡ファイル・秘密情報の検査、必要な実機・公開物の確認を加える。既に同一条件で成功した検証は再利用する。

E2EはローカルでもCIでもビルド済みWeb版のpreviewを使う。別のdevサーバーや古いpreviewへ
誤接続しないよう、起動済みサーバーの自動再利用はしない。ポート使用中は対象を確認してから再実行する。
現時点ではChromiumを対象とし、大きな画像を扱うため1 workerを維持する。並列化や分割は実行時間と
ピーク資源量を測ってから判断する。

## テストを追加・修正するときの基準

1. テスト名に対応する結果を検査する。「安全なZIP」ならZIP内のパス、「乗算」なら合成画素、
   「全件出力」なら名前・枚数を検査する。例外が出なかったことだけで代用しない。
2. 判定ロジックをテスト内で書き直さず、製品の入口へ入力して結果を確かめる。
   期待値は仕様から定め、製品関数で作った値だけを同じ関数と比較しない。
3. 外部境界のモックは使ってよいが、モックした処理の正しさは保証に含めない。
   `src/test/setup.ts` のCanvas、ResizeObserver、dialogは模擬実装。
   描画テストは実Canvas、レイアウトやnative dialogの操作はブラウザへ置く。
4. 状態共有のあるテストは [resetTestStore](../src/test/helpers/store-reset.ts) を使い、
   永続設定・タイマー・spy・globalを復元する。標準コマンドは固定seedで順序をシャッフルする。
   順序依存を疑うときは `npm run test:run -- <対象> --sequence.seed=別の整数` で切り分ける。
5. E2Eは [共通fixture](../e2e/fixtures.ts) から `test` と `expect` を読み込む。
   各シナリオの未処理例外も自動で失敗にし、添付する。待機は利用者に見える状態や
   `aria-busy`、イベント、再試行付きassertionに合わせる。固定時間を使うのは、
   ツールチップの非表示猶予など「一定時間後にも維持されること」が検証対象の場合に限る。
6. 不具合には、変更前の実装で失敗する小さな回帰テストを足す。同じ保証を重ねるためだけの
   E2Eや、コンソールへ一覧を出すだけのテストは増やさない。

## 基準画像の扱い

ヘルプに載せるUIを変更したときは `npm run help:capture` で `public/help/` の6画像と
`helpScreenshots.json` の寸法・赤枠の座標・ハッシュを一緒に更新する。現行ソースと内蔵サンプルから撮影し、
PCの出力一覧と素材ツリーが横並びであることも検査する。更新後はヘルプ内で各画像と赤枠を目視確認する。
ハッシュを画像URLへ付け、更新前の画像キャッシュが残ることを防ぐ。
レイヤーの操作例は本体の行・ボタン表示を共用し、指定前・指定中・解除後を実際の素材ツリーと比較する。
説明用の操作が読み込み中の作品やUndo履歴へ反映されないことも確認する。

- `testdata/golden` はc001の基準画像。既存の命名設定に合わせて透過PNG・4桁・
  シート合わせ・修正ラベルなしで比較する。基準と出力を一緒に自動更新しない。
- `testdata/collision` と `testdata/context-pruning` は、宣言したレイヤーと期待ラベルから
  専用スクリプトで生成した合成データ。CSPの手動出力そのものとは区別する。
- [レイヤーカラー](../testdata/layer-color/README.md)、[境界効果](../testdata/clip-effects/README.md)、
  [ベクターの検証範囲](clip-import.md#ベクターの近似と検証範囲)にはCSP参照の出自・条件・許容範囲を記録している。
- 透過PNGはアルファと黒・白背景へ合成したRGBを画素単位で比較する。
  比較規則は[合成エンジンの検証基準](compositing-engine.md#検証の基準)を参照。
  依存更新で差が出ても、期待画像や許容幅を先に変更して通さない。

## カバレッジと失敗の記録

VitestカバレッジはNode/jsdomで実行した範囲だけを集計する。ブラウザで検証するWorker、
WebGL、レイアウトなどが低い値でも、それだけで未検証とは判定できない。
全体の下限に加え、合成エンジン・ストア・CLIP解析には領域別の下限を設定し、
別領域のテスト増加で主要処理の後退が隠れにくくしている。閾値は退行検知であり品質目標そのものではない。

- `coverage/coverage-summary.json` と `coverage/index.html` で領域ごとの実行範囲を確認する。
- `playwright-report/index.html` と `test-results/results.json` で所要時間・失敗・再試行を確認する。
  失敗時のtraceや基準／出力画像を添付し、CIとリリースのquality gateの両方で保存する。
- 既存のNode画像比較も、不一致時の基準画像と実画像を診断用フォルダへ出す。
- CIはE2Eを一度再試行するが、再試行だけ成功したテストもquality gateを失敗にする。
  リトライで問題を隠さず、原因を確認する。通常CIは同じブランチの古い実行を取り消し、
  リリースはタグを対象とする独立したquality gateを維持する。

## 自動テストでまだ保証していないこと

- Tauri実機のWebView、Explorerからの実ドラッグ、OSの保存権限・ダイアログ、起動引数からの実書き出し。
  ブラウザのクイック書き出しテストはTauri IPCを模擬しており、Rust側の動作確認ではない。
- macOS実機、Firefox、Safari/WebKitの実操作。Chromiumのタッチ模擬は実端末の代用にならない。
- 未収録のCSP素材、特殊ブラシ、極端な大容量文書、長時間操作中の実プロセスメモリ。
- GitHubに公開されたファイルとローカル成果物の同一性、公開URL上の実動作。

これらは対象の実装や対応環境を変更したときに、実機受入や新しい小さな参照素材で補う。
次に常設する検証は、実際の不具合頻度と影響に基づいて選ぶ。

実行環境の設計根拠: [Playwrightの型検査](https://playwright.dev/docs/test-typescript)、
[Webサーバー管理](https://playwright.dev/docs/test-webserver)、
[Vitestのカバレッジ設定](https://vitest.dev/config/coverage)。
