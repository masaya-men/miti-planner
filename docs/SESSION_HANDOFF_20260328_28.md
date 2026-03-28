# セッション引き継ぎ書（2026-03-28 第28セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。** 以下はその要約:

### 毎回必ず読むファイル
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 今回の最重要ドキュメント
- **`docs/管理基盤設計書.md`** — 管理基盤・マスターデータFirestore移行の完全な設計書（1040行）。Phase 0実装済み、Phase 1以降の実装はこの設計書に従う

### スキル使用ルール（CLAUDE.mdに追加済み）
- 利用可能なスキルは必ず適宜使用すること
- 新機能: brainstorming → writing-plans → subagent-driven-development の流れ
- バグ修正: systematic-debugging
- 既に設計書がある場合: writing-plansから開始OK

---

## プロジェクト概要（メモリ消失時のため）

- **サービス名**: LoPo（ロポ）— FF14軽減プランナー
- **本番URL**: https://lopoly.app/
- **リポジトリ**: https://github.com/masaya-men/miti-planner
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

### ユーザーについて
- **非エンジニア**。説明は平易に。技術的な確認は不要で、意図の深掘りだけする
- 許可不要でどんどん進めてOK。ただしデザイン変更は必ず相談→承認→実装の流れ
- 常に**日本語**で会話する。コメント・ドキュメントも日本語
- 長い会話は固まるので切りの良いところで区切る

### 重要なルール
- **色のルール**: UIデザイン整え中。現在は白黒のみ（アクセントカラーは次の検討事項）
- **i18n**: UIテキストは必ずi18nキー経由。ハードコーディング禁止
- **CSS**: `backdrop-filter: blur(...)` を直接書くな → `--tw-backdrop-blur` 変数パターンを使う
- **AIデザイン禁止**: AIグラデーション、Interフォント、Lucideアイコンのみ、shadcnデフォルトそのまま → 全部禁止

---

## 今回のセッション（第28セッション）で完了したこと

### 管理基盤 Phase 0 実装（全12タスク）

**セキュリティ基盤:**
- `src/lib/adminAuth.ts` — Firebase Admin SDK初期化+トークン検証の共通ヘルパー
- `src/lib/rateLimit.ts` — IPベースのインメモリAPIレート制限
- `src/lib/auditLog.ts` — 管理操作の監査ログ書き込みヘルパー
- `firestore.rules` — `/admin_logs`コレクションのルール追加（管理者のみ読み取り可）

**管理API:**
- `api/admin/set-role.ts` — Custom Claims設定API（ADMIN_SECRET or 管理者トークン認証）
- `api/admin/verify.ts` — フロントエンド用の管理者権限確認API
- 両APIにCORSホワイトリスト適用（既存share APIと同じパターン）

**管理画面:**
- `src/components/admin/AdminGuard.tsx` — ルートガード（非管理者はトップにリダイレクト）
- `src/components/admin/AdminLayout.tsx` — サイドナビ+メインエリアのレイアウト
- `src/components/admin/AdminDashboard.tsx` — Phase 0ダッシュボード（骨組み）
- `src/App.tsx` — `/admin` ルート追加

**プラン複製機能:**
- `src/store/usePlanStore.ts` — `duplicatePlan()` メソッド追加（件数制限チェック+dirtyフラグ+連番タイトル）
- `src/components/Sidebar.tsx` — アクティブプランの横にCopyアイコン追加

**GoogleログインPWA対応:**
- `src/store/useAuthStore.ts` — `isAdmin`フラグ追加 + standalone時のみsignInWithRedirectに切り替え + getRedirectResult処理

**i18n:**
- `src/locales/ja.json` / `en.json` — `admin.*`セクション + `sidebar.duplicate_plan` + `common.loading` 追加

### コードレビューで修正した内容
- CORSを`req.headers.origin || '*'`からホワイトリスト方式に変更（セキュリティ修正）
- AdminGuardの「Loading...」をi18nキー `common.loading` に変更
- set-role.tsの未使用import `getAdminFirestore` を削除
- 英語ツールチップから不自然な "just" を削除

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/adminAuth.ts` | **新規** — Admin SDK共通基盤 |
| `src/lib/rateLimit.ts` | **新規** — APIレート制限 |
| `src/lib/auditLog.ts` | **新規** — 監査ログ |
| `api/admin/set-role.ts` | **新規** — 管理者ロール付与API |
| `api/admin/verify.ts` | **新規** — 管理者権限検証API |
| `src/components/admin/AdminGuard.tsx` | **新規** — ルートガード |
| `src/components/admin/AdminLayout.tsx` | **新規** — 管理画面レイアウト |
| `src/components/admin/AdminDashboard.tsx` | **新規** — ダッシュボード |
| `src/App.tsx` | `/admin`ルート追加 |
| `src/store/useAuthStore.ts` | isAdmin + PWAログイン |
| `src/store/usePlanStore.ts` | duplicatePlan追加 |
| `src/components/Sidebar.tsx` | 複製ボタン追加 |
| `src/locales/ja.json` | admin + duplicate + loading キー |
| `src/locales/en.json` | 同上（英語） |
| `firestore.rules` | admin_logsルール追加 |
| `CLAUDE.md` | スキル使用ルール追加、設計書ステータス更新 |
| `docs/TODO.md` | Phase 0完了、管理者ログイン手順追記 |

---

## ★ 次回の最優先タスク

1. **管理者ロール初回セットアップ** — ADMIN_SECRETをVercelに設定 → APIで自分を管理者に設定 → /admin動作確認
   - 手順は `docs/TODO.md` の「管理者ログイン手順（初回セットアップ）」に詳細記載

2. **Firebase App Check導入** — Firebase ConsoleでreCAPTCHA v3を設定 → コードに組み込み

3. **管理基盤 Phase 1 実装開始** — コンテンツ・テンプレートのFirestore化（設計書: `docs/管理基盤設計書.md`）

4. **モーダルの見やすさ向上** — 各モーダルの視認性・統一感を改善

5. **アクセントカラーの導入** — 白黒ベースが整ったので次のステップ（必ずユーザーと相談）

---

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

---

## セッション終了時のクリーンアップルール（CLAUDE.mdに記載済み）
1. 古い引き継ぎ書削除（最新1つだけ残す）
2. TODO.mdの完了タスクをTODO_COMPLETED.mdに移動（コードで裏取りしてから）
3. 軽微な整理（取り消し線・空行重複）
4. 引き継ぎ用メッセージをチャットに出力（ユーザーがコピペできる形で）
