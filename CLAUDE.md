# CLAUDE.md

## プロジェクト概要
CSP（Clip Studio Paint）のアニメーションセル出力の不備を補う、PSDベースのWebアプリ。
gh-pagesで静的ホスティング。ブラウザ完結、サーバー不要。

## 技術スタック
- **React 19 + Vite + TypeScript**
- **Zustand** — グローバル状態管理（レイヤーツリー、マーク、仮想セット、プロジェクト設定）
- **ag-psd** — PSD読み込み
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
  utils/        ユーティリティ（XDTS解析、画像・パス処理等）
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
- **不透明度**: 構造的コンテナ（アニメフォルダ、セルフォルダ、工程フォルダ）は **100%固定**。アートワークコンテンツの不透明度は **尊重**。詳細は `docs/compositing-engine.md` 参照
- **合成モードはすべてキープ**
- **非表示レイヤーは合成不参加**
- アニメーションフォルダを含む親フォルダだけ例外としてフォルダのままルートまで持ち上げる
- **仮想セット**: セル1つの仮想アニメフォルダ。PSD内の任意レイヤーを直接参照し、非パススルーフォルダとして隔離合成して指定位置に差し込む
- **アニメフォルダ判定の優先順位**: XDTS正本 > 手動マーク > `_` プレフィックス + processTable 一致による自動昇格（autoProcess、内側優先）> autoMarked 据え置き

## gh-pagesデプロイ設定
- `vite.config.ts` の `base` は `/csp-paperback/` に設定済み
- リモートリポ設定後に `npm run deploy` でデプロイ可能

## テスト方針
- CSPの手動書き出し結果をゴールデンデータとして画像比較
- Phase1: 合成エンジン（フラット化ロジック）
- Phase2: マーク機能
- Phase3: UI・出力
- Phase4: セル内包型モード・プロジェクト設定テーブル
- Phase5: 未定
