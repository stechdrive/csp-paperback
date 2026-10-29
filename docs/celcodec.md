# celcodecによるCLIP形式処理

CLIPの形式処理はローカルのcelcodec 0.2.0へ集約した。セルや工程の規則、出力計画、UI、履歴、Worker・WASM・フォントの初期化はこのアプリが担当する。

三つのリポジトリを同じ親フォルダに配置し、celcodecで最初に `npm ci --ignore-scripts` と `npm run build` を実行する。その後、このリポジトリで `npm ci --ignore-scripts` を実行する。依存は相対file参照であり、固定した版のcelcodec作業ツリーを使用する。公開レジストリや外部Git remoteは設定しない。単独cloneのCI向け配布方式は公開を決める段階の課題とする。

## 残したアプリ処理

`src/utils/clip`の素材/BINC/timeline入口と単一素材Canvas/効果は薄いアダプターである。parserのアプリ型接続、工程分離、仮想セット、構造フォルダ100%、PSD照合・補完、出力計画はそのまま保持する。

原画素材の選択は `source: original`、crop後の累積予算384 MiB。診断codeを既存の日本語案内とImageResourceErrorへ変換し、PSD併用案内をライブラリへ持ち込まない。Canvas生成と解放は既存の資源管理へ接続する。

## 由来と検証

素材の元画像・マスクoffset、文字cache ID/変形後配置、用紙色の解釈は、celcodecに移した既存ネイティブ回帰で確認する。既存の近似・未対応診断は保持する。入力を直接変更せず、無編集保存と未対象データの保持を区別して検証する。

celcodecの単体画像・パッケージ検証とアプリの単体・ブラウザ検証は別記録である。クレジットはTHIRD_PARTY_NOTICES.mdに保持し、ライブラリ側のdocs/provenance.jsonが参照コミット・ファイルhashを記録する。

## 固定したローカル依存

celcodec **0.2.0**、コミット `25921e45622824994c7724abcdc5252bc1b0d58d`。
監査済みtarball SHA-256: `7b658887da5e7d610f271c163cffa1ce61ec4a01dd65c575e3ae1ceca77764e0`。
相対file依存は作業ツリーを参照するため、上記コミットをcheckoutしてbuildする。

2026-10-29の統合検証: 全体checkは1,074件、公開スクリプト5件、lint・型・Web buildが成功。CLIP関連ブラウザ14件成功。最終mask選択修正後は配置28件とWorker画像復元2件を再確認し、最終distのpath監査に成功。CSP実機・配布EXE更新・外部公開は実施していない。
