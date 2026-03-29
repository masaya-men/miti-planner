# セッション引き継ぎ書（2026-03-30 第44セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## セッション開始時の必須作業（最重要 — 絶対にスキップしない）

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。**

### 毎回必ず読むファイル（タスクに着手する前に全て読み終えること）
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 過去の失敗パターン（繰り返さないこと）
- **設計書を読まずにバグ修正に飛びつく**
- **Skillを使わずに実装を始める**
- **`replace_all` で意図しない箇所まで置換してしまう**
- **Zustandストア内でハードコーディングした日本語メッセージ**
- **backdrop-filterを直書きする（Lightning CSSに削除される）→ TECH_NOTES.md参照**
- **glass-tier3の`!important`を無視してTailwindクラスで上書きしようとする**
- **authDomainをlopoly.appに直接変更する（Firebase Hostingのハンドラーが必要）→ auth.lopoly.appを使う**

---

## プロジェクト概要

- **サービス名**: LoPo（ロポ）— FF14プレイヤー向けツールポータル
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

---

## 今回のセッション（第44セッション）で完了したこと

### 1. ToDo全体の整理
- 全52件の未完了タスクをカテゴリ・重要度別に整理
- 外部レビュー指摘を「運用・品質基盤」セクションとしてTODO.mdに追記（テスト・エラー監視・バックアップ・a11y・法的確認・SEO等10件）
- ToDo確認用HTML（`docs/todo-review.html`）を作成（チェックボックス+個別コピー機能付き）
- 完了タスク（セッション42・43分）をTODO_COMPLETED.mdに移動

### 2. Googleログイン画面のドメイン表示修正
- **問題**: ログインポップアップに `lopo-7793e.firebaseapp.com` が表示される
- **解決**: `auth.lopoly.app` サブドメインをFirebase Hosting + Cloudflare DNSで設定
  - Firebase Hosting有効化 + カスタムドメイン追加
  - Cloudflare: CNAME `auth` → `lopo-7793e.web.app`（プロキシOFF）
  - Firebase Auth承認済みドメインに `auth.lopoly.app` 追加
  - `src/lib/firebase.ts`: `authDomain: "auth.lopoly.app"`
- **状態**: DNS反映待ち（数分〜24時間）。次セッションでFirebase Hosting画面を確認すること

### 3. 全モーダル×ボタンの反転ホバー統一（15ファイル）
- ConsolidatedHeaderと同じ `hover:bg-app-text hover:text-app-bg` + `active:scale-90` を全×ボタンに適用
- 対象: ShareModal, ConfirmDialog, TutorialOverlay(3箇所), LoginModal, ClearMitigationsPopover, MitigationSelector, NewPlanModal, AASettingsPopover, SaveDialog, CsvImportModal, JobPicker, FFLogsImportModal(2箇所), PhaseModal(2箇所), PartySettingsModal, PartyStatusPopover, EventModal, JobMigrationModal, Sidebar

