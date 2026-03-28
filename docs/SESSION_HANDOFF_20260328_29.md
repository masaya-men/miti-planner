# セッション引き継ぎ書（2026-03-28 第29セッション）

> **このファイルは、メモリやコンテキストが完全にリセットされた場合でも、次のセッションが完璧に開始できるよう詳細に記述されている。**

---

## ★ セッション開始時の必須作業

**CLAUDE.md に全ルールが書かれている。必ず最初に読むこと。** 以下はその要約:

### 毎回必ず読むファイル
1. `docs/TODO.md` — タスク管理・進捗・設計方針（最重要）
2. `docs/TECH_NOTES.md` — 技術的な落とし穴と解決策
3. 最新の `docs/SESSION_HANDOFF_*.md` — このファイル

### 今回の最重要ドキュメント
- **`docs/管理基盤設計書.md`** — Phase 0-1実装済み、Phase 2以降の実装はこの設計書に従う

---

## プロジェクト概要（メモリ消失時のため）

- **サービス名**: LoPo（ロポ）— FF14軽減プランナー
- **本番URL**: https://lopoly.app/
- **管理画面**: https://lopoly.app/admin
- **技術スタック**: React 19 + TypeScript + Vite 7 + Tailwind CSS v4 + Zustand + Firebase + Vercel
- **Discord**: https://discord.gg/V288kfPFMG
- **Ko-fi**: https://ko-fi.com/lopoly

### ユーザーについて
- **非エンジニア**。説明は平易に。技術的な確認は不要で、意図の深掘りだけする
- 許可不要でどんどん進めてOK。ただしデザイン変更は必ず相談→承認→実装の流れ
- 常に**日本語**で会話する。コメント・ドキュメントも日本語
- 長い会話は固まるので切りの良いところで区切る

---

## 今回のセッション（第29セッション）で完了したこと

### Firebase App Check導入（コード実装）
- `src/lib/appCheck.ts` — reCAPTCHA Enterprise連携の初期化（siteKey未設定時はnull返却）
- `src/lib/apiClient.ts` — App Checkトークン付きfetchラッパー（`apiFetch`）
- `src/lib/appCheckVerify.ts` — サーバーサイドApp Check検証ミドルウェア
- 全7つのAPIエンドポイントにApp Check検証を追加（`ENFORCE_APP_CHECK`環境変数で強制モード切替）
- 全フロントエンドfetch呼び出しを`apiFetch`に置換

### マスターデータFirestore移行（Phase 1）
- `src/store/useMasterDataStore.ts` — Zustandストア + localStorageキャッシュヘルパー
- `src/hooks/useMasterData.ts` — Firestore→キャッシュ→静的ファイル フォールバックチェーン
- `src/data/contentRegistry.ts` — Firestoreデータソース対応（後方互換維持、全ヘルパー関数シグネチャ不変）
- `src/data/templateLoader.ts` — Firestore対応（`fetchTemplate`経由）
- `scripts/seed-firestore.mjs` — 初期データ投入スクリプト（実行済み: 63コンテンツ+18シリーズ+25テンプレート）

### 管理API
- `api/admin/contents/index.ts` — コンテンツCRUD（GET/POST/PUT/DELETE + バックアップ + バージョン管理 + 監査ログ）
- `api/admin/templates/index.ts` — テンプレートCRUD（同上）

### 管理画面UI
- `src/components/admin/AdminContents.tsx` — コンテンツ一覧・追加・編集・削除
- `src/components/admin/AdminContentForm.tsx` — コンテンツ入力フォーム
- `src/components/admin/AdminTemplates.tsx` — テンプレート一覧・JSONアップロード・削除
- `src/components/admin/AdminDashboard.tsx` — 統計カード表示に更新
- `src/components/admin/AdminLayout.tsx` — ナビ項目にコンテンツ管理・テンプレート管理を追加

### セキュリティ
- `firestore.rules` — `/master/*`, `/templates/*`, `/template_backups/*`, `/master_backups/*` のルール追加
- APIインポートの`.js`拡張子修正（Vercel node16 moduleResolution対応）

### インフラ・設定
- Vercelに`ADMIN_SECRET`環境変数を追加
- 管理者ロールをCustom Claimsで設定完了
- Google Cloud APIキーのウェブサイト制限に`lopo-7793e.firebaseapp.com`を追加（Googleログイン修正）

