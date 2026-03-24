# セッション引き継ぎ書（2026-03-25 第6セッション）

## ★ セッション開始時の必須作業
**毎回のセッション開始時に、`docs/` フォルダ内の全計画書・設計書を必ず読むこと。**
CLAUDE.md の「セッション開始時の必須作業」セクションに一覧がある。
特に `docs/TODO.md` は最新の進捗・方針が集約されているため、最初に必ず確認する。

---

## 今回のセッションで完了したこと

### 1. Firestoreプラン保存の実装【最重要タスク完了】
- **新規ファイル**: `src/lib/planService.ts`
  - Firestore CRUD（fetchUserPlans / createPlan / updatePlan / deletePlan）
  - SavedPlan ⇔ FirestorePlan 型変換ヘルパー
  - ログイン時マイグレーション（localStorage → Firestore マージ）
  - dirtyプラン一括同期（syncDirtyPlans）
  - バッチ書き込み（プラン + カウンター同時更新）
  - プラン上限チェック（クライアント側の事前チェック）

- **改修ファイル**: `src/store/usePlanStore.ts`
  - `_dirtyPlanIds` / `_deletedPlanIds` — dirty flag追跡
  - `syncToFirestore()` — dirtyプランをFirestoreに同期
  - `migrateOnLogin()` — ログイン時にlocalStorageとFirestoreをマージ
  - `deleteFromFirestore()` — 削除の即時Firestore反映
  - `hasDirtyPlans()` — dirty判定
  - `partialize` — Firestore同期用の内部状態をlocalStorageから除外

- **改修ファイル**: `src/components/Layout.tsx`
  - 自動保存にFirestore同期を統合
  - localStorage: 30秒間隔（従来通り）
  - Firestore: 3分間隔 + タブ切替 + ページ離脱（ログイン時のみ）
  - `useAuthStore` を参照してログイン時のみ同期
  - ログイン検知 → `migrateOnLogin()` を1回だけ実行

### 2. プライバシーポリシー・利用規約ページ
- **新規ファイル**: `src/components/LegalPage.tsx`
  - `PrivacyPolicyPage` / `TermsPage` の2コンポーネント
  - 共用 `LegalPageLayout`（ヘッダー/フッター/テーマ切替/言語切替）
  - `body` の `overflow-hidden` を一時的に解除してスクロール可能に
  - 白黒デザイン準拠

- **ルーティング**: `src/App.tsx` に `/privacy`, `/terms` 追加
- **フッターリンク**: `Layout.tsx` と `PortalPage.tsx` の両方に追加
- **i18n**: `src/locales/ja.json` / `en.json` に `legal` セクション追加（全文日英対応）
- **内容**: LoPo全体（軽減プランナー + ハウジングツアープランナー等）として記載
  - 収集する情報 / 収集しない情報（メールアドレス非保存を明記）
  - Firebase利用、asia-northeast1リージョン
  - ユーザーの権利（閲覧・編集・削除・アカウント削除）
  - 利用規約: 著作権・免責事項・禁止事項

### 3. プラン件数制限
- **制限値**:
  - 1コンテンツあたり: 5件
  - 合計: 50件（ハードリミット）
  - 30件超: アーカイブ警告表示

- **NewPlanModal** (`src/components/NewPlanModal.tsx`):
  - `PLAN_LIMITS` による件数チェック（合計 + コンテンツ別）
  - 上限到達時: 警告メッセージ + 作成ボタン無効化
  - 30件超: 「現行零式・絶以外の古い軽減表は自動的に圧縮保存されます」警告

- **Sidebar** (`src/components/Sidebar.tsx`):
  - コンテンツクリック時に件数チェック
  - 上限到達時: alert で通知 + 作成中断
  - チュートリアル中はチェックスキップ

- **定数**: `src/types/firebase.ts` に `ARCHIVE_WARNING_THRESHOLD: 30` 追加

### 4. Skillプラグインのインストール
ユーザーがCLIで以下をインストール済み:
- `superpowers` — コーディングワークフロー自動化
- `planning-with-files` — ファイルベース計画管理
- `anthropics/skills` — 公式スキル集

---

## 公開前タスクの完了状況

### ✅ 全て完了 — 公開可能
1. ~~Firestoreプラン保存~~ → 完了（今回）
2. ~~プライバシーポリシー・利用規約~~ → 完了（今回）
3. ~~プラン件数制限~~ → 完了（今回）
4. ~~セキュリティ修正4件~~ → 完了（前回セッション）
5. ~~デバッグコード削除~~ → 完了（前回セッション）
6. ~~crypto.randomUUIDフォールバック~~ → 完了（前回セッション）

**デプロイ済み**: `git push origin main` → Vercel自動デプロイ

