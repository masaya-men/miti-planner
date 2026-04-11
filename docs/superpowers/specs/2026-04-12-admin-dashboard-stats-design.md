# 管理ダッシュボード統計 + 外部リンク

## 概要

既存の管理ダッシュボード（AdminDashboard.tsx）の最上部に、ユーザー数・プラン数の統計カードと外部リンク集を追加する。

## 方針

- コスト最小: Firestore `count()` 集計のみ（1リクエスト2読み取り）
- 日本語ハードコード（管理者専用、i18n不要）
- 既存APIパターン（`?resource=dashboard`）に統合

## 変更ファイル

### 1. `api/admin/_dashboardHandler.ts`（新規）

```
GET /api/admin?resource=dashboard
→ { userCount: number, planCount: number }
```

- `verifyAdmin(req)` で認証
- Firestore `users` コレクション `count()` → ユーザー数
- Firestore `plans` コレクション `count()` → プラン数

### 2. `api/admin/index.ts`

switch に `case 'dashboard'` を1行追加。

### 3. `src/components/admin/AdminDashboard.tsx`

h1タイトル直下、アクションカードの上に2セクション追加:

**統計カード（2枚横並び）**
- 「ユーザー数」「プラン数」— 大きな数字表示
- ローディング中は「—」
- 既存アクションカードと同じスタイル

**外部リンク（3つ横並び）**
- Firebase Console / Google Analytics / Vercel Dashboard
- テキストリンク、`target="_blank"`
- URLはハードコード（セキュリティ調査済み: 既に公開情報のみ）

## セキュリティ

- 統計APIは `verifyAdmin` 認証必須
- 外部リンクURLに含まれる情報（projectId, measurementId）は既にクライアントコードで公開済み
- Vercel チーム名/プロジェクト名の露出は極低リスク
