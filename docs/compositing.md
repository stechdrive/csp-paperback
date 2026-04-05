# 合成エンジン設計ドキュメント

このドキュメントは `src/engine/` の合成ロジックの設計思想・判断根拠・処理フローを記述する。
コードの「なぜ」を保存することが目的であり、コードのリファレンスではない。

---

## メンタルモデル：「紙に戻す」

CSP Paperback の出力は **「原稿が紙に刷り上がった状態」** を再現することが目標である。

CSPの作業ファイルには「作業用の透かし」「参考素材の半透明表示」「工程フォルダのネスト構造」など、
出力とは関係ない情報が含まれている。これらを取り除いて完成画像を得るのがこのツールの役割。

この目標から以下の方針が決まる：

- **合成モードはすべて尊重する** — 作業者が意図して設定した合成関係は出力にも反映する
- **不透明度はレイヤーの役割によって扱いが異なる**（後述）
- **非表示レイヤーは合成不参加** — UIで隠したものは出力にも出ない

---

## レイヤーの役割分類と不透明度ポリシー

アニメーションセルの構造には「構造的コンテナ」と「アートワークコンテンツ」の2種類がある。

```
A/          ← アニメーションフォルダ（構造的コンテナ）
  1/        ← セルフォルダ（構造的コンテナ）
    レイヤー2        ← bodyLayer（アートワーク）
    ベタ塗り/        ← 非工程フォルダ（アートワーク）
      ...
    _k/     ← 工程フォルダ（構造的コンテナ）
      レイヤー3      ← アートワーク
```

| レイヤー種別 | 不透明度 | 根拠 |
|------------|---------|------|
| アニメーションフォルダ本体 | **100%固定** | 構造的コンテナ。作業者が不透明度を変える理由がない |
| セルフォルダ（直接の子） | **100%固定** | 同上 |
| アニメフォルダ直下の単体セルレイヤー | **100%固定** | XDTSキーフレーム画像として構造的扱い |
| 工程フォルダ本体（`_k/` 等） | **100%固定** | 構造的コンテナ。工程を束ねる入れ物 |
| セルフォルダ内のbodyLayer | **尊重** | 作業者の意図（参考素材を半透明にして作業する等）を反映 |
| 工程フォルダの中身 | **尊重** | 同上 |

### なぜ構造的コンテナを100%固定にするのか

原画マンが「参考のために元素材を不透明度50%にして作業中に保存した」場合、
そのセルフォルダや工程フォルダが50%になっていても出力は100%として扱うべき。
ユーザーが意図的に下げたのではなく、作業上の都合で設定された値だから。

bodyLayerは逆に、作業者が意図的に不透明度を設定した結果を尊重する必要がある
（例：影レイヤーを半透明にして色の調整をしている等）。

### グローバルプレビュー（ナビゲーター）との違い

グローバルプレビューは `flattenToCanvas` → `flattenTree` で生成され、
**PSDの生の状態をそのまま表示する**。不透明度は `layer.opacity` を尊重。

出力プレビューと ZIP 出力は `extractCells` 経由で、上記ポリシーを適用する。

---

## flattenTree の動作ルール

`flattenTree` はレイヤーツリーを `FlatLayer[]` に変換する。各レイヤーは以下の優先順で処理される：

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

### Pass Through フォルダのマスク制限（v1）

Pass Through フォルダにマスクをかけると、本来は「フォルダ内の全レイヤーを
背景込みで合成した結果にマスクを適用する」挙動になる。
これには中間キャンバスと背景の状態への依存が必要で実装コストが高い。
実際の作業ファイルでこの設定が使われることはほぼないため v1 ではスキップしている。

---

## extractCells の処理フロー

`flattenTree` はプレビュー用（1フレームを1枚に）。
実際の出力（各セルを独立したファイルとして）は `extractCells` が担当する。

```
extractCells(animFolder, ...)

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
        flattenCellContent(processLayers, ignoreOpacity={processLayer.id})
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

### lower / upper のスタック順

再帰の巻き戻し順（内側 → 外側）でスタックに積まれる。

- lower: 外側から描画する（外側BG → 内側コンテキスト → セル）ため **逆順**で flat 化
- upper: 内側が最もセルに近いため **そのまま** flat 化

---

## プレビューと出力の一致保証

`useOutputPreview` は以下のルーティングで実出力と同一の関数を経由する。
これにより「プレビューと ZIP が違う」バグを構造的に防いでいる。

| 選択状態 | プレビュー経路 | ZIP出力経路 |
|---------|-------------|------------|
| 仮想セット（配置済み） | `extractVirtualSetEntries` | 同一 |
| アニメフォルダ選択 | `extractCells` | 同一 |
| アニメセル内のレイヤー選択 | `findAnimCellAncestor` → `extractCells` | 同一 |
| マーク済みレイヤー（セル外） | `collectMarkedLayerContext` | 同一 |

グローバルプレビュー（ナビゲーター中央キャンバス）のみ `flattenToCanvas` を使い、
PSD の生の状態（不透明度そのまま）を表示する。出力とは独立した「現状確認」用。

---

## 既知の制限（v1）

| 制限 | 内容 | 優先度 |
|------|------|-------|
| Pass Through フォルダのマスク | 中間合成が必要で未実装。実用頻度が極めて低い | 低 |
| ベクターマスク（`realMask`） | ag-psd は読むが未適用。CSP→PSDでラスタライズされる可能性が高い | 低 |
| 未対応合成モード 11種 | dissolve / linear burn 等を source-over で代替。UIに ⚠ 表示 | 中 |
| 調整レイヤー | ag-psd は読むが効果を適用しない。CSP→PSDで焼き込まれる可能性が高い | 低 |
