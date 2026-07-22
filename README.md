# CSP Paperback

**English** | [日本語](#日本語)

---

## English

A browser-based tool for exporting composited animation cell images from Clip Studio Paint.

**→ [Open the app](https://stechdrive.github.io/csp-paperback/)**

### The Problem

CSP's animation export is designed around individual cels. When correction layers (layout, director's notes, animation supervisor's notes) are nested inside a cel folder — the natural structure for animation production — CSP cannot export each process independently. Work-in-progress opacity settings also bleed into the output.

CSP Paperback solves this outside the workflow: load your PSD and XDTS, and export finished images per process, per cel, in bulk.

### What You Can Do

**Load your project**
- Export your CLIP file as PSD from CSP
- Optionally export the `.xdts` timeline file via *File > Export Animation > Export Timeline Information*
- Open the app and drop the files to load them

**Composite correctly**
- Animation folders are detected automatically from the XDTS data, or marked manually
- Context layers (backgrounds, overlays, layout guides) are split by position — layers above the animation folder composite on top of each cell; layers below composite underneath
- Blend modes are preserved exactly as authored in CSP

**Virtual Cels**
- Group any layers into a named virtual cel and pin it to a specific insertion point in the layer tree
- Drag it onto the layer panel to place it — an insertion line shows exactly where it lands
- Preview the composited result by clicking the cel

**Export as Single**
- Toggle any layer to include it as a standalone export outside of animation cells
- Folders whose names start with `_`, or whose exact names are registered in the auto-mark settings, are detected automatically; `撮影指示` and `原図` are registered by default
- Individual layers can also be marked from the layer panel

**Auto-detect animation folders by process subfolders**
- When a `_`-prefixed folder contains a direct child folder whose name is registered in the process table (`_e`, `_s`, …), the parent is automatically treated as an animation folder
- Useful for emitting the animator's raw art and the director's revision layer as separate sheets without any manual marking
- Inner folder wins when multiple levels qualify (CSP never nests animation folders)
- Names of cells inside an auto-detected animation folder preserve their folder names (not sequence numbers), so material identity stays in the filename

**Export**
- Preview each cell's composited output before exporting
- Export all cells in bulk as either a ZIP archive or a folder tree (JPEG or PNG, with optional transparency)
- File naming: sequential numbers or original CSP cell names
- Per-process suffix support via a configurable process table (e.g. `_en`, `_lo`)

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z to undo or redo any editing operation (marks, virtual sets, visibility, settings)

**Persistence**
- Process table, auto-mark folder names, and exclusion settings are saved in local storage
- Export and import those shared settings as JSON from the settings dialog
- No account, no server — everything runs in the browser and nothing leaves your machine

**Privacy and file access**
- PSD/XDTS files, settings, and generated images are not uploaded
- The desktop app contacts GitHub Releases only when the user manually checks for updates
- Folder export writes generated images into a user-selected folder; browser permission prompts are for that local write access

### Supported Files

| File | Purpose |
|------|---------|
| `.psd` | Required. Your CLIP file exported as PSD from Clip Studio Paint. |
| `.xdts` | Optional. Timeline data exported via *File > Export Animation > Export Timeline Information*. Used for multi-track cell synchronisation. |
| `.json` | Optional. Shared process table and archive exclusion settings exported from the settings dialog. |

### Desktop App

Desktop builds are available from [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases).

---

## 日本語

Clip Studio Paint（CSP）のアニメーションセル書き出しを補完する、ブラウザで動くセルの画像書き出しツールです。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

**デスクトップ版（Windows EXEなど）** は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。
ブラウザ版と同じ合成・書き出し機能に加えて、EXEへPSD/XDTSの2ファイルをまとめてドロップするクイック書き出しが使えます。

### 何のためのツールか

CSPのアニメーションセル書き出しは、セル単体の出力が前提です。演出修正・作監修正など複数の工程をセルフォルダ内にまとめた構造では、工程ごとの独立した書き出しが自動化できません。また、作業中の半透明設定がそのまま出力に影響するという問題もありました。

CSP Paperbackはその制約をPSDとXDTSを読み込むことでワークフロー外から解決し、工程ごと・セルごとの完成画像を一括書き出しします。

### できること

**プロジェクトの読み込み**
- CSPでCLIPファイルをPSD形式で書き出しておく
- 必要に応じて *ファイル＞アニメーション書き出し＞タイムシート情報から出力* でXDTSを書き出す
- アプリを開き、ファイルをドロップして読み込む

**正しい合成順序**
- アニメーションフォルダはXDTSデータから自動検出、またはUI上で手動指定
- コンテキストレイヤー（背景・前景・レイアウト用紙など）はアニメーションフォルダとの位置関係で上下に分離して合成
- CSPで設定したブレンドモードをそのまま維持

**仮想セル**
- 任意のレイヤーをまとめて名前付きの仮想セルとして登録し、レイヤーツリーの特定の位置に挿入できる
- ドラッグハンドルを右パネルにドロップすると挿入ラインが表示され、上・下のどちらに挿入するかを確認してから配置できる
- 仮想セルをクリックすると合成プレビューが表示される

**単体書き出し**
- 任意のレイヤーを単体書き出し対象として指定し、アニメーションセルとは独立して書き出せる
- `_` で始まるフォルダ、または設定へ登録した名前と完全一致するフォルダは自動検出される（初期設定: `撮影指示`、`原図`）
- 任意のレイヤーは右パネルから個別にマークできる
- 単体書き出しにした素材はセル画像へ自動で混ざらず、背景原図・BOOK・撮影指示などを別ファイルとして出せる

**デスクトップ版クイック書き出し**
- PSDとXDTSを1つずつ同時に選択し、EXEまたはショートカットへまとめてドロップすると、自動で読み込みから書き出しまで実行
- PSDだけ、XDTSだけを先にドロップして、もう片方を待つ動作ではありません
- XDTSと同じフォルダに、PSD名を元にした出力フォルダを作成
- 通常起動時に保存されている出力形式・背景・フォルダ分け・出力対象設定を使用
- カットごとに手動で★や🎬を付ける確認工程はないため、`_` 命名や工程フォルダリストで運用をそろえておく用途向け

**工程フォルダによる自動アニメーションフォルダ化**
- `_` で始まるフォルダの直下に工程テーブル登録名のフォルダ（`_e`、`_s`など）があると、その `_` フォルダを自動的にアニメーションフォルダとして扱う
- 作画マンの背景原図と演出修正を、手動指定なしで別々のファイルとして書き出せる
- `_` フォルダがネストしている場合は内側を優先（CSPの仕様でアニメーションフォルダは入れ子にならないため）
- 自動アニメ化されたフォルダ配下のセル名は、連番ではなく直下のフォルダ名を採用（`_BG_BG1.jpg` のように素材分類情報が残る）

**書き出し**
- 各セルの合成結果を書き出し前にプレビューで確認できる
- 全セルをZIPまたはフォルダツリーで一括書き出し（JPEG / PNG・透明対応）
- ファイル命名：連番、連番＋セル名、CSPのセル名、シート連番
- シート連番は、タイムシート上の同じ位置にある本体と修正工程の番号をそろえる（例：2番だけ演出修正がある場合 `A_0002.jpg` と `A_0002_e.jpg`）
- プロセステーブルで修正工程名のサフィックスを設定して書き出し（例：`_en`、`_lo`）
- 「修正工程」をONにすると、工程別の出力画像へ工程ごとの指定色で内側70pxの確認フチを乗算・不透明度80%で合成。色は設定の工程フォルダリストから変更可能

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z で操作を取り消し・やり直せる（マーク・仮想セット・表示切替・設定など全操作対応）

**設定の永続化**
- 工程テーブル、自動マークするフォルダ名、除外設定はローカルストレージに保存
- スタジオ内で共有したい設定は設定ダイアログからJSONで書き出し・読み込み可能
- アカウント不要・サーバー不要。すべてブラウザ内で完結し、データは外部に送信されない

**通信とファイルアクセス**
- PSD/XDTS、設定内容、生成画像は外部サーバーへ送信しません
- デスクトップ版は、ユーザーが手動で更新確認した時だけ GitHub Releases の最新情報を確認します
- フォルダ書き出し時のブラウザ権限表示は、選択したローカルフォルダへ生成画像を書き込むためのものです

### 対応ファイル

| ファイル | 用途 |
|---------|------|
| `.psd` | 必須。CLIPファイルをPSD形式で書き出したもの。 |
| `.xdts` | 任意。*ファイル＞アニメーション書き出し＞タイムシート情報から出力*で書き出すタイムラインデータ。複数トラックのセル同期に使用。 |
| `.json` | 任意。設定ダイアログから書き出した工程テーブルとアーカイブ除外設定。 |

### デスクトップアプリ

デスクトップ版は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。

- WindowsではReleasesのAssetsから `csp-paperback.exe` を取得して起動
- EXEまたはショートカットへPSD/XDTSの2ファイルをまとめてドロップするとクイック書き出し
- ブラウザの保存ダイアログを使わず、ローカルフォルダへ直接書き出し可能
- Web版と同じく、PSD/XDTSの中身を外部サーバーへ送信しません

---

## License

MIT License — © stechdrive
See [LICENSE](LICENSE) for details.
