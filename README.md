# CSP Paperback

**English** | [日本語](#日本語)

---

## English

A browser-based tool for exporting composited animation cell images from Clip Studio Paint.

**→ [Open the app](https://stechdrive.github.io/csp-paperback/)**

### The Problem

CSP's animation export is designed around individual cels. When correction layers (layout, director's notes, animation supervisor's notes) are nested inside a cel folder — the natural structure for animation production — CSP cannot export each process independently. Work-in-progress opacity settings also bleed into the output.

CSP Paperback reads CLIP and exports artwork per process and per cel, ready for compositing. Add a corresponding CSP-exported PSD when you need CSP’s rasterization. The existing PSD + XDTS workflow remains available.

### What You Can Do

**Load your project**
- Save and open your CLIP. PSD and XDTS export are not required
- CLIP supplies native animation-folder identities, cel timing and available artwork; select among multiple timelines in the app
- Saved text pixels take priority. When unavailable, supported text attributes are rendered with browser fonts so exports can continue
- Optionally add a layered PSD exported from the same saved state to use CSP’s raster images and masks, preserving marks and virtual cels
- Camera and animated transforms are intentionally not applied: this app exports the original materials for compositing
- The existing PSD + `.xdts` workflow remains available via *File > Export Animation > Export Timeline Information*
- Open the app and drop the files to load them

**Composite correctly**
- Animation folders are read directly from CLIP, detected from XDTS data, or marked manually
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
- CLIP/PSD/XDTS files, settings, and generated images are not uploaded
- The desktop app contacts GitHub Releases only when the user manually checks for updates
- Folder export writes generated images into a user-selected folder; browser permission prompts are for that local write access

### Supported Files

| File | Purpose |
|------|---------|
| `.clip` | Default input: native structure, timelines and supported artwork. See the rendering limits below. |
| `.psd` | Layered PSD exported from the same CLIP state in CSP. Optional with CLIP; required for the PSD + XDTS workflow. |
| `.xdts` | Legacy PSD timeline input. Not required with CLIP; CLIP timing takes precedence when both are supplied. |
| `.json` | Optional. Shared process table and archive exclusion settings exported from the settings dialog. |

CLIP-only rendering is best effort: saved rasters, basic text fallback, image-material placement, solid borders, fills, gradients, additional blend modes, and inversion/threshold corrections are supported. Brush-specific vectors, drawing layer colors and full CSP text layout remain limited. See [CLIP import](docs/clip-import.md) for details.

### Desktop App

Desktop builds are available from [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases).

---

## 日本語

Clip Studio Paint（CSP）のアニメーションセル書き出しを補完する、ブラウザで動くセルの画像書き出しツールです。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

**デスクトップ版（Windows EXEなど）** は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。
ブラウザ版と同じ合成・書き出し機能に加えて、EXEへCLIPをドロップするクイック書き出しが使えます。対応PSDの追加、従来のPSD＋XDTSにも対応します。

### 何のためのツールか

CSPのアニメーションセル書き出しは、セル単体の出力が前提です。演出修正・作監修正など複数の工程をセルフォルダ内にまとめた構造では、工程ごとの独立した書き出しが自動化できません。また、作業中の半透明設定がそのまま出力に影響するという問題もありました。

CSP PaperbackはCLIPを読み込み、工程ごと・セルごとの撮影前素材を一括書き出しします。純正の描画結果を使いたい場合は対応PSDを追加できます。従来のPSD＋XDTSも利用できます。

### できること

**プロジェクトの読み込み**
- CLIPを保存して開く。PSDやXDTSの書き出しは不要
- CLIPからアニメーションフォルダの識別情報、セル指定、対応する素材画像を取得。複数タイムラインも選択可能
- テキストは保存済み画像を優先し、画像がない場合も読み取れる文字・書式と利用可能なフォントで描画を継続
- 純正描画を使いたい場合は、同じ保存状態からCSPの「複製を保存」で書き出したレイヤー付きPSDを追加。マーク・仮想セルは保持
- カメラ・変形アニメーションは意図的に適用せず、AEなどで撮影する前の素材を出力
- 従来のPSD＋XDTSも利用可能。XDTSは *ファイル＞アニメーション書き出し＞タイムシート情報から出力* で書き出す
- アプリを開き、ファイルをドロップして読み込む

**正しい合成順序**
- アニメーションフォルダはCLIPから直接取得、XDTSデータから自動検出、またはUI上で手動指定
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
- CLIPをEXEまたはショートカットへドロップすると、自動で読み込みから書き出しまで実行。対応PSDも一緒に指定可能
- CLIPと同じフォルダに、CLIP名を元にした出力フォルダを作成
- 従来のPSD＋XDTS同時ドロップも維持。この場合はXDTSと同じ場所へPSD名で出力
- 通常起動時の中央ペイン上部にある「書き出し設定」は自動保存され、通常のファイル読み込みとクイック書き出しで共通して使用
- カットごとに手動で★や🎬を付ける確認工程はないため、`_` 命名や工程フォルダリストで運用をそろえておく用途向け

**工程フォルダによる自動アニメーションフォルダ化**
- `_` で始まるフォルダの直下に工程テーブル登録名のフォルダ（`_e`、`_s`など）があると、その `_` フォルダを自動的にアニメーションフォルダとして扱う
- 作画マンの背景原図と演出修正を、手動指定なしで別々のファイルとして書き出せる
- `_` フォルダがネストしている場合は内側を優先（CSPの仕様でアニメーションフォルダは入れ子にならないため）
- 自動アニメ化されたフォルダ配下のセル名は、連番ではなく直下のフォルダ名を採用（初期設定では `_BGBG1.jpg`、区切りを `_ あり` にすると `_BG_BG1.jpg`）

**書き出し**
- 各セルの合成結果を書き出し前にプレビューで確認できる
- 全セルをZIPまたはフォルダツリーで一括書き出し（JPEG / PNG・透明対応）
- ファイル命名：連番、連番＋セル名、CSPのセル名、シート連番。初期設定はシート連番・自動桁数（最低1桁）・フォルダ名との区切りなし
- シート連番は、タイムシート上の同じ位置にある本体と修正工程の番号をそろえる（例：2番だけ演出修正がある場合 `A2.jpg` と `A2_e.jpg`）
- CSPのセル名を使う場合は、アニメーションフォルダ名を付けるか選択可能。セル名が `1` なら付ける、`A1` のようにフォルダ名まで含むなら付けない
- 工程フォルダリストで修正工程名のサフィックスを設定して書き出し（例：`_en`、`_lo`）。サフィックスは入力した文字をそのまま使用
- 「修正工程」を「フチあり」にすると、工程別の出力画像へ工程ごとの指定色で内側70pxの確認フチを乗算・不透明度80%で合成。色は設定の工程フォルダリストからカラーピッカー・RGB・HEXで変更可能

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z で操作を取り消し・やり直せる（マーク・仮想セット・表示切替・設定など全操作対応）

**設定の永続化**
- 出力名、連番、工程フォルダリスト（フチ色を含む）、自動マークするフォルダ名、除外設定はローカルストレージに保存
- スタジオ内で共有したい設定は設定ダイアログからJSONで書き出し・読み込み可能
- アカウント不要・サーバー不要。すべてブラウザ内で完結し、データは外部に送信されない

**通信とファイルアクセス**
- CLIP/PSD/XDTS、設定内容、生成画像は外部サーバーへ送信しません
- デスクトップ版は、ユーザーが手動で更新確認した時だけ GitHub Releases の最新情報を確認します
- フォルダ書き出し時のブラウザ権限表示は、選択したローカルフォルダへ生成画像を書き込むためのものです

### 対応ファイル

| ファイル | 用途 |
|---------|------|
| `.clip` | 標準の入力。レイヤー構造、タイムライン、対応する素材画像を取得。 |
| `.psd` | 同じCLIPの保存状態からCSPで書き出したレイヤー付きPSD。CLIP併用時は任意、PSD＋XDTS経路では必須。 |
| `.xdts` | 従来のPSD用タイムライン入力。CLIP使用時は不要で、両方指定された場合はCLIPを優先。 |
| `.json` | 任意。設定ダイアログから書き出した工程テーブルとアーカイブ除外設定。 |

CLIP対応範囲、組み合わせの条件、同梱サンプルの検証結果は[CLIP読み込み](docs/clip-import.md)を参照してください。

### デスクトップアプリ

デスクトップ版は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。

- WindowsではReleasesのAssetsから `csp-paperback.exe` を取得して起動
- EXEまたはショートカットへCLIPをドロップするとクイック書き出し。対応PSD、従来のPSD＋XDTSも利用可能
- ブラウザの保存ダイアログを使わず、ローカルフォルダへ直接書き出し可能
- Web版と同じく、CLIP/PSD/XDTSの中身を外部サーバーへ送信しません

---

## License

MIT License — © stechdrive
See [LICENSE](LICENSE) for details.
