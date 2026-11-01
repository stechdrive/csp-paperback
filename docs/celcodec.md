# celcodecによるCLIP形式処理

CLIPの形式処理はcelcodec 0.3.1の公開APIへ集約する。コンテナ・SQLite・階層・保存属性・媒体・タイムライン・素材復元は文書セッションが担当し、Paperbackは不変の文書ビューをUUIDで参照して表示用モデルへ投影する。ライブラリ内部ファイルの直接importや、形式処理の再実装は行わない。

## 固定した同梱パッケージ

- 版: **0.3.1**
- コミット: `bce2530ab99da5acde531da8d95200e405d847f7`（`fix: restore sparse materials on large canvases (0.3.1)`）
- 同梱ファイル: `vendor/celcodec-0.3.1.tgz`
- SHA-256: `76b60bc93043fa3bf831fa8f307ee529cee8bba68ec1f4d663aa35e8b60db115`

検証済みtarballを無変更で同梱し、package-lockのintegrityで固定する。このリポジトリだけをcloneして `npm ci` でインストールでき、隣接checkoutや絶対パス依存は不要。198ファイルの許可リスト、ライセンス、ローカルパス・秘密情報の検査を行い、唯一のCLIPが監査済み空seedであることと、そのSHA-256 `6fb3efa8066af90b2d0e042ddc3d2aee7572691e5cc658f89cdb02467e377a82` を照合した。空seedの出自はパッケージ内 `assets/README.md` に保持する。実制作素材・開発設定・ソースマップは同梱しない。

## 形式処理とアプリの責務

`openDocument` のセッションから `readLayerProperties`、`readTimeline`、`readKeyframes`、`decodeLayer` を呼ぶ。素材は明示的に `source: 'original'`、`budget: 'cropped'`、復元画素384 MiB上限で取得する。元画像が必要な素材に現在フレームの保存画像を代用せず、フォルダー／動画の保存合成画像と子素材を二重合成しない。空ベクターと欠落・破損・未対応の区別もライブラリ診断に従う。

単一素材のCanvas描画・効果、ネイティブ合成式、色調補正は公開 `celcodec/canvas`・`celcodec/render` APIを使う。素材の選択と重ね順、工程分離、出力計画・名前、仮想セル、PSD照合・補完、UI・store・履歴はPaperbackが担当する。Canvasの確保・解放、WASM・フォントの初期化もアプリの責務である。

構造フォルダーの出力不透明度100%はアプリの合成モデルへ適用し、CLIPに保存された不透明度やライブラリの文書ビューを書き換えない。セルタイミングは反映するが、独立した作画素材を出力するためカメラ・変形アニメーションは適用しない。これは一時的な出力方針で、CLIP内のカメラ表示やキーフレーム設定を変更する操作ではない。

タイムラインの開始・終了・セル位置は負数と小数を保持する。セル公開APIとキーフレーム公開APIから排他的な露出終了を取得する。整数フレームへのサンプリングはシークバー等の表示境界だけで行う。

## 所有権と診断

メインスレッドから入力ArrayBufferの所有権をWorkerへtransferし、Workerはその存続中だけセッションへborrowする。Worker外の解析入口は既定のcopyを使う。遅延セッションは圧縮入力とSQLiteを保持し、復元画素は要求ごとに独立したバッファとしてメインスレッドへtransferする。使用済みの画素は素材キャッシュの既存ルールで解放・再生成する。

通常の文書切替、PSD差替え、読み込み失敗、タイムアウト、AbortSignalによる中止ではWorkerをterminateしてセッションとWASMのヒープをまとめて解放する。Worker内の明示disposeはセッションを閉じ、待機中の古い要求を無効化する。一括解析は成功・失敗のいずれでもfinallyでdisposeする。文書の再読込に以前の画素やセッションを流用しない。

診断はcode・kind・data・layerIdを保持し、日本語の案内へ変換する。資源不足は再試行可能な `ImageResourceError`、キャンセルは `AbortError` に変換し、画像欠落へ置き換えない。例外メッセージからCLIP形式や失敗原因を推測しない。

## 大判文書の対応と残る制約

CSPで有効な寸法と、実際に確保する画素・Canvasのメモリ予算を分ける。5万pxという一辺の長さだけで文書を拒否しない。0.3.0で50,000×50,000px内の1px素材が `INVALID_IMAGE_DIMENSIONS` になる問題を再現し、公開APIを維持して修正された0.3.1を採用した。

素材サイズが不明な初回は、文書面積による一律の予約を行わず、同時保持可能な残り容量をWorkerへ渡す。復元前の画素予算は384 MiB以下のまま、実際の画像・マスクの累積量で検査する。Canvas化した後は実寸を素材キャッシュへ記録し、次回以降の見積もりに使う。キャッシュ・同時作業・描画の既存上限は緩和しない。

