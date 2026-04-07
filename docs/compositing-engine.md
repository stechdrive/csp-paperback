# CSP Paperback 合成エンジン設計ドキュメント

このドキュメントは CSP Paperback の合成エンジン（`src/engine/`）の設計思想・処理フロー・ルールを記述する。
コードの「なぜ」を保存することが目的であり、コードのリファレンスではない。

---

## なぜこのツールが必要か

クリスタはアニメーション制作ツールだが、制作フローの多くの工程で静止画が必要になる。

- 仕上げ工程はクリスタ以外のツールを使うことが多い
- 撮影工程は静止画の合成
- 次工程が紙（印刷）の場合もある
- 外部スタッフがクリスタを持っていない場合もある

つまり **「クリスタで作ったアニメーション素材を、静止画として正しく取り出す」** というニーズは制作フローの構造的な問題として存在する。

---

## 現場のワークフローと課題

### 別トラック方式（従来）

クリスタのアニメーション書き出しはタイムシートに打たれた「セル単体」を出力する設計になっている。
そのため、原画・演出修正・作監修正など複数の工程が絡む場合、現場では以下のような構造をとる。

```
レイアウト/
  LO/
    A/
      1番  2番  3番  ...

  演出修正/
    A/
      1番（修正あり）  3番（修正あり）  ...

  作監修正/
    A/
      2番（修正あり）  ...
```

修正が発生したセルに、修正工程のタイムライン上の同じコマに別トラックでセルを置く。
クリスタの書き出しで自動化でき、静止画として次工程に渡せる。

これは出力の自動化を見据えると効率的だが、紙の作業工程の再現という観点では直感的ではない。タイムシートの複製が煩雑であり、修正指示が同一のレイヤーフォルダで管理できなくなってしまう。

### セル内包型（理想構造）

各工程をセルの中に従属させる構造。

```
A/                         ← アニメーションフォルダ
  1/                       ← セルフォルダ
    _作監修正/
      修正線画
    _演出修正/
      修正線画
    原画本体レイヤー
```

構造として直感的だが、クリスタのアニメーションセル書き出しでは工程ごとの独立した出力が自動化できない。全工程を合成した画像が1枚出るだけで、修正指示を単独で確認することができない。また、作業途中に視認性のため別工程の素材の不透明度を下げた状態で保存していると、その影響が出力に混入する。

### このツールが解決すること

両方のワークフローに対応し、どちらで作られたデータからも工程ごとの完成画像を正しく取り出す。

- **別トラック方式**: XDTSからタイムライン情報を読み込み、修正工程のフォルダ名をprocessTableに登録することで出力ファイル名に自動サフィックス付加
- **セル内包型**: セル内の工程フォルダ名をprocessTableに登録することで検出・独立出力。構造コンテナの不透明度は100%固定、アートワークの不透明度は尊重

---

## メンタルモデル：「紙に戻す」

CSP Paperback の出力は **「作画用紙に描いた1枚の状態」** を再現することが目標である。

CSPの作業ファイルには「作業用の透かし」「参考素材の半透明表示」「工程フォルダのネスト構造」など、出力とは関係ない情報が含まれている。これらを取り除いてタイムシートどおりの、作画、演出、作監といった修正工程ごとの画像を得るのがこのツールの役割。

この目標から以下の方針が決まる：

- **合成モードはすべて尊重する** — 作業者が意図して設定した合成関係は出力にも反映する
- **不透明度はレイヤーの役割によって扱いが異なる**（後述）
- **非表示レイヤーは合成不参加** — UIで隠したものは出力にも出ない（作業者の自己責任）

---

## レイヤーの役割分類と不透明度ポリシー

アニメーションセルの構造には「構造的コンテナ」と「アートワークコンテンツ」の2種類がある。

```
A/           ← アニメーションフォルダ（構造的コンテナ）
  1/         ← セルフォルダ（構造的コンテナ）
    レイヤー2         ← bodyLayer（アートワーク）
    ベタ塗り/         ← 非工程フォルダ（アートワーク）
      ...
    _en/      ← 演出修正工程フォルダ（構造的コンテナ）
      レイヤー3       ← アートワーク
```

