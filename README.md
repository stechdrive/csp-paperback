# CSP Paperback

[日本語](#日本語) | [English](#english)

## 日本語

CSP Paperbackは、CLIP STUDIO PAINT（クリスタ）のアニメーションセル出力を補う、日本のアニメ制作向けのアプリです。CLIPのタイムラインとレイヤー構成を読み取り、作画素材を静止画としてまとめて書き出します。

[ブラウザで使う](https://stechdrive.github.io/csp-paperback/) ／ [Windows版をダウンロード](https://github.com/stechdrive/csp-paperback/releases)

### 原図・BOOK・撮影指示を、セル登録せずに書き出す

クリスタEXの「アニメーションセル出力」は、アニメーションフォルダ内のセルをまとめて静止画にできます。フォルダ外のレイヤーを各セルへ合成する設定もありますが、原図や撮影指示を独立した画像として一緒に出すには、それらもセルとして登録する必要があります。（[クリスタ公式マニュアル](https://help.clip-studio.com/ja-jp/manual_jp/600_animation/アニメーションを書き出す.htm)）

Paperbackでは、アニメーションしない素材をセルとして登録せずに、共通で合成する素材と別々に出す素材を分けて、一度に書き出せます。

| 素材 | 書き出し方 |
|---|---|
| タップ・フレーム枠 | 各セルや出力画像へ共通で合成 |
| 背景原図・BOOK | セルへ混ぜず、それぞれ別画像として出力 |
| 撮影指示 | 指示ごとに別画像として出力 |

個別に書き出す素材は、`_BG` のように先頭に `_` を付けたフォルダや、「個別に書き出すフォルダ名」に登録した名前で指定できます。読み込み後にアプリ上で個別に指定することもできます。

作業中は非表示にしている撮影指示などのフォルダも、読み込み時に表示する設定を使えば、そのまま書き出せます。書き出しのたびにクリスタで表示し直す必要はありません。

### 修正用のトラックを増やさず、作画と修正を別画像にする

アニメーションフォルダ内の各セルフォルダに、`_e`・`_s` など、設定に登録した工程名のフォルダを作ると、作画本体と修正を別々の画像として書き出せます。

```text
A                       アニメーションフォルダ
└─ 1                    セルのレイヤーフォルダ
   ├─ _s                作監修正
   ├─ _e                演出修正
   └─ 作画レイヤー
```

修正用のアニメーションフォルダやトラックを追加せず、作画と修正のタイミングを一つのトラックで管理できます。

### 工程ごとにファイル名を付けて書き出す

作画・演出・作監など、工程ごとのレイヤーフォルダにアニメーションフォルダを置く構成にも対応しています。

工程に応じて、ファイル名に `_e` や `_s` などを付けて書き出せます。出力名を区別するために、クリスタ側のフォルダ名やセル名を付け直す必要はありません。

連番で書き出す場合の例：

| 工程 | 出力ファイル名 |
|---|---|
| 作画 | `A_001.jpg` |
| 演出修正 | `A_001_e.jpg` |
| 作監修正 | `A_001_s.jpg` |

クリスタのセル名をそのまま使う方法と、連番を付ける方法を選べます。工程の文字を付ける位置や番号の桁数、区切り文字も設定できます。

工程ごとにトラックを分けている場合は、作画と同じコマから始まる修正を、作画と同じ番号で書き出すこともできます。

出力先は、アニメーションフォルダごとに分ける方法と、すべての画像を一つのフォルダにまとめる方法を選べます。

### 元のCLIPを変えずに、書き出し時の不透明度を調整する

作画作業中に見やすくするために調整した不透明度を、書き出しのためだけにクリスタで変更し直す必要はありません。アニメーション・セル・工程フォルダは、書き出し時に100%として扱います。

セル内の描画レイヤーなどは、元の不透明度を使うほか、出力プレビューを見ながら必要な濃さに調整できます。元のCLIPファイルは書き換えないので、作業しやすい状態のまま残せます。

### セルと原図を組み合わせた画像も追加する

「仮想セル」では、読み込んだセルや原図などを組み合わせて、追加の出力画像を作れます。例えば、背景原図にキャラクターのセルを重ねた確認用の画像を、個別の素材と一緒に書き出せます。

### 使い方

1. クリスタで、書き出したい描画レイヤーを表示してCLIPを保存します。
2. CSP PaperbackへCLIPをドロップします。タイムラインも直接読み込みます。
3. 工程名と書き出し設定を確認します。
4. 中央のタイル表示で書き出す画像を見渡し、ダブルクリックで１点ずつ確認します。ホイールでズーム、ドラッグで移動でき、もう一度ダブルクリックすると一覧へ戻ります。どちらの表示でも100%で原寸、さらに拡大すると元画像のドットを確認できます。必要な工程や素材を選んで一括出力します。

JPEG／PNG画像を、ZIPまたはフォルダへ保存できます。PNGは透明背景にも対応しています。

今回書き出さない画像は、一覧やタイルの出力切替ボタン、または各ペイン右上の≡メニューの「選択を出力から外す」でOFFにできます。OFFの画像には×が付き、「出力に戻す」と消えます。名前・工程サフィックス・見た目を変更してもOFFを保ち、元のレイヤー表示や書き出し設定は変えません。タイルでもCtrl／Shiftで複数選択でき、Shift＋ドラッグで範囲追加、Ctrl＋ドラッグで反転、Ctrl＋Shift＋ドラッグで範囲解除できます（MacはCtrlの代わりにCommand）。空白クリックやEsc、≡メニューの「選択を解除」で未選択に戻せます。

工程名はスタジオや作品によって異なります。初回は「工程フォルダリスト」の登録内容を確認し、使っているフォルダ名と出力ファイル名に付ける文字を設定してください。例えば「演出」に `_e`、「作監」に `_s` を対応させます。設定は保存でき、JSONファイルでスタッフや別の端末へ共有できます。

アプリ内のサンプルから、出力結果を試せます。詳しい操作と設定はアプリ内ヘルプで確認できます。

### ベクター・3Dの描画をクリスタに合わせる

クリスタの［環境設定］→［ファイル］で［バージョン互換情報の保存］を［保存する］に設定し、CLIPを保存し直してください。レイヤー単独の保存画像を取得できる場合は、その画像を使います。

画像を取得できないベクターは近似描画し、3Dは透明な画像として扱います。影響する出力行とレイヤー単体の警告マークから、対象素材と理由を確認できます。出力一覧の警告表示は問題がある場合だけ表示します。レイヤーカラー・境界線は独自処理、水彩境界は近似描画します。

CLIP・PSDの画像は必要なときに読み込み、キャッシュから解放した素材は再読み込みします。文書全体の展開画像が累計512 MiBに達しただけで、後続レイヤーを読み飛ばすことはありません。単一画像や同時使用メモリの制限は維持し、メモリ確保に失敗した出力は中止して再試行できるエラーを表示します。

通常レイヤーの描画をPSDから補うこともできます。同じ保存状態のCLIPから、次の操作でPSDを保存して一緒に読み込んでください。フォルダの効果はPSDにも含まれない場合があります。

**［ファイル］→［複製を保存］→［.psd(Photoshopドキュメント)...］**

CLIPとPSDは、レイヤーの表示状態を合わせて保存してください。後からPSDを追加することもできます。

カメラ・変形アニメーションは適用せず、撮影前の素材として書き出します。描画範囲と制限の詳細は[CLIP読み込み](docs/clip-import.md)を参照してください。

### Windows版は、複数カットをまとめて自動出力

あらかじめ設定を保存しておけば、複数のCLIPをEXEやショートカットへまとめてドロップして自動出力できます。必要なPSDも一緒に指定できます。

PSDを併用するカットは、同じフォルダにある同名のCLIPとPSDを一緒に指定します。例えば `c001.clip`、`c001.psd`、`c002.clip` を渡すと、c001はPSD併用、c002はCLIP単独で処理します。

各CLIPの隣に出力フォルダを作り、カットごとに順番に書き出します。既存の出力フォルダは上書きせず、末尾に番号を付けます。途中で失敗したカットがあっても残りを続け、結果を一覧で確認できます。

### 作品データは外部へ送信しません

ファイルの読み込みと画像生成は、ブラウザ内または端末内で行います。

---

## English

CSP Paperback supplements CLIP STUDIO PAINT's animation cel export for Japanese animation production. It reads the timeline and layer structure from a CLIP file to export production artwork as a batch of still images.

[Open the browser app](https://stechdrive.github.io/csp-paperback/) / [Download the Windows app](https://github.com/stechdrive/csp-paperback/releases)

### Export layouts, BOOK layers, and compositing instructions without registering them as cels

CLIP STUDIO PAINT EX can already export animation cels as a batch of still images. It can also composite layers outside animation folders onto each cel. To include layouts or compositing instructions as separate images in that same export, however, they must also be registered as cels. ([CSP manual, Japanese](https://help.clip-studio.com/ja-jp/manual_jp/600_animation/アニメーションを書き出す.htm))

Paperback lets you choose which materials to composite onto each image and which to export separately, without registering static materials as animation cels.

| Material | Output |
|---|---|
| Peg-hole and frame guides | Composite onto each cel or output image |
| Background layouts and BOOK layers | Export each as a separate image without mixing it into the cels |
| Compositing instructions | Export each set of instructions as a separate image |

Designate separate outputs with folder names starting with `_`, such as `_BG`, or register the names in the individual-output folder list. You can also select materials for separate output after loading the file.

An import setting makes these target folders visible on load, so compositing instructions kept hidden while drawing can still be exported. You do not need to show them again in CSP before each export.

### Export drawings and revisions separately without adding revision tracks

Inside each cel's layer folder within an animation folder, create folders with registered stage names such as `_e` and `_s`. Paperback exports the original drawing and those revisions as separate images.

```text
A                       Animation folder
└─ 1                    Cel layer folder
   ├─ _s                Animation supervisor revision
   ├─ _e                Director revision
   └─ Drawing layer
```

Manage the timing of drawings and revisions on one track, without adding animation folders or tracks for the revisions.

### Export with filenames for each production stage

Paperback also supports animation folders placed inside separate layer folders for drawings, director revisions, animation supervisor revisions, and other stages.

Add text such as `_e` or `_s` to exported filenames according to the production stage. You do not need to rename folders or cels in CSP just to distinguish the output files.

Example filenames using sequential numbering:

| Stage | Output filename |
|---|---|
| Drawing | `A_001.jpg` |
| Director revision | `A_001_e.jpg` |
| Animation supervisor revision | `A_001_s.jpg` |

Use the original CSP cel names or assign sequential numbers. You can configure where stage text appears, number padding, and separators.

When stages use separate tracks, revisions starting on the same frame as a drawing can be exported with the same number as that drawing.

Choose between separate output folders for each animation folder and a single folder containing all images.

### Adjust opacity for export without changing the original CLIP

Opacity adjusted for visibility while drawing does not need to be changed back in CSP just for export. Animation, cel, and stage folders are treated as 100% opaque during export.

Drawing layers inside cels can retain their original opacity or be adjusted to the opacity you need while checking the output preview. The original CLIP file is not rewritten, so it stays in the state you prefer for drawing.

### Add images that combine cels and layouts

Virtual cels combine loaded cels, layouts, and other materials into additional output images. For example, export a reference image with a character cel over a background layout alongside the individual materials.

### Getting started

1. In CSP, make the drawing layers you want to export visible and save the CLIP file.
2. Drop the CLIP into CSP Paperback. Its timeline is read directly.
3. Check the stage names and export settings.
4. Review images and filenames in the output preview, select the stages or materials you need, and export them together.

Save JPEG or PNG images as a ZIP archive or to a folder. PNG supports transparent backgrounds.

Use the × beside an image or the pane menu to turn off individual outputs. They remain visible for review, and stay off when filenames, stage suffixes or appearance change. Restore them explicitly or use Undo; opening a new document clears these choices. Tiles support Ctrl/Cmd-click to toggle selection and Shift-click for a range. Shift-drag adds a rectangle, Ctrl/Cmd-drag toggles it, and Ctrl/Cmd+Shift-drag removes it. Ordinary dragging pans the board.

Stage names vary between studios and productions. On first use, check the stage folder list and set the folder names you use and the text to add to exported filenames. For example, map `演出` to `_e` and `作監` to `_s`. Save your settings and share them with other staff or devices as a JSON file.

Try the in-app sample to inspect the output. Detailed instructions and settings are covered in the in-app help.

### Use CSP's saved images for vector and 3D layers

Enable version compatibility information in CSP's file preferences and save the CLIP again. When an individual layer's saved image is available, the app uses it. Otherwise, vectors use approximate rendering and unavailable 3D layers contribute a transparent image. Warning marks on affected output rows and individual layers show the source and reason. The output list only displays warning labels when there is a problem.

CLIP and PSD images are decoded when needed and reloaded after cache eviction. The app no longer stops decoding a document when its cumulative layer images exceed 512 MiB. Individual image and working-memory limits remain; allocation failures stop the affected output with a retryable error.

Layer color and outlines use the app's own processing; watercolor edges are approximate. A PSD can also supply ordinary layer images. Save it from the same saved state of the CLIP using this menu command, then load both files together. Folder effects may be absent from the PSD too.

**File > Save Duplicate > .psd (Photoshop Document)**

Save the CLIP and PSD with matching layer visibility. You can also add the PSD after loading the CLIP.

Camera and animated transforms are left unapplied so the original materials can be exported for compositing. See [CLIP import](docs/clip-import.md) for rendering support and limitations.

### Export multiple cuts automatically with the Windows app

Save your settings first, then drop multiple CLIP files onto the EXE or its shortcut to export them automatically. Include any PSDs you need in the same drop.

Each PSD is paired with the CLIP in the same directory with the same filename stem. For example, dropping `c001.clip`, `c001.psd`, and `c002.clip` processes c001 with its PSD and c002 as a standalone CLIP.

Cuts export one at a time into folders beside their CLIPs. Existing output folders are preserved by adding a number to the new folder's name. If one cut fails, the remaining cuts continue, and you can review the results in a list.

### Your artwork stays on your device

Files are read and images are generated within your browser or on your device. Artwork is not uploaded.

---

## License

MIT License — © stechdrive

See [LICENSE](LICENSE) for details.
