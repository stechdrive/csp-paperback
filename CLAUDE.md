# CLAUDE.md

## プロジェクト概要
CSP（Clip Studio Paint）のアニメーションセル出力の不備を補う、PSDベースのWebアプリ。
gh-pagesで静的ホスティング。ブラウザ完結、サーバー不要。

## 技術スタック
- **React 19 + Vite + TypeScript**
- **Zustand** — グローバル状態管理（レイヤーツリー、マーク、仮想セット、プロジェクト設定）
- **ag-psd** — PSD読み込み・書き出し・XMPメタデータ読み書き
- **JSZip** — ZIP出力
- **Canvas API** — 合成・ラスタライズ
- **Vitest** — テスト（合成エンジンのゴールデンデータ比較）
- **gh-pages** — デプロイ

## ディレクトリ構成
```
src/
  engine/       合成エンジン（フラット化ロジック、セル合成）
  store/        Zustandストア
  components/   Reactコンポーネント（3ペインUI）
  hooks/        カスタムフック
  utils/        ユーティリティ（xdts解析、XMP読み書き等）
  types/        型定義
  test/         テスト用セットアップ・ゴールデンデータ
```

## 主要コマンド
```bash
npm run dev        # 開発サーバー起動
npm run build      # ビルド
npm run preview    # ビルド結果プレビュー
npm run test       # テスト実行
npm run test:ui    # テストUI
npm run deploy     # gh-pagesへデプロイ（要リモートリポ設定）
```

## 合成エンジンの基本ルール
- **不透明度は無視（100%として扱う）** — 作業用の透かし設定は出力に含めない
- **合成モードはすべてキープ**
- **非表示レイヤーは合成不参加**
- アニメーションフォルダを含む親フォルダだけ例外としてフォルダのままルートまで持ち上げる

## gh-pagesデプロイ設定
- `vite.config.ts` の `base` は `/csp-paperback/` に設定済み
- リモートリポ設定後に `npm run deploy` でデプロイ可能

## テスト方針
- CSPの手動書き出し結果をゴールデンデータとして画像比較
- Phase1: 合成エンジン（フラット化ロジック）
- Phase2: マーク機能
- Phase3: UI・出力
- Phase4: セル内包型モード・プロジェクト設定テーブル
- Phase5: CLIPファイル解析・XMP埋め込み
