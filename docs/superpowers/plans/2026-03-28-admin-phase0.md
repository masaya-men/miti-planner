# 管理基盤 Phase 0 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面の認証基盤・セキュリティ・独立した小機能（プラン複製・PWAログイン対応）を構築する

**Architecture:** Firebase Custom Claimsで管理者ロールを制御し、Vercel API経由でのみ管理操作を許可。フロントエンドに`/admin`ルートを追加し、ルートガード付きの管理画面骨組みを構築。独立機能（プラン複製・PWAログイン）は既存コンポーネントへの追加で実装。

**Tech Stack:** React 19, React Router v7, Zustand, Firebase Auth (Custom Claims), firebase-admin v13, Vercel Serverless Functions, i18next

**設計書:** `docs/管理基盤設計書.md`（承認済み）

---

## ファイル構成

### 新規作成ファイル

| ファイル | 責務 |
|---------|------|
| `api/admin/set-role.ts` | 管理者ロール付与API（Custom Claims設定） |
| `api/admin/verify.ts` | 管理者権限検証API（フロント起動時の確認用） |
| `src/components/admin/AdminLayout.tsx` | 管理画面のレイアウト（サイドナビ+メインエリア） |
| `src/components/admin/AdminDashboard.tsx` | 管理画面ダッシュボード（Phase 0では空の状態） |
| `src/components/admin/AdminGuard.tsx` | ルートガード（admin権限チェック） |
| `src/lib/adminAuth.ts` | 管理者認証ヘルパー（API側のAdmin SDK初期化+検証） |
| `src/lib/rateLimit.ts` | APIレート制限ユーティリティ |
| `src/lib/auditLog.ts` | 監査ログ書き込みヘルパー |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/App.tsx` | `/admin/*` ルート追加 |
| `src/store/useAuthStore.ts` | `isAdmin`フラグ追加、PWAログイン分岐 |
| `src/store/usePlanStore.ts` | `duplicatePlan()` メソッド追加 |
| `src/components/Sidebar.tsx` | プラン複製ボタン追加 |
| `src/locales/ja.json` | 管理画面・複製機能のi18nキー追加 |
| `src/locales/en.json` | 同上（英語） |
| `firestore.rules` | `/admin_logs`コレクションのルール追加 |

---

## Task 1: 管理者認証ヘルパー（API共通基盤）

**Files:**
- Create: `src/lib/adminAuth.ts`

全ての管理APIで使うFirebase Admin SDK初期化とトークン検証を1箇所にまとめる。既存の`api/share/index.ts`の`initAdmin()`パターンを踏襲。

- [ ] **Step 1: `src/lib/adminAuth.ts` を作成**

```typescript
/**
 * 管理者認証ヘルパー
 * 全ての管理APIで共通して使うFirebase Admin SDK初期化とトークン検証
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/** Firebase Admin SDKを初期化（既に初期化済みならスキップ） */
export function initAdmin() {
  if (!getApps().length) {
    let pk = process.env.FIREBASE_PRIVATE_KEY ?? '';
    if (pk.startsWith('"')) { try { pk = JSON.parse(pk); } catch {} }
    pk = pk.replace(/\\n/g, '\n');
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: pk,
      }),
    });
  }
}

/** リクエストからBearerトークンを抽出 */
function extractToken(req: any): string | null {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * リクエストの送信者が管理者かどうかを検証
 * @returns 管理者のUID（検証成功時）、null（失敗時）
 */
export async function verifyAdmin(req: any): Promise<string | null> {
  const token = extractToken(req);
  if (!token) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (decoded.role === 'admin') {
      return decoded.uid;
    }
    return null;
  } catch {
    return null;
  }
}

