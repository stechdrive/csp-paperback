# CSP Paperback

**English** | [日本語](#日本語)

---

## English

A browser-based companion tool for Clip Studio Paint's animation cell export.

**→ [Open the app](https://stechdrive.github.io/csp-paperback/)**

### The Problem

CSP (Clip Studio Paint) handles simple animation exports well, but when your scene has a complex layer structure — multiple animation tracks, shared background/foreground elements, or layers that need to be composited in a specific order across every cell — getting a clean, correctly-composited image per cell takes significant manual work.

CSP Paperback automates that compositing step directly in your browser.

### What You Can Do

**Load your project**
- Export your CLIP file as PSD from CSP, then drop it here
- Optionally drop the `.xdts` timeline file (exported via *File > Export Animation > Export Timeline Information*) to sync cell selection across multiple animation tracks

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
- Multi-language suffix support via a configurable process table (e.g. `_en`, `_ja`)

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

Clip Studio Paint（CSP）のアニメーションセル書き出しを補完する、ブラウザで動くコンポジットツールです。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

### 何のためのツールか

Clip Studio Paint（クリップスタジオペイント、以下CSP）のアニメーション書き出しは、単純な構成であれば問題ありませんが、複数のアニメーショントラック・共有の背景・前景レイヤー・セルをまたいで正確に合成する必要があるレイヤーが混在する場面では、正しく合成された画像を1セルずつ得るために手作業が必要になります。

CSP Paperbackはそのコンポジット作業をブラウザ上で自動化します。

### できること

**プロジェクトの読み込み**
- CLIPファイルをPSD形式で書き出し、ここにドロップして読み込む
- `.xdts`タイムラインファイル（*ファイル＞アニメーション書き出し＞タイムシート情報から出力*）を同時に読み込むと、複数のアニメーショントラックのセル選択を同期できる

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
- 設定可能なプロセステーブルで多言語サフィックス（`_en`、`_ja` など）に対応

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
