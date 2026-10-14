# CSP Paperback

[日本語](#日本語) | [English](#english)

## 日本語

**クリスタのアニメーションセル出力を、制作現場の運用に合わせて。**

CSP Paperbackは、CLIP STUDIO PAINT（クリスタ）のアニメーションセル出力を補う、日本のアニメ制作向けの静止画書き出しツールです。

CLIPファイルのタイムラインとレイヤー構成を読み取り、作画セル、演出・作監修正、背景原図、BOOK、撮影指示を、それぞれ独立した画像としてまとめて書き出します。

[ブラウザで使う](https://stechdrive.github.io/csp-paperback/) ／ [Windows版をダウンロード](https://github.com/stechdrive/csp-paperback/releases)

### セルの一括出力から、現場で必要な素材の出し分けへ

クリスタEXには、タイムラインのセルをまとめて静止画にする「アニメーションセル出力」があります。アニメーションフォルダ外のレイヤーを、各セルへ合成することもできます。

ただ、タップやフレーム枠は各セルへ重ね、背景原図や撮影指示は別画像として出す、といった素材ごとの出し分けには追加の作業が必要です。

CSP Paperbackでは、共通で合成する素材と、別々に書き出す素材を指定して、一度に出力できます。

| 出したいもの | 書き出し方 |
|---|---|
| タップ・フレーム枠 | 各セルや出力画像へ共通で合成 |
| 背景原図・BOOK・撮影指示 | セルへ混ぜず、それぞれ別画像として出力 |
| 作画・演出修正・作監修正 | 工程ごとに分け、工程名を付けて出力 |

背景原図や撮影指示を、書き出すためだけにアニメーションセルへ登録する必要はありません。`_BG`など、先頭に`_`を付けたフォルダを使うほか、アプリ上で個別に書き出す素材を指定できます。

撮影指示やキャラのスライド指示は、作画・チェックの邪魔にならないよう、CSPではフォルダを非表示のまま保存できます。
「対象フォルダを非表示でも表示して読み込む」がONなら、`_`で始まるフォルダと「個別に書き出すフォルダ名」の登録名は、Paperbackで読み込む際に目玉がONになります。子の描画レイヤーの非表示は維持し、元のCLIP・PSDは変更しません。この設定は詳細設定でOFFにできます。

書き出し設定の「出力対象」には、読み込んだ素材に該当する工程と、個別に書き出す素材名が並びます。「作画」をOFFにすると、例えば`A_001.jpg`を出さず、同じセル内の`A_001_s.jpg`だけを書き出せます。工程名の前には、その工程に設定されたフチ色を表示します。出力のON／OFFは目玉を変えず、ツリーに「出力OFF」「一部OFF」で表示します。

### 工程ごとに分ける運用にも、セル内にまとめる運用にも

**工程ごとにフォルダを分ける場合**

作画・演出・作監などの工程フォルダに、それぞれアニメーションフォルダを置く構成に対応しています。工程名を設定しておけば、普段のフォルダ・タイムライン構成から、作画と各工程の修正をまとめて書き出せます。

**セルの中に修正をまとめる場合**

セルのレイヤーフォルダ内に、`_e`・`_s`などの登録済み工程フォルダを置くと、作画本体と修正を分けて書き出せます。

```text
A                       アニメーションフォルダ
└─ 1                    セルのレイヤーフォルダ
   ├─ _s                作監修正
   ├─ _e                演出修正
   └─ 作画レイヤー
```

たとえば、この構成から次の3枚を出力できます。

```text
A_1.jpg      作画本体
A_1_e.jpg    演出修正
A_1_s.jpg    作監修正
```

作画と修正を同じセル内で管理できるため、修正用のトラックを増やさず、タイムラインをシンプルに保てます。

どちらの方法でも、現場の運用に合わせて工程別の画像を取り出せます。

### ファイル名とフォルダ構成も、受け渡しのルールに合わせる

クリスタのセル名を使う方法や、連番を付ける方法を選べます。工程名の付け方や番号の桁数、区切り文字も設定できます。

「連番（シート合わせ）」では、タイムライン上で同じコマから始まる作画と修正に、同じ番号を付けられます。たとえば2枚目だけに演出修正がある場合も、`A_2.jpg`と`A_2_e.jpg`のようにそろえられます。

出力先は、アニメーションフォルダごとに分ける方法と、すべての画像を一つのフォルダにまとめる方法を選べます。

### 元のCLIPを変えずに、書き出し用の不透明度を調整

作画作業中に見やすくするために調整した不透明度を、書き出しのためだけにクリスタで変更し直す必要はありません。

アニメーション・セル・工程フォルダは、出力時に100%として扱います。セル内の描画レイヤーなどは、元の不透明度を使うほか、出力プレビューを見ながら調整できます。

100%に戻すだけでなく、必要な濃さで書き出せます。元のCLIPファイルは書き換えないので、作業しやすい状態のまま残せます。

### 最初に、現場の工程名を設定してください

工程の呼び方や命名ルールは、スタジオや作品によって異なります。

「工程フォルダリスト」で、実際に使っているフォルダ名と、出力ファイル名に付ける文字を設定してください。たとえば「演出」に`_e`、「作監」に`_s`を対応させます。初期設定も用意しています。

「グループ名」は、複数のフォルダ名をまとめるチェック項目の名前です。例えば「演出」に`_e, 演出, 演出修正`を登録できます。書き出し設定にはグループ名とフチ色を表示します。グループ名を変えても、対応フォルダ名や出力ファイル名は変わりません。

設定は保存でき、JSONファイルでスタッフや別の端末へ共有できます。

### 使い方

1. クリスタでCLIPを保存します。書き出したい描画レイヤーは表示します。個別書き出し対象のフォルダ本体は、上記の読み込み設定がONなら非表示のままでも扱えます。
2. CSP PaperbackへCLIPをドロップします。タイムラインも直接読み込みます。
3. 工程名や書き出し設定を確認し、出力ファイル一覧から画像とファイル名をチェックします。
4. JPEG／PNG画像を、ZIPまたはフォルダへまとめて書き出します。PNGは透明背景にも対応しています。

ベクター・3Dなど、CLIPだけではクリスタの描画を十分に再現できない素材には、PSDを併用できます。同じ保存状態のCLIPから、**［ファイル］→［複製を保存］→［.psd(Photoshopドキュメント)...］**でPSDを作り、一緒に読み込んでください。CLIPとPSDは、レイヤーの表示状態を合わせて保存してください。後からPSDを追加することもできます。

カメラ・変形アニメーションは適用せず、撮影前の素材として書き出します。描画範囲と制限の詳細は[CLIP読み込み](docs/clip-import.md)を参照してください。

Windows版では、あらかじめ設定を保存しておけば、複数のCLIPをEXEやショートカットへまとめてドロップして自動出力できます。必要なPSDも一緒に指定できます。

複数作品では、同じフォルダ・同じファイル名（拡張子を除く）のCLIPとPSDを組にし、PSDのないCLIPは単独で処理します。例えば `c001.clip`、`c001.psd`、`c002.clip` を渡すと、c001はPSD併用、c002はCLIP単独で順番に書き出します。ドロップしたファイルだけが対象です。

各CLIPの隣へ作品名の出力フォルダを作ります。既存のフォルダは上書きせず、末尾に番号を付けます。構造不一致や対応先のないPSDなどは失敗として記録し、残りの作品を続行します。結果一覧で成功・失敗・再現上の注意を確認してください。CLIPとPSDの寸法・階層・名前・重なり順を照合しますが、画像内容や保存時点の一致は検証しません。同じ保存状態の組を使用してください。

アプリ内のサンプルから、出力結果を試せます。

### 作品データは外部へ送信しません

ファイルの読み込みと画像生成は、ブラウザ内または端末内で行います。

---

## English

**Adapt CSP animation cel export to your studio's workflow.**

CSP Paperback is a still-image export tool for Japanese animation production. It supplements CLIP STUDIO PAINT's animation cel export with material selection, separation by production stage, and configurable filenames and output folders.

It reads the timeline and layer structure directly from a CLIP file to export drawings, director and animation supervisor revisions, background layouts, BOOK layers, and compositing instructions as separate images in one batch.

[Open the browser app](https://stechdrive.github.io/csp-paperback/) / [Download the Windows app](https://github.com/stechdrive/csp-paperback/releases)

### Export the materials your production needs

CLIP STUDIO PAINT EX already supports exporting animation cels as a batch of still images. Its animation cel export can also composite layers outside animation folders onto each cel.

Additional work is needed when those materials require different treatment: peg-hole and frame guides should appear on every cel, while background layouts and compositing instructions should become separate images.

CSP Paperback lets you specify which materials to composite and which to export separately, then generate them together.

| Material | Output |
|---|---|
| Peg-hole and frame guides | Composite onto each cel or output image |
| Background layouts, BOOK layers, and compositing instructions | Export as separate images without mixing them into the cels |
| Drawings, director revisions, and animation supervisor revisions | Export separately by production stage, with stage labels in the filenames |

Background layouts and compositing instructions do not need to be registered as animation cels just to export them. Use folder names starting with `_`, such as `_BG`, or select standalone outputs in the app.

### Keep stages in separate folders or together inside each cel

**Separate folders for each production stage**

Keep animation folders inside the folders for drawings, director revisions, animation supervisor revisions, and other stages. Register the stage folder names to export the drawings and revisions together from your usual folder and timeline structure.

**Revisions inside each cel**

Place registered stage folders such as `_e` and `_s` inside a cel's layer folder to export the original drawing and revisions separately.

```text
A                       Animation folder
└─ 1                    Cel layer folder
   ├─ _s                Animation supervisor revision
   ├─ _e                Director revision
   └─ Drawing layer
```

For example, this structure produces three images:

```text
A_1.jpg      Original drawing
A_1_e.jpg    Director revision
A_1_s.jpg    Animation supervisor revision
```

Keeping the drawing and revisions inside the same cel avoids adding revision tracks and keeps the timeline simple.

Both arrangements support separate outputs for each production stage. Choose the one that fits your studio's workflow.

### Match filenames and folders to your handoff rules

Use the original CSP cel names or assign sequential numbers. Configure stage labels, number padding, and separators.

The timeline-aligned sequence option gives drawings and revisions the same number when they start on the same frame. If only the second drawing has a director revision, for example, the pair can be exported as `A_2.jpg` and `A_2_e.jpg`.

Choose between separate folders for each animation folder and a single folder containing all output images.

### Adjust opacity for export without changing the original CLIP

Opacity adjusted for visibility while drawing does not need to be changed back in CSP just for export.

Animation, cel, and stage folders are treated as 100% opaque during export. Drawing layers inside cels can retain their original opacity or be adjusted while you check the output preview.

You can choose the opacity the exported artwork needs, rather than only restoring it to 100%. The original CLIP file is not rewritten, so it stays in the state you prefer for drawing.

### Set up your studio's stage names first

Stage names and filename conventions vary between studios and productions.

In the stage folder list, register the folder names you use and the text to add to exported filenames. For example, map `演出` to `_e` and `作監` to `_s`. Default mappings are provided.

Save your settings and share them with other staff or devices as a JSON file.

### Getting started

1. In CSP, make the materials you want to export visible and save the CLIP file.
2. Drop the CLIP into CSP Paperback. Its timeline is read directly.
3. Check the stage names and export settings, then review images and filenames in the output file list.
4. Export JPEG or PNG images together as a ZIP archive or to a folder. PNG supports transparent backgrounds.

For materials that CLIP alone cannot fully reproduce, such as vector or 3D layers, add a PSD. From the same saved state of the CLIP, use **File > Save Duplicate > .psd (Photoshop Document)** and load both files together. Save them with matching layer visibility. You can also add the PSD after loading the CLIP.

Camera and animated transforms are left unapplied so the original materials can be exported for compositing. See [CLIP import](docs/clip-import.md) for rendering support and limitations.

In the Windows app, save your settings first, then drop multiple CLIP files and optional PSDs onto the EXE or its shortcut. For multiple projects, each PSD is paired with the CLIP in the same directory with the same filename stem. CLIPs without a supplied PSD are processed on their own; neighboring files are not searched automatically.

Projects export one at a time into separate folders beside their CLIPs. Existing output folders are preserved by adding a numeric suffix. Failed projects, including structural mismatches and unmatched PSDs, are listed while remaining projects continue. Review the results for successes, failures, and rendering warnings. Dimensions, hierarchy, names, and stacking order are checked; image content and save-state equivalence are not. Use CLIP and PSD files from the same saved state.

Try the in-app sample to inspect the output.

### Your artwork stays on your device

Files are read and images are generated within your browser or on your device. Artwork is not uploaded.

---

## License

MIT License — © stechdrive

See [LICENSE](LICENSE) for details.