/** Firestore管理者用インスタンスを取得 */
export function getAdminFirestore() {
  return getFirestore();
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/adminAuth.ts
git commit -m "feat: 管理者認証ヘルパー（Admin SDK初期化+トークン検証）"
```

---

## Task 2: APIレート制限ユーティリティ

**Files:**
- Create: `src/lib/rateLimit.ts`

IPベースのインメモリレート制限。Vercel Serverless Functionsは起動ごとにリセットされるが、短時間の連射攻撃には有効。

- [ ] **Step 1: `src/lib/rateLimit.ts` を作成**

```typescript
/**
 * APIレート制限ユーティリティ
 * IPアドレスごとにリクエスト数を制限する
 * Vercel Serverless Functions用（インメモリ・インスタンス単位）
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** 古いエントリを定期的にクリーンアップ（メモリリーク防止） */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

// 5分ごとにクリーンアップ
setInterval(cleanup, 5 * 60 * 1000);

/**
 * レート制限チェック
 * @param ip クライアントのIPアドレス
 * @param maxRequests ウィンドウあたりの最大リクエスト数（デフォルト: 10）
 * @param windowMs ウィンドウの長さ（ミリ秒、デフォルト: 60秒）
 * @returns true = 許可, false = 制限超過
 */
export function checkRateLimit(
  ip: string,
  maxRequests = 10,
  windowMs = 60_000,
): boolean {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }

  entry.count++;
  if (entry.count > maxRequests) {
    return false;
  }
  return true;
}

/**
 * Vercel APIハンドラーにレート制限を適用するヘルパー
 * @returns true = リクエスト続行OK, false = 429を返した（ハンドラーは即return）
 */
export function applyRateLimit(req: any, res: any, maxRequests = 10, windowMs = 60_000): boolean {
  const ip = (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(ip, maxRequests, windowMs)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }
  return true;
}
```

- [ ] **Step 2: コミット**

```bash
git add src/lib/rateLimit.ts
git commit -m "feat: APIレート制限ユーティリティ（IPベース・インメモリ）"
```

---

## Task 3: 監査ログ基盤

**Files:**
- Create: `src/lib/auditLog.ts`
- Modify: `firestore.rules`

管理操作の記録を`/admin_logs`コレクションに書き込むヘルパー。

- [ ] **Step 1: `src/lib/auditLog.ts` を作成**

```typescript
/**
 * 監査ログ書き込みヘルパー
 * 管理操作をFirestoreの /admin_logs コレクションに記録する
 * サーバーサイド（Vercel API）からのみ使用
 */
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export type AuditAction = 'create' | 'update' | 'delete' | 'set_role';

interface AuditLogEntry {
  action: AuditAction;
  target: string;
  adminUid: string;
  changes?: { before?: unknown; after?: unknown };
}