### 4. その他の修正
- **サイドバー畳み時のKo-fi**: `isOpen` 判定で☕のみ表示
- **ステータス設定タイトル統一**: 「パラメータ設定」→「ステータス設定」（JP/EN両方）
- **TANK/HEALER/DPSラベル**: ライトモードで `text-blue-700` 等、ダークで元の明るい色を維持
- **FFLogsインポートモーダル**: createPortalでbody直下にレンダリング（ヘッダー下に隠れる問題修正）
- **デザイン改善6画面確認済み**: フェーズ追加・共有プレビュー・削除確認・オートプラン・FFLogs・ログイン
- **Stripe**: Ko-fiはPayPalのみに変更。Stripe不要で完了
- **チートシートモード**: TODO.mdに検討タスクとして追記

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/firebase.ts` | authDomainを`auth.lopoly.app`に変更 |
| `firebase.json` | hosting設定追加（public: dist） |
| `src/components/Sidebar.tsx` | Ko-fi畳み時☕のみ + ×ボタン反転ホバー |
| `src/components/PartyStatusPopover.tsx` | TANK/HEALER/DPS色改善 + ×ボタン反転ホバー |
| `src/components/FFLogsImportModal.tsx` | createPortal追加 + z-index + ×ボタン反転ホバー |
| `src/components/ShareModal.tsx` | ×ボタン反転ホバー |
| `src/components/ConfirmDialog.tsx` | ×ボタン反転ホバー |
| `src/components/TutorialOverlay.tsx` | ×ボタン反転ホバー（3箇所） |
| `src/components/LoginModal.tsx` | ×ボタン反転ホバー |
| `src/components/ClearMitigationsPopover.tsx` | ×ボタン反転ホバー |
| `src/components/MitigationSelector.tsx` | ×ボタン反転ホバー |
| `src/components/NewPlanModal.tsx` | ×ボタン反転ホバー |
| `src/components/AASettingsPopover.tsx` | ×ボタン反転ホバー |
| `src/components/SaveDialog.tsx` | ×ボタン反転ホバー |
| `src/components/CsvImportModal.tsx` | ×ボタン反転ホバー |
| `src/components/JobPicker.tsx` | ×ボタン反転ホバー |
| `src/components/EventModal.tsx` | ×ボタン反転ホバー |
| `src/components/PhaseModal.tsx` | ×ボタン反転ホバー（2箇所） |
| `src/components/PartySettingsModal.tsx` | ×ボタン反転ホバー |
| `src/components/JobMigrationModal.tsx` | ×ボタン反転ホバー |
| `src/locales/ja.json` | settings_title: ステータス設定 |
| `src/locales/en.json` | settings_title: Status Settings |
| `docs/TODO.md` | 整理・外部レビュー指摘追記・完了タスク移動 |
| `docs/TODO_COMPLETED.md` | 第44セッション完了タスク追加 |
| `docs/todo-review.html` | ToDo確認用HTML新規作成 |

---

## 最優先タスク（第45セッション）

### 1. auth.lopoly.appのDNS反映確認
- Firebase Console → Hosting → `auth.lopoly.app` のステータスが「接続済み」になっているか確認
- まだ「設定が必要です」なら「確認」ボタンを押す
- **反映後**: デプロイしてGoogleログインのポップアップに「auth.lopoly.app」が表示されることを確認

### 2. Firestore同期の修正（3件）
- 3分クールダウンの実装（usePlanStore.ts）
- 起動時Firestore読み込みの非ブロッキング化（useAuthStore.ts）
- forceSyncAllにタイムアウト追加

### 3. パフォーマンス最適化（視覚変更が全て完了した後）
- React.memo / useMemoの適用

### 4. public/icons/ 削除（2.1MB / 127ファイル削減）

---

## 公開までの進捗

```
全体: ████████████████████████░ 約95%完了
```

---

## 管理者ログイン情報
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
- reCAPTCHAキーID: `6LcHepssAAAAAF1yKkvARnm7Gpx3_bxbyN9iLTnV`
- Discord Webhook（管理者向け → MainDiscord）: Vercel環境変数 `DISCORD_ADMIN_WEBHOOK_URL`
- Discord Bot Token: lopo-botリポジトリの.env + Wispbyteの.env
- Firebase Storage: `lopo-7793e.firebasestorage.app`（US-CENTRAL1）
- Firebase プラン: Blaze（従量課金、予算アラート500円）
- Wispbyteアカウント: lopoly.contact@gmail.com

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内（Sidebar.tsx:268-340）
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — LandingScene.tsx:155, ParticleBackground.tsx:133（THREE.Timerに移行が必要）

## Vercel関数制限
- Hobby プラン: **12関数が上限**（現在12/12）
- 新規APIファイル追加不可。既存エンドポイントに統合する方式

## 重要な技術的注意
- **backdrop-filter直書き禁止** → `--tw-backdrop-blur` 変数パターンを使う（TECH_NOTES.md参照）
- **authDomain**: `auth.lopoly.app`（Firebase Hosting経由。直接lopoly.appにしてはいけない）
- **サイドバー・ヘッダーのCSS**: 苦労して整えた見た目なので慎重に扱う
- **×ボタンのスタイル**: 全モーダルで反転ホバー統一済み（`hover:bg-app-text hover:text-app-bg`）。新規モーダル追加時も同じパターンを使うこと