| レイヤー種別 | 不透明度 | 根拠 |
|------------|---------|------|
| アニメーションフォルダ本体 | **100%固定** | 構造的コンテナ。紙に戻すという前提で考えると100%以下にする理由がない |
| セルフォルダ（直接の子） | **100%固定** | 同上。extractCellsでは子のみを処理対象とし、フォルダ自体は合成対象にならない |
| アニメフォルダ直下の単体セルレイヤー | **100%固定** | XDTSキーフレーム画像として構造的扱い（レイヤーフォルダをつくらず一枚のレイヤーのみで作画したセル番号の素材） |
| 工程フォルダ本体（`_en/` 等） | **100%固定** | 構造的コンテナ。工程を束ねる入れ物 |
| セルフォルダ内のbodyLayer | **尊重** | 作業者の意図（影付素材を半透明にして作業する等）を反映 |
| 工程フォルダの中身 | **尊重** | 同上 |

### なぜ構造的コンテナを100%固定にするのか

作監修正時に「その他工程の素材を視認性のために不透明度50%にして作業中に保存した」場合、
そのセルフォルダや工程フォルダが50%になっていても出力は100%として扱うべき。
ユーザーが意図的に下げたのではなく、作業上の都合で設定された値だから。演出修正やもとのレイアウト素材を「紙」に戻すなら、それが薄くなっているなんてありえない、という理由。

bodyLayerは逆に、作業者が意図的に不透明度を設定した結果を尊重する必要がある
（例：影レイヤーを半透明にして色の調整をしている等）。

### 実装上の不透明度制御

`flattenTree` は `extraIgnoreOpacityIds` パラメータで制御する。

- **グローバルプレビュー（ナビゲーター）**: `extraIgnoreOpacityIds` なし → 全レイヤーの `layer.opacity` をそのまま使用。PSDの生の状態を表示する
- **出力プレビュー・ZIP出力**: `extractCells` 経由 → 構造コンテナのIDを `extraIgnoreOpacityIds` に渡して100%強制

```
effectiveOpacity = extraIgnoreOpacityIds?.has(layer.id) ? 100 : layer.opacity
```

---

## flattenTree の動作ルール

`flattenTree`（`src/engine/flatten.ts`）はレイヤーツリーを `FlatLayer[]` に変換する。
プレビュー用（1フレームを1枚に）の関数であり、出力用の `extractCells` も内部で利用する。

各レイヤーは以下の優先順で処理される：

```
1. hidden || uiHidden → [] （合成不参加）

2. isAnimationFolder
   → 選択セルを flattenLayer で再帰処理
   → compositeGroup で1枚に合成
   → アニメフォルダ自身のマスクを適用
   → FlatLayer 1枚で返す（プレビュー専用。出力は extractCells が担当）

3. isFolder && animAncestorIds.has(id)  ← アニメ包含フォルダ（例外ルール）
   → 子を個別に flattenLayer して結果をそのまま返す（中間合成しない）
   → このフォルダ自身の合成モード・マスクは無視
   理由: このフォルダを1枚に合成してしまうとアニメフォルダの独立した合成ができなくなる

4. isFolder（通常フォルダ）
   → pass through: 子を展開してそのまま返す（中間キャンバスなし）
   → 非 pass through: 子を compositeGroup で1枚に合成 → フォルダのマスクを適用 → FlatLayer で返す

5. 通常レイヤー
   → canvas, blendMode, opacity（ポリシー適用後）, mask を FlatLayer に変換
```

### 処理順序

ツリーはトップファースト順（PSDのレイヤーパネルの表示順）で格納されている。
合成はボトムファースト（下のレイヤーから先に描画）で行う必要があるため、
`flattenTree` は `rootChildren` を逆順にイテレートする。

### Pass Through フォルダのマスク制限（v1）

Pass Through フォルダにマスクをかけると、本来は「フォルダ内の全レイヤーを
背景込みで合成した結果にマスクを適用する」挙動になる。
これには中間キャンバスと背景の状態への依存が必要で実装コストが高い。
実際の作業ファイルでこの設定が使われることはほぼないため v1 ではスキップしている。

---

## 出力パイプライン

### extractCells — アニメーションフォルダからセルを抽出

`extractCells`（`src/engine/cell-extractor.ts`）はアニメーションフォルダの各可視セルを独立した `OutputEntry` に変換する。

セルの種別はPSD構造から自動判定する（明示的なモード選択はない）。