---

## 変更したファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/appCheck.ts` | **新規** — App Check初期化 |
| `src/lib/apiClient.ts` | **新規** — apiFetchラッパー |
| `src/lib/appCheckVerify.ts` | **新規** — サーバーサイドApp Check検証 |
| `src/lib/firebase.ts` | appCheckエクスポート追加 |
| `src/store/useMasterDataStore.ts` | **新規** — マスターデータZustandストア |
| `src/hooks/useMasterData.ts` | **新規** — マスターデータ初期化・取得フック |
| `src/data/contentRegistry.ts` | Firestoreデータソース対応 |
| `src/data/templateLoader.ts` | Firestore対応 |
| `src/App.tsx` | useMasterDataInit + 管理画面サブルート追加 |
| `api/admin/contents/index.ts` | **新規** — コンテンツCRUD API |
| `api/admin/templates/index.ts` | **新規** — テンプレートCRUD API |
| `api/admin/set-role.ts` | App Check検証追加 |
| `api/admin/verify.ts` | App Check検証追加 |
| `api/share/index.ts` | App Check検証追加 |
| `api/popular/index.ts` | App Check検証追加 |
| `api/auth/discord/index.ts` | App Check検証追加 |
| `api/auth/twitter/index.ts` | App Check検証追加 |
| `api/fflogs/token/index.ts` | App Check検証追加 + Edge→Node.js変更 |
| `src/components/admin/AdminContents.tsx` | **新規** — コンテンツ管理UI |
| `src/components/admin/AdminContentForm.tsx` | **新規** — コンテンツフォーム |
| `src/components/admin/AdminTemplates.tsx` | **新規** — テンプレート管理UI |
| `src/components/admin/AdminDashboard.tsx` | 統計表示に更新 |
| `src/components/admin/AdminLayout.tsx` | ナビ項目追加 |
| `src/components/PopularPage.tsx` | apiFetch置換 |
| `src/components/ShareModal.tsx` | apiFetch置換 |
| `src/components/SharePage.tsx` | apiFetch置換 |
| `src/api/fflogs.ts` | apiFetch置換 |
| `src/locales/ja.json` | 管理画面i18nキー追加 |
| `src/locales/en.json` | 管理画面i18nキー追加 |
| `firestore.rules` | マスターデータ・テンプレート用ルール追加 |
| `scripts/seed-firestore.mjs` | **新規** — Firestore初期データ投入 |

---

## ★ 次回の最優先タスク

1. **Firebase App Check有効化** — Firebase ConsoleでreCAPTCHA Enterpriseを設定 → サイトキーをVercelの`VITE_RECAPTCHA_ENTERPRISE_SITE_KEY`に追加
2. **Firestoreセキュリティルールのデプロイ** — Firebase Consoleで`firestore.rules`の内容を貼り付け → 公開
3. **管理画面の実機テスト** — コンテンツ追加/編集/削除、テンプレートアップロード/削除
4. **アプリ動作速度の調査・改善** — ログアウトが遅い問題
5. **モーダルの見やすさ向上**
6. **アクセントカラーの導入（要相談）**

---

## 未完了の注意事項

- **Firebase App Checkは未強制** — `ENFORCE_APP_CHECK`環境変数を`true`にするまで、トークンなしのリクエストも通る（段階的導入のため）
- **Firestoreセキュリティルール未デプロイ** — コードは更新済みだがFirebase Consoleへの反映が必要
- **fflogs/token APIがEdge→Node.jsに変更** — App Check検証にAdmin SDKが必要なため。コールドスタートが遅くなる可能性あり
- **本番デプロイはVercel CLI経由** — `vercel --prod`で直接デプロイ済み。GitHubのmainブランチもpush済みなので次回のVercel自動デプロイでも反映される

---

## 既知のコンソールエラー（未対応・既存）
- `<button> cannot be a descendant of <button>` — サイドバーのContentTreeItem内
- `<path> attribute d: Expected number` — SVGパスにcalc()や%が入っている箇所
- `THREE.Clock非推奨警告` — THREE.Timerに移行が必要（動作には影響なし）

---

## 管理者ログイン情報（Discord管理者チャンネルに保存済み）
- ADMIN_SECRET: Vercel環境変数に設定済み
- 管理者UID: `（旧管理者UID）`（Googleログイン）
- 管理画面URL: https://lopoly.app/admin