用紙なしの50,000×50,000px文書内で、1pxのラスターを遅延復元し、32×32pxの部分領域に正しい色・位置・不透明度で合成できることを[統合テスト](../src/test/engine/clip-large-document.test.ts)で確認した。Workerでも4 bytes予算で復元し、3 bytesなら構造化された資源不足を返す。50,000×64px文書のメタデータと素材復元も確認する。

全面を塗る用紙・塗り・グラデーション、広い復元矩形、元の全矩形が必要な変形画像、ベクターの描き起こしなどは、引き続きライブラリの画素・描画予算を受ける。とくに用紙ありの5万px四方は用紙だけでも復元予算を超え、疎なラスターだけの文書と同じ保証にはならない。用紙を勝手に消したり、失敗を透明画像へ置き換えたりしない。

またPaperbackの実書き出しは原寸Canvasを使い、実行環境のCanvas寸法と画像予算の制約を受ける。大判文書を最後まで処理するには、領域ごとの素材復元・合成・画像エンコードを接続する必要がある。メタデータ・疎な素材・部分合成の成功を、大判の全画素出力の成功とは扱わない。ライブラリ側の不足をアプリ独自CLIPデコーダーで回避しない。

## 統合の検証根拠

ライブラリ単体の検証とPaperbackの統合検証は区別する。0.3.0の2,019テスト・境界監査312条件・複合18ケース・CSP往復検証、および0.3.1の2,039テスト・大判のNode／Chromium Worker consumerは提供側の記録であり、アプリ統合の成功件数に加算しない。

アプリでは[セッション回帰](../src/test/utils/clip-session.test.ts)、[Workerプロトコル](../src/test/utils/clip-worker.test.ts)、[クライアントの中止・所有権](../src/test/utils/clip-io.test.ts)、[実ブラウザーのセッション](../e2e/clip-session.spec.ts)を追加し、CLIP単独・CLIP＋PSD・PSD＋XDTSの既存goldenと出力規則を検証する。既存のCSP由来goldenは変更しない。

ベクター回帰はCSPで採取した元のストロークバイト（保存された間隔残量・乱数状態を含む）を使う。旧テストの座標だけの再構成では0.3.0の復元精度を検証できないためで、期待アルファ画像と許容幅は据え置く。採取元とSHA-256は[fixture](../src/test/fixtures/native-vector-goldens.json)に保持する。クレジットは[THIRD_PARTY_NOTICES.md](../public/THIRD_PARTY_NOTICES.md)を参照。

色調補正7種類は、提供側のCSP EX 5.1.5採取データから変更せず取り出した不透明カラーランプを、アプリのCanvas接続経由で照合する。[補正の画像テスト](../src/test/engine/clip-adjustment-native.test.ts)に出自・SHA-256・元の許容幅を保持する。

0.3.1接続時のPaperback側の検証結果（2026-11-01、Windows）:

| 検証 | 結果 |
|---|---|
| 移行前 `npm run test:run` | 122ファイル・1,133件成功 |
| `npm run lint` / `npm run test:deploy` | lint成功・公開スクリプトのローカルテスト13件成功 |
| `npm run test:coverage` | 126ファイル・1,156件成功、既定のカバレッジ基準を充足 |
| `npm run build` | TypeScript・Web用base `/csp-paperback/` のビルド成功 |
| Playwright（ビルド済みWeb） | 全132件成功。CLIP／CLIP＋PSD／PSD＋XDTSのPNG golden、仮想セル、Worker・WASM・解放を含む |
| `npm run audit:artifacts -- dist vendor/celcodec-0.3.1.tgz` | Web生成物とtarballのパス監査成功 |
| `npm run tauri:build` | base `./` のビルドとWindows portable EXE生成成功。build番号のみ既存フックで同期 |
| `npm run audit:artifacts -- dist --tauri` | Tauri用生成物とWindows EXEのパス監査成功 |

Playwrightは `npm run test:e2e:built -- e2e/clip-preview-controls.spec.ts e2e/clip-session.spec.ts` の4件と、`node node_modules/@playwright/test/cli.js test --grep-invert "clip-preview-controls|clip-session"` の残り128件に分けて実行した。同一のWebビルドで、成功済みケースを重ねて実行していない。追跡対象と追加ファイルは生成物のパス監査とは別に検査し、個人パス・秘密情報・非公開作業ファイルの混入がないことを確認した。

撮影用カメラとキーフレームを含むCSP採取fixtureでも、元画素・保存位置・マスクを使うPaperbackの出力を追加照合した。今回CSP実機の新たな操作・保存往復、デスクトップアプリの実機UI、macOSでのビルド・実機確認は行っていない。