/**
 * 監査ログを1件書き込む
 * Admin SDKが初期化済みであること（initAdmin()呼び出し後）
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const db = getFirestore();
  await db.collection('admin_logs').add({
    ...entry,
    timestamp: FieldValue.serverTimestamp(),
  });
}
```

- [ ] **Step 2: `firestore.rules` に `/admin_logs` ルールを追加**

既存ルールの末尾（最後の `}` の直前）に以下を追加:

```javascript
    // 監査ログ: 管理者のみ読める・直接書き込み不可（API経由のみ）
    match /admin_logs/{logId} {
      allow read: if request.auth != null && request.auth.token.role == 'admin';
      allow write: if false;
    }
```

- [ ] **Step 3: コミット**

```bash
git add src/lib/auditLog.ts firestore.rules
git commit -m "feat: 監査ログ基盤（/admin_logs コレクション + Firestoreルール）"
```

---

## Task 4: 管理者ロール付与API

**Files:**
- Create: `api/admin/set-role.ts`

Firebase Custom Claimsで`role: 'admin'`を設定するAPI。秘密キー（`ADMIN_SECRET`環境変数）で保護。

- [ ] **Step 1: `api/admin/set-role.ts` を作成**

```typescript
/**
 * 管理者ロール付与API
 * POST /api/admin/set-role
 *
 * Body: { uid: string, role: 'admin' | null, secret: string }
 * - uid: 対象ユーザーのFirebase UID
 * - role: 'admin' で付与、null で剥奪
 * - secret: ADMIN_SECRET 環境変数と一致する秘密キー
 *
 * セキュリティ: ADMIN_SECRET による保護（初回設定用）
 * 2人目以降の管理者追加は、既存管理者のトークン認証でも可能
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth';
import { writeAuditLog } from '../../src/lib/auditLog';
import { applyRateLimit } from '../../src/lib/rateLimit';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: any, res: any) {
  // CORSヘッダー
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // レート制限（1分あたり5回まで）
  if (!applyRateLimit(req, res, 5, 60_000)) return;

  try {
    initAdmin();

    const { uid, role, secret } = req.body || {};

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'uid is required' });
    }

    if (role !== 'admin' && role !== null) {
      return res.status(400).json({ error: 'role must be "admin" or null' });
    }

    // 認証: ADMIN_SECRET または既存管理者のトークン
    let authorizedBy = 'secret';
    const adminSecret = process.env.ADMIN_SECRET;

    if (secret && adminSecret && secret === adminSecret) {
      // 秘密キー認証（初回セットアップ用）
      authorizedBy = 'secret';
    } else {
      // 既存管理者のトークン認証
      const adminUid = await verifyAdmin(req);
      if (!adminUid) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      authorizedBy = adminUid;
    }

    // Custom Claimsを設定
    const claims = role === 'admin' ? { role: 'admin' } : {};
    await getAuth().setCustomUserClaims(uid, claims);

    // 監査ログ
    await writeAuditLog({
      action: 'set_role',
      target: `user.${uid}`,
      adminUid: authorizedBy,
      changes: { after: { role } },
    });

    return res.status(200).json({ success: true, uid, role });
  } catch (err: any) {
    console.error('set-role error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add api/admin/set-role.ts
git commit -m "feat: 管理者ロール付与API（Custom Claims + 監査ログ）"
```

---

## Task 5: 管理者権限検証API

**Files:**
- Create: `api/admin/verify.ts`

フロントエンドが管理者かどうかを確認するための軽量API。

- [ ] **Step 1: `api/admin/verify.ts` を作成**

```typescript
/**
 * 管理者権限検証API
 * GET /api/admin/verify
 *
 * Headers: Authorization: Bearer <idToken>
 * Response: { isAdmin: boolean }
 *
 * フロントエンドが管理画面へのアクセス可否を判定するために使用
 */