```
extractCells(animFolder, projectSettings, ...)

for each visibleCell in animFolder.children:

  [A] 単体レイヤーセル（cell.isFolder === false）
      flattenCellContent([cell], ignoreOpacity={cell.id})
      → applyContainerMasks（セルフォルダマスク + アニメフォルダマスク）
      → compositeWithContext(lowerContext, upperContext)
      → OutputEntry 1件

  [B] フォルダセル（cell.isFolder === true）
      子をprocessTable照合で分類:
        processGroups: フォルダ名がprocessTableにマッチ → 工程別出力
        bodyLayers: それ以外 → 本体出力

      本体出力（bodyLayersがある or processGroupsが空）:
        flattenCellContent(bodyLayers)  ← opacityをそのまま尊重
        → applyContainerMasks
        → compositeWithContext
        → OutputEntry 1件

      工程別出力（processGroupsの各suffix）:
        flattenCellContent(processLayers, ignoreOpacity={processFolder.id})
        → applyContainerMasks
        → compositeWithContext
        → OutputEntry 1件（suffix付きファイル名）
```

### applyContainerMasks の役割

`extractCells` はアニメフォルダをレイヤーとして `flattenLayer` に通さないため、
アニメフォルダ本体のマスクとセルフォルダ（非 pass through）のマスクが
自動的に適用されない。`applyContainerMasks` がこれを補う。

適用順序（グローバルプレビューの flattenLayer 処理順に一致させる）：
1. セルフォルダのマスク（非 pass through のみ）
2. アニメフォルダのマスク

### extractAllEntries — 全出力エントリの生成

`extractAllEntries` はツリー全体を走査して全出力エントリを生成する。ZIP出力のメインエントリポイント。

```
走査ルール:
  - isAnimationFolder && !autoMarked && !singleMark → extractCells で処理
  - autoMarked || singleMark → collectMarkedLayerContext で合成コンテキストを取得し出力
    （autoMarked + isAnimationFolder が同時の場合は autoMarked 優先 → 単独マーク出力）
  - isFolder && hasAnimFolderDescendant → 子を再帰走査（兄弟コンテキストを継承）
  - isFolder（アニメ子孫なし） → 子を再帰走査
```

### マーク済みレイヤーの出力

`_` プレフィックスフォルダ（autoMarked）とシングルマーク（手動）は、`collectMarkedLayerContext` で合成コンテキストを収集して出力する。

`collectMarkedLayerContext` はルートから対象レイヤーへのパス上の各レベルで、非マーク・非アニメの兄弟を upper/lower に分類して積む。これにより対象レイヤーの祖先フォルダの外にある層も、PSDのZ順に従って正しく配置される。

### 仮想セットの出力

#### メンタルモデル

仮想セットは **「セルが1つだけの仮想アニメーションフォルダ」** である。
通常のアニメーションフォルダが複数セルを内包し各セルごとに出力するのに対し、仮想セットは常に1ファイルを出力する。

通常のアニメフォルダとの違い：

| 項目 | アニメーションフォルダ | 仮想セット |
|------|-------------------|----------|
| 存在 | PSDツリー上に実在 | UIで定義した仮想構造 |
| セル数 | 複数 | 常に1つ |
| 素材の所在 | フォルダ内に直接含む | PSD内の任意レイヤーを直接参照（コピーでもインスタンスでもない） |
| 合成方式 | セルごとに extractCells | メンバーを非パススルーフォルダとして隔離合成 |
| コンテキスト | 兄弟・祖先から収集 | 同じ除外ルールで insertionLayerId 基準に収集 |
| 出力 | セル数分のファイル | 1ファイル |

#### 合成ルール

メンバーは **非パススルーフォルダと同じ隔離合成** で1枚に合成される（`compositeGroup`）。
メンバー内部のblendModeは隔離合成の中で完結し、外部の兄弟コンテキストには届かない。
合成結果は `blendMode: 'normal', opacity: 100` の単一 FlatLayer として扱われる。

#### コンテキスト除外ルール

`collectVsContextFlats` は `collectLocalSiblingContext` と同じ除外ルールを使う：
- hidden / uiHidden → 除外
- アニメーションフォルダ（＋アニメフォルダ子孫を持つフォルダ）→ 除外
- autoMarked / singleMark → 除外

#### 処理フロー

`extractVirtualSetEntries` は仮想セットを `OutputEntry` に変換する。

1. `insertionLayerId` を基準に `collectVsContextFlats` で upper/lower コンテキストを収集
2. メンバーレイヤーを `buildMemberFlatsWithOverride` でフラット化
   - 仮想セット固有の visibilityOverrides を適用
   - blendMode/opacity オーバーライドがあるメンバーは1枚に合成してから適用
3. メンバーを `compositeGroup` で非パススルー隔離合成
4. `compositeWithContext` で上下コンテキストと合体して最終合成

---

## コンテキスト収集の仕組み

