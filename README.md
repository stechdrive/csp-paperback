# CSP Paperback

**English** | [日本語](#日本語)

---

## English

A browser-based tool for exporting composited animation cell images from Clip Studio Paint.

**→ [Open the app](https://stechdrive.github.io/csp-paperback/)**

### The Problem

CSP's animation export is designed around individual cels. To get a finished composite — cel, background, and correction layers merged into a single image — productions typically had to split the work across multiple tracks or fold everything into the cel itself.

CSP Paperback solves this outside the workflow: load your PSD and XDTS, and export finished images per cel in bulk.

### What You Can Do

**Load your project**
- Export your CLIP file as PSD from CSP
- Optionally export the `.xdts` timeline file via *File > Export Animation > Export Timeline Information*
- Open the app and drop both files to load them

**Composite correctly**
- Animation folders are detected automatically from the XDTS data, or marked manually
- Context layers (backgrounds, overlays, layout guides) are split by position — layers above the animation folder composite on top of each cell; layers below composite underneath
- Blend modes are preserved exactly as authored in CSP

**Virtual Sets**
- Group any layers into a named "virtual set" and pin it to a specific insertion point in the layer tree
- Drag the set onto the layer panel to place it — an insertion line shows exactly where it lands
- Preview the composited result by clicking the set

**Mark individual layers**
- Toggle a mark on any layer to include it in the export outside of animation cells
- Supports automatic marking via `SMARK_` / `VSET_` marker layers embedded in the PSD

**Export**
- Preview each cell's composited output before exporting
- Export all cells as a ZIP archive (JPEG or PNG, with optional transparency)
- File naming: sequential numbers or original CSP cell names
- Per-process suffix support via a configurable process table (e.g. `_genga`, `_douga`)

**Persistence**
- All settings (marks, virtual sets, process table) are saved inside the PSD file as XMP metadata
- No account, no server — everything runs in the browser and nothing leaves your machine

### Supported Files

| File | Purpose |
|------|---------|
| `.psd` | Required. Your CLIP file exported as PSD from Clip Studio Paint. |
| `.xdts` | Optional. Timeline data exported via *File > Export Animation > Export Timeline Information*. Used for multi-track cell synchronisation. |

---

## 日本語

Clip Studio Paint（CSP）のアニメーションセル書き出しを補完する、ブラウザで動くセルの画像書き出しツールです。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

### 何のためのツールか

CSPのアニメーションセル書き出しは、セル単体の出力が前提です。背景や修正工程など複数のレイヤーを重ねた「1枚の完成画像」を得るには、トラックを工程ごとに分けるか、すべてをセル内に収めるかといった構造上の工夫が必要でした。

CSP Paperbackはその制約をPSDとXDTSを読み込むことでワークフロー外から解決し、セルごとの完成画像を一括書き出しします。

### できること

**プロジェクトの読み込み**
- CSPでCLIPファイルをPSD形式で書き出しておく
- 必要に応じて *ファイル＞アニメーション書き出し＞タイムシート情報から出力* でXDTSファイルも書き出しておく
- アプリを開き、PSDとXDTSをドロップして読み込む

**正しい合成順序**
- アニメーションフォルダはXDTSデータから自動検出、またはUI上で手動指定
- コンテキストレイヤー（背景・前景・レイアウト用紙など）はアニメーションフォルダとの位置関係で上下に分離して合成
- CSPで設定したブレンドモードをそのまま維持

**仮想セット**
- 任意のレイヤーをまとめて名前付きの「仮想セット」として登録し、レイヤーツリーの特定の位置に挿入できる
- セットのドラッグハンドルを右パネルにドロップすると挿入ラインが表示され、上・下のどちらに挿入するかを確認してから配置できる
- セットをクリックすると合成プレビューが表示される

**マーク機能**
- 任意のレイヤーにマークを付けて、アニメーションセルとは独立して書き出し対象に含める
- PSD内に埋め込んだ `SMARK_` / `VSET_` マーカーレイヤーによる自動マーク指定にも対応

**書き出し**
- 各セルの合成結果を書き出し前にプレビューで確認できる
- 全セルをZIPアーカイブで一括書き出し（JPEG / PNG・透明対応）
- ファイル命名：連番またはCSPのセル名
- プロセステーブルで修正工程名のサフィックスを設定して書き出し（例：`_genga`、`_douga`）

**設定の永続化**
- マーク・仮想セット・プロセステーブルなど、すべての設定をPSDファイルのXMPメタデータとして保存
- アカウント不要・サーバー不要。すべてブラウザ内で完結し、データは外部に送信されない

### 対応ファイル

| ファイル | 用途 |
|---------|------|
| `.psd` | 必須。CLIPファイルをPSD形式で書き出したもの。 |
| `.xdts` | 任意。*ファイル＞アニメーション書き出し＞タイムシート情報から出力*で書き出すタイムラインデータ。複数トラックのセル同期に使用。 |

---

## License

MIT License — © stechdrive
See [LICENSE](LICENSE) for details.
