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
- Folders whose names start with `_` are detected automatically, and individual layers can be marked from the layer panel

**Export**
- Preview each cell's composited output before exporting
- Export all cells as a ZIP archive (JPEG or PNG, with optional transparency)
- File naming: sequential numbers or original CSP cell names
- Per-process suffix support via a configurable process table (e.g. `_en`, `_lo`)

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z to undo or redo any editing operation (marks, virtual sets, visibility, settings)

**Persistence**
- Process table and archive exclusion settings are saved in local storage
- Export and import those shared settings as JSON from the settings dialog
- No account, no server — everything runs in the browser and nothing leaves your machine

### Supported Files

| File | Purpose |
|------|---------|
| `.psd` | Required. Your CLIP file exported as PSD from Clip Studio Paint. |
| `.xdts` | Optional. Timeline data exported via *File > Export Animation > Export Timeline Information*. Used for multi-track cell synchronisation. |
| `.json` | Optional. Shared process table and archive exclusion settings exported from the settings dialog. |

---

## 日本語

Clip Studio Paint（CSP）のアニメーションセル書き出しを補完する、ブラウザで動くセルの画像書き出しツールです。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

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
- `_` で始まるフォルダは自動検出され、任意のレイヤーは右パネルから個別にマークできる

**書き出し**
- 各セルの合成結果を書き出し前にプレビューで確認できる
- 全セルをZIPアーカイブで一括書き出し（JPEG / PNG・透明対応）
- ファイル命名：連番またはCSPのセル名
- プロセステーブルで修正工程名のサフィックスを設定して書き出し（例：`_en`、`_lo`）

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z で操作を取り消し・やり直せる（マーク・仮想セット・表示切替・設定など全操作対応）

**設定の永続化**
- 工程テーブルとアーカイブ除外設定はローカルストレージに保存
- スタジオ内で共有したい設定は設定ダイアログからJSONで書き出し・読み込み可能
- アカウント不要・サーバー不要。すべてブラウザ内で完結し、データは外部に送信されない

### 対応ファイル

| ファイル | 用途 |
|---------|------|
| `.psd` | 必須。CLIPファイルをPSD形式で書き出したもの。 |
| `.xdts` | 任意。*ファイル＞アニメーション書き出し＞タイムシート情報から出力*で書き出すタイムラインデータ。複数トラックのセル同期に使用。 |
| `.json` | 任意。設定ダイアログから書き出した工程テーブルとアーカイブ除外設定。 |

---

## License

MIT License — © stechdrive
See [LICENSE](LICENSE) for details.
