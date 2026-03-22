# LoPo — FF14 軽減プランナー

FF14のレイドにおける軽減計画を、スプレッドシートよりもサクサク動くウェブアプリで。
タイムラインベースで軽減を視覚的に配置し、パーティ全体の生存をシミュレートします。

## ✨ 主な機能

- **タイムラインビュー** — 時系列でダメージと軽減を一覧。致死判定をリアルタイム計算
- **FFLogs インポート** — ログ URL を貼るだけでタイムラインを自動生成
- **オートプランナー** — 1 クリックでリキャストを考慮した軽減を自動配置
- **早見表（Cheat Sheet）** — プレイ中に横目で見れるシンプルビュー
- **パーティ編成** — 8 人のジョブ・ステータスを自由に設定
- **i18n 対応** — 日本語 / English 切替対応
- **PWA 対応** — モバイルでもオフラインでも快適に
- **チュートリアル** — 初めてでも操作を学べるインタラクティブガイド

## 🚀 セットアップ

```bash
# 依存パッケージのインストール
npm install

# FFLogs API の設定（任意）
cp .env.local.example .env.local
# .env.local に FFLogs の Client ID / Secret を記入

# 開発サーバーの起動
npm run dev
```

## 📦 ビルド

```bash
npm run build
npm run preview  # ビルド結果のプレビュー
```

## 🌐 デプロイ

Vercel へのデプロイを想定しています。

1. リポジトリを GitHub に push
2. [Vercel](https://vercel.com) でインポート
3. 環境変数に `FFLOGS_CLIENT_ID` と `FFLOGS_CLIENT_SECRET` を設定

## 🛠️ 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | React 19 + TypeScript |
| ビルドツール | Vite 7 |
| 状態管理 | Zustand |
| スタイリング | Tailwind CSS 4 |
| アニメーション | Framer Motion |
| ドラッグ&ドロップ | dnd-kit |
| 国際化 | react-i18next |
| 3D 背景 | Three.js |
| PWA | vite-plugin-pwa |

## 📄 著作権表記

当サイトは非公式のファンツールであり、株式会社スクウェア・エニックスとは一切関係ありません。

© SQUARE ENIX CO., LTD. All Rights Reserved.  
FINAL FANTASY は株式会社スクウェア・エニックスの登録商標です。
