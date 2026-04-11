# 管理ダッシュボード統計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理ダッシュボードにユーザー数・プラン数の統計と外部リンクを追加する

**Architecture:** 既存の `/api/admin?resource=` パターンに `dashboard` を追加。Firestore `count()` でコレクション数を集計。フロントエンドは既存 AdminDashboard.tsx のタイトル下に統計カードと外部リンクを追加。

**Tech Stack:** Firebase Admin SDK (Firestore count), React, TypeScript

---

### Task 1: API ハンドラー

**Files:**
- Create: `api/admin/_dashboardHandler.ts`
- Modify: `api/admin/index.ts`

- [ ] **Step 1: `_dashboardHandler.ts` を作成**

```typescript
/**
 * 管理ダッシュボード統計API
 * GET — ユーザー数・プラン数を返す
 */
import { initAdmin, verifyAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowedOrigins = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const adminUid = await verifyAdmin(req);
    if (!adminUid) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const db = getAdminFirestore();
    const [usersSnap, plansSnap] = await Promise.all([
      db.collection('users').count().get(),
      db.collection('plans').count().get(),
    ]);

    return res.status(200).json({
      userCount: usersSnap.data().count,
      planCount: plansSnap.data().count,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
```

- [ ] **Step 2: `index.ts` に dashboard ケースを追加**

`api/admin/index.ts` の import に追加:
```typescript
import dashboardHandler from './_dashboardHandler.js';
```

switch 文に追加:
```typescript
case 'dashboard':
  return dashboardHandler(req, res);
```

- [ ] **Step 3: コミット**

```bash
git add api/admin/_dashboardHandler.ts api/admin/index.ts
git commit -m "feat(admin): ダッシュボード統計API追加（ユーザー数・プラン数）"
```

---

### Task 2: フロントエンド統計表示 + 外部リンク

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`

- [ ] **Step 1: 統計データ取得の state と useEffect を追加**

既存の `logs` state の付近に追加:

```typescript
const [stats, setStats] = useState<{ userCount: number; planCount: number } | null>(null);
const [statsLoading, setStatsLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  async function loadStats() {
    try {
      const res = await apiFetch('/api/admin?resource=dashboard');
      if (cancelled) return;
      if (res.ok) {
        setStats(await res.json());
      }
    } catch {
      // 統計取得失敗は無視
    } finally {
      if (!cancelled) setStatsLoading(false);
    }
  }
  loadStats();
  return () => { cancelled = true; };
}, []);
```

- [ ] **Step 2: 統計カードと外部リンクのJSXを追加**

h1タイトルの直後、アクションカードセクションの前に追加:

```tsx
{/* 統計 */}
<section>
  <h2 className="text-app-2xl font-semibold mb-4 text-[var(--app-text-muted)] uppercase tracking-wide">
    統計
  </h2>
  <div className="grid grid-cols-2 gap-3">
    <div className="border border-[var(--app-text)]/20 p-6">
      <div className="text-app-lg text-[var(--app-text-muted)]">ユーザー数</div>
      <div className="text-app-5xl font-bold mt-1">
        {statsLoading ? '—' : stats?.userCount ?? '—'}
      </div>
    </div>
    <div className="border border-[var(--app-text)]/20 p-6">
      <div className="text-app-lg text-[var(--app-text-muted)]">プラン数</div>
      <div className="text-app-5xl font-bold mt-1">
        {statsLoading ? '—' : stats?.planCount ?? '—'}
      </div>
    </div>
  </div>
</section>

{/* 外部リンク */}
<section>
  <h2 className="text-app-2xl font-semibold mb-4 text-[var(--app-text-muted)] uppercase tracking-wide">
    外部ツール
  </h2>
  <div className="flex gap-4 text-app-lg">
    <a href="https://console.firebase.google.com/project/lopo-7793e" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-60 transition-opacity">Firebase Console</a>
    <a href="https://analytics.google.com/analytics/web/#/p467aborz/reports/reportinghub?params=_u..nav%3Dmaui" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-60 transition-opacity">Google Analytics</a>
    <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:opacity-60 transition-opacity">Vercel Dashboard</a>
  </div>
</section>
```

- [ ] **Step 3: ビルド確認**

```bash
npm run build
```

- [ ] **Step 4: コミット**

```bash
git add src/components/admin/AdminDashboard.tsx
git commit -m "feat(admin): ダッシュボードに統計カードと外部リンクを追加"
```

---

### Task 3: TODO.md 更新

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: 管理ダッシュボード項目を完了に、writeAuditLogバグを削除**

- `管理ダッシュボード（シンプル版）` の項目にチェックを入れる
- `_syncHandler.ts: writeAuditLogの引数不一致` は前セッションで修正済みなので削除

- [ ] **Step 2: コミット**

```bash
git add docs/TODO.md
git commit -m "docs: 管理ダッシュボード完了、修正済みバグ項目を削除"
```