import { initAdmin, verifyAdmin } from '../../src/lib/adminAuth';
import { applyRateLimit } from '../../src/lib/rateLimit';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', req.headers?.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!applyRateLimit(req, res, 20, 60_000)) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    return res.status(200).json({ isAdmin: adminUid !== null });
  } catch (err: any) {
    console.error('admin verify error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 2: コミット**

```bash
git add api/admin/verify.ts
git commit -m "feat: 管理者権限検証API（/api/admin/verify）"
```

---

## Task 6: useAuthStoreに管理者フラグ追加

**Files:**
- Modify: `src/store/useAuthStore.ts`

`isAdmin`フラグを追加し、ログイン時にCustom Claimsから判定。

- [ ] **Step 1: AuthState型に`isAdmin`を追加**

`src/store/useAuthStore.ts` の `AuthState` インターフェースに追加:

```typescript
interface AuthState {
    user: User | null;
    loading: boolean;
    isAdmin: boolean;  // ← 追加
    justLoggedInUser: JustLoggedInUser | null;
    signInWith: (provider: AuthProvider) => void;
    signOut: () => Promise<void>;
    deleteAccount: () => Promise<void>;
    clearJustLoggedIn: () => void;
}
```

初期値:
```typescript
export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,
    isAdmin: false,  // ← 追加
    justLoggedInUser: null,
    // ...
```

- [ ] **Step 2: onAuthStateChanged内でCustom Claimsを確認**

ファイル末尾の`onAuthStateChanged`コールバック内で、ユーザーのIDトークンからCustom Claimsを取得:

```typescript
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Custom Claimsから管理者フラグを取得
        const tokenResult = await user.getIdTokenResult();
        const isAdmin = tokenResult.claims.role === 'admin';
        useAuthStore.setState({ user, loading: false, isAdmin });
    } else {
        useAuthStore.setState({ user: null, loading: false, isAdmin: false });
    }
    // ... 既存のprocessPendingAuth等はそのまま
});
```

- [ ] **Step 3: signOut時にisAdminをリセット**

```typescript
signOut: async () => {
    // ... 既存の同期処理 ...
    await firebaseSignOut(auth);
    set({ user: null, isAdmin: false });  // isAdmin追加
    // ...
},
```

- [ ] **Step 4: コミット**

```bash
git add src/store/useAuthStore.ts
git commit -m "feat: useAuthStoreにisAdmin管理者フラグ追加（Custom Claims連携）"
```

---

## Task 7: 管理画面のルートガード + レイアウト + ダッシュボード

**Files:**
- Create: `src/components/admin/AdminGuard.tsx`
- Create: `src/components/admin/AdminLayout.tsx`
- Create: `src/components/admin/AdminDashboard.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: `src/components/admin/AdminGuard.tsx` を作成**

```typescript
/**
 * 管理画面ルートガード
 * admin権限がないユーザーはトップページにリダイレクト
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-app-bg text-app-text">
        <div className="text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: `src/components/admin/AdminLayout.tsx` を作成**

```typescript
/**
 * 管理画面レイアウト
 * サイドナビゲーション + メインコンテンツエリア
 * Phase 0では骨組みのみ。Phase 1以降でセクションを追加
 */
import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';

const NAV_ITEMS = [
  { path: '/admin', labelKey: 'admin.dashboard', end: true },
  // Phase 1以降で追加:
  // { path: '/admin/contents', labelKey: 'admin.contents' },
  // { path: '/admin/templates', labelKey: 'admin.templates' },
  // { path: '/admin/skills', labelKey: 'admin.skills' },
] as const;

export function AdminLayout() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-screen bg-app-bg text-app-text">
      {/* サイドナビ */}
      <nav className="w-56 border-r border-app-text/10 flex flex-col">
        <div className="p-4 border-b border-app-text/10">
          <div className="text-sm font-bold">LoPo Admin</div>
          <div className="text-[10px] text-app-text-muted truncate mt-1">
            {user?.displayName || user?.email || 'Admin'}
          </div>
        </div>
        <div className="flex-1 p-2 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-app-text/10 font-bold'
                    : 'hover:bg-app-text/5'
                }`
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
        <div className="p-2 border-t border-app-text/10">
          <NavLink
            to="/miti"
            className="block px-3 py-2 rounded text-xs text-app-text-muted hover:bg-app-text/5 transition-colors"
          >
            ← {t('admin.back_to_app')}
          </NavLink>
        </div>
      </nav>
      {/* メインコンテンツ */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: `src/components/admin/AdminDashboard.tsx` を作成**

```typescript
/**
 * 管理画面ダッシュボード
 * Phase 0: 管理画面が動作していることの確認用
 * Phase 1以降: 統計情報やクイックアクションを追加
 */
import { useTranslation } from 'react-i18next';

export function AdminDashboard() {
  const { t } = useTranslation();

  return (
    <div>
      <h1 className="text-lg font-bold mb-4">{t('admin.dashboard')}</h1>
      <p className="text-sm text-app-text-muted">
        {t('admin.dashboard_placeholder')}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: `src/App.tsx` に `/admin` ルートを追加**

インポートを追加:
```typescript
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
```

Routes内、キャッチオール(`path="*"`)の直前に追加:
```typescript
            {/* 管理画面 */}
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route index element={<AdminDashboard />} />
            </Route>
```

- [ ] **Step 5: コミット**

```bash
git add src/components/admin/AdminGuard.tsx src/components/admin/AdminLayout.tsx src/components/admin/AdminDashboard.tsx src/App.tsx
git commit -m "feat: 管理画面の骨組み（/admin ルート + ルートガード + レイアウト）"
```

---

## Task 8: i18nキー追加（管理画面 + プラン複製）

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: `ja.json` にキーを追加**

トップレベルに `"admin"` と `"sidebar"` 内に `"duplicate_plan"` 関連を追加:

```json
{
  "admin": {
    "dashboard": "ダッシュボード",
    "dashboard_placeholder": "管理機能はPhase 1以降で追加されます。",
    "back_to_app": "アプリに戻る"
  },
  "sidebar": {
    "duplicate_plan": "すぐ下にコピーを作成",
    "duplicate_limit_reached": "プラン数の上限に達しています"
  }
}
```

注: `sidebar` セクションが既に存在する場合はマージする。`admin`セクションは新規追加。

- [ ] **Step 2: `en.json` にキーを追加**

```json
{
  "admin": {
    "dashboard": "Dashboard",
    "dashboard_placeholder": "Admin features will be added in Phase 1.",
    "back_to_app": "Back to app"
  },
  "sidebar": {
    "duplicate_plan": "Create a copy just below",
    "duplicate_limit_reached": "Plan limit reached"
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: i18nキー追加（管理画面 + プラン複製）"
```

---

## Task 9: プラン複製機能（ストア）

**Files:**
- Modify: `src/store/usePlanStore.ts`

`duplicatePlan(planId)` メソッドを追加。設計書に従い、直下にコピーを作成。

- [ ] **Step 1: `usePlanStore` に `duplicatePlan` を追加**

PlanState インターフェースに追加:
```typescript
duplicatePlan: (planId: string) => SavedPlan | null;
```

実装:
```typescript
duplicatePlan: (planId) => {
  const state = get();
  const source = state.plans.find(p => p.id === planId);
  if (!source) return null;

  // 件数制限チェック
  const totalPlans = state.plans.length;
  if (totalPlans >= PLAN_LIMITS.MAX_TOTAL_PLANS) return null;

  if (source.contentId) {
    const contentPlans = state.plans.filter(p => p.contentId === source.contentId);
    if (contentPlans.length >= PLAN_LIMITS.MAX_PLANS_PER_CONTENT) return null;
  }

  // 連番サフィックス生成: "M1S" → "M1S (2)", "M1S (2)" → "M1S (3)"
  const baseTitle = source.title.replace(/\s*\(\d+\)$/, '');
  const existingNumbers = state.plans
    .filter(p => p.title.startsWith(baseTitle))
    .map(p => {
      const match = p.title.match(/\((\d+)\)$/);
      return match ? parseInt(match[1], 10) : 1;
    });
  const nextNumber = Math.max(...existingNumbers, 1) + 1;
  const newTitle = `${baseTitle} (${nextNumber})`;

  const newPlan: SavedPlan = {
    ...structuredClone(source),
    id: `plan_${Date.now()}`,
    title: newTitle,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isPublic: false,
    copyCount: 0,
    useCount: 0,
  };

  // ソースプランの直後に挿入
  const sourceIndex = state.plans.findIndex(p => p.id === planId);
  const newPlans = [...state.plans];
  newPlans.splice(sourceIndex + 1, 0, newPlan);

  set({ plans: newPlans });
  return newPlan;
},
```

- [ ] **Step 2: コミット**

```bash
git add src/store/usePlanStore.ts
git commit -m "feat: プラン複製機能（usePlanStore.duplicatePlan）"
```

---

## Task 10: プラン複製ボタン（Sidebar UI）

**Files:**
- Modify: `src/components/Sidebar.tsx`

アクティブなプラン行のPencilアイコンの隣にCopyアイコンを追加。

- [ ] **Step 1: Sidebar.tsx にインポートを追加**

lucide-reactから`Copy`をインポートに追加:
```typescript
import { ..., Copy } from 'lucide-react';
```

usePlanStoreから`duplicatePlan`を取得できるようにする。

- [ ] **Step 2: プラン行に複製ボタンを追加**

`Sidebar.tsx`の通常モードのプラン行（Line 261-270あたり）、Pencilボタンの直前に追加:

```typescript
{currentPlanId === plan.id && (
  <>
    <Tooltip content={t('sidebar.duplicate_plan')}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          const newPlan = usePlanStore.getState().duplicatePlan(plan.id);
          if (!newPlan) {
            // 上限到達時: toast表示（既存のToastシステムを使用）
          }
        }}
        className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-app-text-muted hover:text-app-text hover:bg-glass-hover transition-colors cursor-pointer"
      >
        <Copy size={9} />
      </button>
    </Tooltip>
    <Tooltip content={t('app.rename')}>
      <button ...>  {/* 既存のPencilボタン */}
      </button>
    </Tooltip>
  </>
)}
```

- [ ] **Step 3: コミット**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat: サイドバーにプラン複製ボタン追加"
```

---

## Task 11: GoogleログインPWA対応

**Files:**
- Modify: `src/store/useAuthStore.ts`

PWA（standalone）モードの場合のみ`signInWithRedirect`に切り替え。

- [ ] **Step 1: signInWithRedirect のインポートを追加**

```typescript
import {
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,  // ← 追加
    signInWithCustomToken,
    // ...
} from 'firebase/auth';
```

- [ ] **Step 2: Googleログイン処理にPWA分岐を追加**

`signInWith`のgoogleケース内を変更:

```typescript
case 'google': {
    const googleProvider = new GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    // PWA（ホーム画面から起動）時はリダイレクト方式に切り替え
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;
    if (isPWA) {
        saveReturnUrl();
        localStorage.setItem('lopo_auth_redirecting', 'true');
        signInWithRedirect(auth, googleProvider);
    } else {
        signInWithPopup(auth, googleProvider)
            .then((result) => {
                set({
                    justLoggedInUser: {
                        displayName: result.user.displayName,
                        photoURL: result.user.photoURL,
                    }
                });
            })
            .catch((err) => {
                if (err.code !== 'auth/popup-closed-by-user') {
                    console.error('Google login error:', err);
                }
            });
    }
    break;
}
```

- [ ] **Step 3: getRedirectResult をインポートして起動時に処理**

```typescript
import { getRedirectResult } from 'firebase/auth';  // 追加
```

onAuthStateChangedの近くに、リダイレクト結果の処理を追加:

```typescript
// PWA Google リダイレクト結果を処理
getRedirectResult(auth).then((result) => {
  if (result?.user) {
    useAuthStore.setState({
      justLoggedInUser: {
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
      }
    });
  }
}).catch((err) => {
  console.error('Google redirect result error:', err);
});
```

- [ ] **Step 4: コミット**

```bash
git add src/store/useAuthStore.ts
git commit -m "feat: GoogleログインPWA対応（standalone時のみリダイレクト方式）"
```

---

## Task 12: ビルド確認 + 動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: TypeScriptコンパイルチェック**

```bash
npx tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 2: Viteビルド**

```bash
npm run build
```

Expected: ビルド成功

- [ ] **Step 3: 動作確認チェックリスト**

手動確認項目:
1. `npm run dev` でアプリが起動する
2. `/admin` にアクセスすると、未ログインまたは非管理者はトップページにリダイレクトされる
3. サイドバーのアクティブプランにCopyアイコンが表示される
4. Copyアイコンクリックでプランが複製される（タイトルに連番が付く）
5. 日本語/英語の両方でUI文字列が正しく表示される

- [ ] **Step 4: 全変更をまとめてコミット（未コミット分がある場合）**

```bash
git add -A
git commit -m "feat: 管理基盤 Phase 0 完成（管理者ロール・管理画面・レート制限・監査ログ・プラン複製・PWAログイン）"
```

---

## 実装順序の依存関係

```
Task 1 (adminAuth) ──┐
Task 2 (rateLimit) ──┼── Task 4 (set-role API) ── Task 5 (verify API)
Task 3 (auditLog) ───┘        │
                               ↓
                    Task 6 (isAdmin in store)
                               ↓
                    Task 7 (AdminGuard + Layout + Route)
                               ↓
                    Task 8 (i18n) ── Task 9 (duplicate store) ── Task 10 (duplicate UI)
                               ↓
                    Task 11 (PWA login)
                               ↓
                    Task 12 (ビルド確認)
```

Task 1〜3は並列実行可能。Task 9〜11も互いに独立。