各セルの出力はセル単体ではなく、**周辺のレイヤーと合成した完成画像** を生成する。
セルに対して「下に敷く」レイヤーと「上に重ねる」レイヤーを収集する。

```
lower（セルの下に合成）: BG、レイアウト用紙、アニメフォルダより下の兄弟
upper（セルの上に合成）: アニメフォルダより上の兄弟（前景、修正指示等）
```

### 2階層のコンテキスト

```
コンテキスト = globalContext + localSiblingContext

globalContext:
  ルート直下でアニメフォルダでも、アニメ子孫でも、マーク済みでもないレイヤー群
  → 全アニメフォルダ共通で「下」に合成される（BG、レイアウト用紙等）

localSiblingContext:
  アニメフォルダへのパス上の各階層で、パス要素の兄弟を upper/lower に分類
  → アニメフォルダと同階層の兄弟、その親フォルダの兄弟、と外側に向かって積み上げる
```

### コンテキスト除外ルール

以下のレイヤーはコンテキストから除外される：
- アニメーションフォルダ自身（別途処理される）
- アニメーション子孫を持つフォルダ（内部のアニメフォルダが別途処理される）
- マーク済みレイヤー（autoMarked/singleMark。独立出力されるためアニメセルのコンテキストに含めない）

### lower / upper のスタック順

再帰の巻き戻し順（内側 → 外側）でスタックに積まれる。

- **lower**: 外側から描画する（外側BG → 内側コンテキスト → セル）ため **逆順** で flat 化
- **upper**: 内側が最もセルに近いため **そのまま** flat 化

### 合成順序

最終的な合成は `compositeWithContext` で行われる：
```
allFlats = [...lowerContext, ...cellFlats, ...upperContext]
→ compositeStack(allFlats, docWidth, docHeight, background)
```

---

## プレビューと出力の一致保証

`useOutputPreview` は以下のルーティングで実出力と同一の関数を経由する。
これにより「プレビューと ZIP が違う」バグを構造的に防いでいる。

| 選択状態 | プレビュー経路 | ZIP出力経路 |
|---------|-------------|------------|
| 仮想セット（配置済み） | `extractVirtualSetEntries` | 同一 |
| 仮想セット（未配置） | globalContextで仮プレビュー | ZIP対象外 |
| アニメフォルダ選択 | `extractCells` | 同一（`extractAllEntries` 経由） |
| アニメセル内のレイヤー選択 | `findAnimCellAncestor` → `extractCells` | 同一 |
| マーク済みレイヤー（セル外） | `collectMarkedLayerContext` | 同一（`extractAllEntries` 経由） |

グローバルプレビュー（ナビゲーター中央キャンバス）のみ `flattenToCanvas` を使い、
PSD の生の状態（不透明度そのまま）を表示する。出力とは独立した「現状確認」用。

---

## 合成モードの対応

### Canvas API でネイティブ対応するモード（16種）

normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn,
hard-light, soft-light, difference, exclusion, hue, saturation, color, luminosity

pass through はルート合成時に source-over（normal）として扱う。

### 未対応モード（11種、source-over で代替）

dissolve, linear burn, darker color, linear dodge, lighter color,
vivid light, linear light, pin light, hard mix, subtract, divide

UIに警告アイコン（⚠）を表示して作業者に通知する。

### クリッピングマスク

`compositeStack` でクリッピングレイヤーを処理する。
直前の非クリッピングレイヤー（ベース）のアルファ領域で `destination-in` を使って切り抜き、
結果を合成する。ベースがない場合はスキップ。

### レイヤーマスク

ag-psd のマスクCanvasはグレースケール展開済み（R=G=B=マスク値、A=255）のため
`destination-in` は使えず、ピクセル単位でアルファにマスク値（Rチャンネル）を乗算する。

`mask.defaultColor` が 255（白）の場合、マスク範囲外は完全表示。0（黒）の場合は非表示。

---

## 既知の制限（v1）

| 制限 | 内容 | 優先度 |
|------|------|-------|
| Pass Through フォルダのマスク | 中間合成が必要で未実装。実用頻度が極めて低い | 低 |
| ベクターマスク（`realMask`） | ag-psd は読むが未適用。CSP→PSDでラスタライズされる可能性が高い | 低 |
| 未対応合成モード 11種 | dissolve / linear burn 等を source-over で代替。UIに ⚠ 表示 | 中 |
| 調整レイヤー | ag-psd は読むが効果を適用しない。CSP→PSDで焼き込まれる可能性が高い | 低 |
