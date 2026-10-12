# CSP Paperback

**English** | [日本語](#日本語)

---

## English

CSP Paperback exports artwork created in CLIP STUDIO PAINT as independent still images for Japanese animation production. Adapt material selection, layer combinations, and filenames to your studio's folder structure and production stages.

**→ [Open the app](https://stechdrive.github.io/csp-paperback/)**

### The Problem

CSP's standard animation cel export cannot handle every material combination used in production. A frame guide may need to appear on every cel, while background layouts, BOOK layers, and camera instructions need separate images. Animator artwork and director or animation supervisor corrections may also need separate files, even when stored inside the same cel folder.

CSP Paperback supports these workflows through configurable process names, standalone output rules, and virtual cels. The concept of “returning to paper” guides its compositing rules: working opacity on animation, cel, and process containers returns to 100%, while artwork opacity is preserved. The in-app help explains the rules with layer trees and output examples.

### Getting Started

1. In CSP, set layer visibility for the materials you want to export and save the CLIP file.
2. Drop the CLIP into the app, or select it with the open-file button.
3. Check the output previews and filenames, then export as ZIP or a folder.

To use CSP's rendered artwork, save a PSD from the same CLIP using **File > Save Duplicate > .psd (Photoshop Document)**. Keep layer visibility the same in both files. Open them together or add the PSD afterward; CLIP continues to supply the timeline and cel identities. See the [official save instructions](https://help.clip-studio.com/en-us/manual_en/210_file/Save_file.htm).

### What You Can Do

**Load your project**
- Save and open your CLIP to get started
- CLIP supplies native animation-folder identities, cel timing and available artwork; select among multiple timelines in the app
- Saved text pixels take priority. When unavailable, supported text attributes are rendered with browser fonts so exports can continue
- Optionally add a PSD saved from the same CLIP to use CSP's rendered images and masks, preserving marks and virtual cels
- Camera and animated transforms are intentionally not applied: this app exports the original materials for compositing
- Open the app and drop the files to load them

**Composite correctly**
- Animation folders are read directly from CLIP; additional folders can be marked manually
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
- Input files, settings, and generated images are not uploaded
- The desktop app contacts GitHub Releases only when the user manually checks for updates
- Folder export writes generated images into a user-selected folder; browser permission prompts are for that local write access

### Supported Files

| File | Purpose |
|------|---------|
| `.clip` | Default input: native structure, timelines and supported artwork. See the rendering limits below. |
| `.psd` | Optional. Use CSP's rendered artwork by saving a PSD from the same CLIP through Save Duplicate. |
| `.json` | Optional. Shared process table and archive exclusion settings exported from the settings dialog. |

### CLIP-only Rendering

- Raster layers, masks, image-material placement, layer colors (including folders), and solid borders are supported.
- Text is exported as an image using saved pixels or supported text settings. Fonts, vertical text, ruby, and other layout details may differ from CSP.
- Vector and 3D layers, tones, watercolor edges, and some color corrections may not render correctly from CLIP alone. Add a PSD to use CSP's rendered artwork for these materials.
- Exports continue with the supported content. Details for affected layers appear in the expandable rendering status in the app.

Camera and animated transforms are left unapplied so the original materials can be exported. For implementation details and sample verification, see [CLIP import](docs/clip-import.md).

### Desktop App

Desktop builds are available from [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases).

---

## 日本語

CSP Paperbackは、日本のアニメ制作で、CLIP STUDIO PAINTの作画データから必要な素材を独立した静止画として書き出すためのツールです。制作現場ごとのフォルダー構成や工程名に合わせて、素材の出し分けや組み合わせ、出力ファイル名を柔軟に設定できます。

**→ [アプリを開く](https://stechdrive.github.io/csp-paperback/)**

**デスクトップ版（Windows EXEなど）** は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。
ブラウザ版と同じ合成・書き出し機能に加えて、EXEへCLIPをドロップするクイック書き出しが使えます。対応するPSDも一緒に指定できます。

### 何のためのツールか

クリスタ標準のアニメーションセル書き出しでは、制作現場で必要な素材の出し分けや組み合わせを扱いきれません。たとえば、フレームは各セルへ重ね、背景原図・BOOK・撮影指示は別画像にしたい。セルフォルダー内にまとめた作画本体と演出・作監修正も、工程ごとに分けて書き出したい。そうした運用に対応するためのツールです。

工程名辞書、アンダースコアフォルダーなどの単体出力ルール、仮想セルを使って、現場のデータ構成に合わせた出力を設定できます。

「紙に戻す」は合成ルールの設計思想です。アニメーション・セル・工程フォルダーの作業用の薄表示は100%に戻し、描画内容の不透明度は尊重します。アプリ内ヘルプでは、具体的なレイヤー構成と出力例を使って説明しています。

### 使い始めるには

1. クリスタで、書き出したい素材が表示される状態にしてCLIPを保存します。
2. CLIPをアプリへドロップするか、「ファイルを開く」から選択します。
3. 出力プレビューとファイル名を確認し、「出力」からZIPまたはフォルダーへ書き出します。

クリスタの描画結果を使う場合は、同じCLIPから **［ファイル］→［複製を保存］→［.psd(Photoshopドキュメント)...］** でPSDを保存します。CLIPとPSDは、レイヤーの表示状態を合わせて保存してください。2つを一緒に読み込むことも、後からPSDを追加することもできます。タイムラインとセルの対応は引き続きCLIPから読み取ります。[クリスタ公式の保存手順](https://help.clip-studio.com/ja-jp/manual_jp/210_files/ファイルを保存する.htm)

### できること

**プロジェクトの読み込み**
- CLIPを保存して、そのまま開く
- CLIPからアニメーションフォルダの識別情報、セル指定、対応する素材画像を取得。複数タイムラインも選択可能
- テキストは保存済み画像を優先し、画像がない場合も読み取れる文字・書式と利用可能なフォントで描画を継続
- クリスタの描画結果を使いたい場合は、同じCLIPから「複製を保存」で作成したPSDを追加。マーク・仮想セルは保持
- カメラ・変形アニメーションは意図的に適用せず、AEなどで撮影する前の素材を出力
- アプリを開き、ファイルをドロップして読み込む

**正しい合成順序**
- アニメーションフォルダはCLIPから直接取得。追加で指定したいフォルダはUI上で手動指定可能
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
- 通常起動時の中央ペイン上部にある「書き出し設定」は自動保存され、通常のファイル読み込みとクイック書き出しで共通して使用
- カットごとに手動で★や🎬を付ける確認工程はないため、`_` 命名や工程フォルダリストで運用をそろえておく用途向け

**工程フォルダによる自動アニメーションフォルダ化**
- `_` で始まるフォルダの直下に工程テーブル登録名のフォルダ（`_e`、`_s`など）があると、その `_` フォルダを自動的にアニメーションフォルダとして扱う
- 作画マンの背景原図と演出修正を、手動指定なしで別々のファイルとして書き出せる
- `_` フォルダがネストしている場合は内側を優先（CSPの仕様でアニメーションフォルダは入れ子にならないため）
- 自動アニメ化されたフォルダ配下のセル名は、連番ではなく直下のフォルダ名を採用（初期設定では `_BG_BG1.jpg`、区切りを `なし` にすると `_BGBG1.jpg`）

**書き出し**
- 各セルの合成結果を書き出し前にプレビューで確認できる
- 全セルをZIPまたはフォルダツリーで一括書き出し（JPEG / PNG・透明対応）
- ファイル命名：連番、連番＋セル名、CSPのセル名、連番（シート合わせ）。初期設定はセル名・アニメーションフォルダ名を付ける・フォルダ名との区切りあり（`A_1.jpg`）。連番を選んだ場合の桁数は自動（最低1桁）
- 「セル名」はクリスタのセルのレイヤー名・レイヤーフォルダ名を使用。すでに付けた番号もそのまま使える（Aフォルダの `1` → `A_1.jpg`、または `ア` → `A_ア.jpg`）
- 「連番＋セル名」は、フォルダ内の順番で付けた番号と元のセル名を連結（Aフォルダの1番目が `ア` → `A_1_ア.jpg`）
- 「連番（シート合わせ）」は、クリスタのタイムラインで、作画と同じフレームから始まる修正に、作画と同じ番号を付ける。作画が3枚で2枚目だけ演出修正がある場合、修正が1枚だけでも作画に合わせて「2」で書き出す（作画 `A_2.jpg`／演出修正 `A_2_e.jpg`）
- 「セル名」では、ファイル名の先頭にアニメーションフォルダ名を付けるか選択可能（Aフォルダの `1` → ON: `A_1.jpg`／OFF: `1.jpg`）
- 工程フォルダリストで修正工程名のサフィックスを設定して書き出し（例：`_en`、`_lo`）。サフィックスは入力した文字をそのまま使用
- 「修正ラベル」をONにすると、修正画像へ指定色で内側70pxのフチを乗算・不透明度80%で合成。色は設定の工程フォルダリストから変更でき、設定横の小さな見本には作監の色を表示
- ファイル名に関わる設定と出力例をまとめ、操作中だけ下線で対応箇所を表示。説明の吹き出しは出力例を避けて配置
- 複数タイムラインのCLIPは読み込み時に「兼用カット」を自動ONにし、その後の手動変更を維持

**Undo / Redo**
- Ctrl+Z / Ctrl+Shift+Z で操作を取り消し・やり直せる（マーク・仮想セット・表示切替・設定など全操作対応）

**設定の永続化**
- 出力名、連番、工程フォルダリスト（フチ色を含む）、自動マークするフォルダ名、除外設定はローカルストレージに保存
- スタジオ内で共有したい設定は設定ダイアログからJSONで書き出し・読み込み可能
- アカウント不要・サーバー不要。すべてブラウザ内で完結し、データは外部に送信されない

**通信とファイルアクセス**
- 読み込んだファイル、設定内容、生成画像は外部サーバーへ送信しません
- デスクトップ版は、ユーザーが手動で更新確認した時だけ GitHub Releases の最新情報を確認します
- フォルダ書き出し時のブラウザ権限表示は、選択したローカルフォルダへ生成画像を書き込むためのものです

### 対応ファイル

| ファイル | 用途 |
|---------|------|
| `.clip` | 標準の入力。レイヤー構造、タイムライン、対応する素材画像を取得。 |
| `.psd` | 任意。同じCLIPから「複製を保存」で作成し、クリスタの描画結果を使用。 |
| `.json` | 任意。設定ダイアログから書き出した工程テーブルとアーカイブ除外設定。 |

### CLIPだけで使う場合の描画範囲

- ラスターレイヤー、マスク、画像素材の配置、レイヤーカラー（フォルダーへの適用を含む）、単色の境界線などに対応しています。
- テキストも画像として書き出します。フォントや縦書き・ルビなどは、クリスタと見た目が異なる場合があります。
- ベクター・3Dレイヤー、トーン・水彩境界・一部の色調補正などは、CLIPだけでは正しく再現できない場合があります。クリスタの描画結果を使う場合はPSDを追加してください。
- 一部の素材を再現できない場合も、対応できる範囲で書き出しを続けます。対象の詳細はアプリ内の「再現状況」で確認できます。

カメラ・変形アニメーションは適用せず、元の素材の状態で書き出します。実装仕様と同梱サンプルの検証結果は[CLIP読み込み](docs/clip-import.md)を参照してください。

### デスクトップアプリ

デスクトップ版は [GitHub Releases](https://github.com/stechdrive/csp-paperback/releases) からダウンロードできます。

- WindowsではReleasesのAssetsから `csp-paperback.exe` を取得して起動
- EXEまたはショートカットへCLIPをドロップするとクイック書き出し。対応するPSDも一緒に指定可能
- ブラウザの保存ダイアログを使わず、ローカルフォルダへ直接書き出し可能
- Web版と同じく、読み込んだファイルの中身を外部サーバーへ送信しません

---

## License

MIT License — © stechdrive
See [LICENSE](LICENSE) for details.