---

## 次回以降のタスク（優先順）

### 高優先
- [ ] **Firestoreセキュリティルールのデプロイ確認** — `firestore.rules` ファイルは存在するが、Firebaseにデプロイ済みか未確認。`firebase deploy --only firestore:rules` を実行すべき
- [ ] **ログイン時のFirestoreマイグレーション動作確認** — 実際にログインしてプランがFirestoreに保存されるか確認
- [ ] **スマホ対応の追加改善** — AA設定のモバイルアクセス、タッチ操作改善

### 中優先
- [ ] 古いプランの自動アーカイブ実装（Cloud Functions必要）
- [ ] プラン削除UIの改善
- [ ] 保存状態インジケータ（「保存済み ✓」表示）
- [ ] SA法オートプランナー改善

### 将来
- [ ] App Check導入（reCAPTCHA v3でボット防止）
- [ ] ハウジングツアープランナー
- [ ] トップページのデザイン作り込み
- [ ] 収益化検討（プラン上限拡張等）

---

## 重要な技術的知識

### 保存アーキテクチャ（2層構造・実装完了）
```
localStorage（常時・無音）
├── plan-storage — usePlanStore（プラン一覧）
│   ├── 30秒間隔で自動保存
│   └── タブ切替・離脱時にも保存
├── mitigation-storage — useMitigationStore（現在編集中）
└── theme-storage — useThemeStore（テーマ・言語）

Firestore（間引き・ログインユーザーのみ）
├── plans/{planId} — プランのフルデータ
│   ├── 3分間隔で dirty プランのみ同期
│   ├── タブ切替・離脱時にも同期
│   └── dirty flag 方式（変更のあったプランだけ書き込み）
├── userPlanCounts/{uid} — プラン数カウンター
├── users/{uid} — ユーザープロファイル（未実装）
└── sharedPlanMeta/{shareId} — 共有メタ（既存の共有機能で使用中）
```

### Firestore同期のフロー
```
1. ユーザーがプランを編集
2. usePlanStore.updatePlan() → localStorage に即保存 + _dirtyPlanIds に追加
3. 3分経過 or タブ切替 or 離脱時:
   Layout.tsx の syncToCloud() が発火
   → useAuthStore.user が存在する場合のみ
   → usePlanStore.syncToFirestore(uid, displayName) を実行
   → planService.syncDirtyPlans() で dirty プランを Firestore に書き込み
   → _dirtyPlanIds をクリア
4. 未ログイン時: Firestore 書き込みゼロ（従来通り）
```

### ログイン時のマイグレーション
```
1. Layout.tsx が authUser の変化を検知
2. usePlanStore.migrateOnLogin(uid, displayName) を1回だけ実行
3. planService.migrateLocalPlansToFirestore():
   a. Firestore から既存プランを取得
   b. localStorage にしかないプランを Firestore にアップロード
   c. Firestore にしかないプラン（別端末で作成）を localStorage にマージ
   d. 両方にあるプランは updatedAt が新しい方を採用
4. マージ結果で usePlanStore.plans を上書き
```

### プラン件数制限
```
PLAN_LIMITS (src/types/firebase.ts):
- MAX_TOTAL_PLANS: 50
- MAX_PLANS_PER_CONTENT: 5
- ARCHIVE_WARNING_THRESHOLD: 30

チェック箇所:
- NewPlanModal: 作成ボタン無効化 + 警告UI
- Sidebar: コンテンツクリック時に alert + 中断
- planService: Firestore書き込み時にも事前チェック
- firestore.rules: セキュリティルールでも上限を強制
```

### ファイル変更一覧（今回のセッション）

| ファイル | 変更内容 |
|---------|---------|
| `src/lib/planService.ts` | **新規** Firestore CRUD + マイグレーション |
| `src/components/LegalPage.tsx` | **新規** プライバシーポリシー + 利用規約ページ |
| `src/store/usePlanStore.ts` | dirty flag + Firestore同期 + partialize |
| `src/components/Layout.tsx` | 自動保存にFirestore同期統合 + ログイン時マイグレーション |
| `src/components/NewPlanModal.tsx` | 件数制限チェック + 警告UI |
| `src/components/Sidebar.tsx` | コンテンツクリック時の件数チェック |
| `src/App.tsx` | /privacy, /termsルーティング追加 |
| `src/components/PortalPage.tsx` | フッターにリンク追加 |
| `src/locales/ja.json` | legal + footer + new_plan の i18nキー追加 |
| `src/locales/en.json` | 同上（英語版） |
| `src/types/firebase.ts` | ARCHIVE_WARNING_THRESHOLD追加 |
| `docs/TODO.md` | 完了タスク記録・方針更新 |
