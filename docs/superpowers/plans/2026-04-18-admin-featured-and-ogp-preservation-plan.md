# Admin Featured + OGP 高速化 + 削除防止 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理画面に URL 貼り付け式の Featured 設定 UI を追加し、ボトムシートの OGP を Storage キャッシュ経路へ高速化し、Featured 指定プランの OGP が 30 日 cron で消えないよう保護する。

**Architecture:** 既存 `/api/popular` に PATCH を追加（新 API 関数ゼロで Vercel Hobby 制約維持）。`og_image_meta` に `keepForever` フラグを追加し、cron 削除ロジックで参照。`MitigationSheet.tsx` は `imageHash` がある新プランは `/og/{hash}.png`、無い古いプランは既存の `/api/og?id=X` にフォールバック。

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Firebase Admin SDK, Firestore, Firebase Storage, Tailwind v4, i18next, framer-motion, Vercel Serverless.

**参照設計書:** [2026-04-18-admin-featured-and-ogp-preservation-design.md](../specs/2026-04-18-admin-featured-and-ogp-preservation-design.md)

---

## 事前確認（全タスク共通）

- [ ] 実装セッション開始時に `docs/TODO.md` の「現在の状態」を読む
- [ ] ブランチ `main` にいて `git status` が clean であることを確認
- [ ] 設計書を読み直して全体像を把握する

---

## Task 1: `/api/popular` GET レスポンスに `imageHash` を含める

**Files:**
- Modify: `api/popular/index.ts` (`mapDoc` 関数内)

- [ ] **Step 1: 既存 `mapDoc` を開いて戻り値に `imageHash` 追加**

[api/popular/index.ts:136-153](api/popular/index.ts#L136-L153) を以下に変更:

```ts
const mapDoc = (doc: any) => {
    const data = doc.data();
    const partyMembers = data.planData?.partyMembers?.map((m: any) => ({
        id: m.id,
        jobId: m.jobId,
        role: m.role,
    })) ?? [];
    return {
        shareId: data.shareId,
        title: data.title ?? '',
        contentId: data.contentId,
        copyCount: data.copyCount ?? 0,
        viewCount: data.viewCount ?? 0,
        featured: data.featured === true,
        createdAt: data.createdAt,
        partyMembers,
        imageHash: data.imageHash ?? null,
    };
};
```

- [ ] **Step 2: 型チェックを走らせる**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: commit**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat(api): /api/popular レスポンスに imageHash を含める"
```

---

## Task 2: `PopularEntry` 型を `imageHash` に対応

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (line 20-28)
- Modify: `src/components/PopularPage.tsx` (line 22-30)

`PopularEntry` は両ファイルでローカル型として定義されている。両方に `imageHash: string | null` を追加する。

- [ ] **Step 1: `MitigationSheet.tsx` の型を拡張**

[src/components/MitigationSheet.tsx:20-28](src/components/MitigationSheet.tsx#L20-L28) を以下に:

```ts
interface PopularEntry {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
  viewCount: number;
  featured: boolean;
  partyMembers: { jobId: string | null }[];
  imageHash: string | null;
}
```

- [ ] **Step 2: `PopularPage.tsx` の型を拡張**

[src/components/PopularPage.tsx:22-30](src/components/PopularPage.tsx#L22-L30) を以下に:

```ts
interface PopularEntry {
    shareId: string;
    contentId: string;
    title: string;
    copyCount: number;
    viewCount: number;
    featured: boolean;
    partyMembers: { jobId: string | null }[];
    imageHash: string | null;
}
```

- [ ] **Step 3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: commit**

```bash
rtk git add src/components/MitigationSheet.tsx src/components/PopularPage.tsx
rtk git commit -m "feat(types): PopularEntry に imageHash フィールド追加"
```

---

## Task 3: `MitigationSheet.tsx` の OGP URL を新キャッシュ経路に切替

**Files:**
- Modify: `src/components/MitigationSheet.tsx` (line 344 および OGP `<img>` 参照箇所)

- [ ] **Step 1: `getOgpUrl` を entry ベースに変更**

[src/components/MitigationSheet.tsx:344](src/components/MitigationSheet.tsx#L344) の:

```ts
const getOgpUrl = (shareId: string) => `/api/og?id=${encodeURIComponent(shareId)}`;
```

を以下に変更:

```ts
const getOgpUrl = (entry: PopularEntry) =>
  entry.imageHash
    ? `/og/${entry.imageHash}.png`
    : `/api/og?id=${encodeURIComponent(entry.shareId)}`;
```

- [ ] **Step 2: 呼び出し側を修正**

ファイル内で `getOgpUrl(entry.shareId)` または `getOgpUrl(...shareId...)` となっている箇所を grep する:

Run: `rtk grep "getOgpUrl" src/components/MitigationSheet.tsx`
Expected: 関数定義 + 1 箇所の呼び出し（[MitigationSheet.tsx:470](src/components/MitigationSheet.tsx#L470)）

呼び出し箇所を:

```tsx
src={getOgpUrl(entry.shareId)}
```

から:

```tsx
src={getOgpUrl(entry)}
```

に変更する（line 470 付近）。

- [ ] **Step 3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: ローカルで動作確認**

Run: `npm run dev`（別ターミナルで）
ブラウザで http://localhost:5173 → ボトムシートを開く → DevTools Network タブで `/og/<hash>.png` への GET が走ることを確認。
（データが 1 件しか無い現状では、FRU コンテンツの代表カードで `/og/5b0e2b54b53ca22e.png` 等のハッシュ形式 URL が叩かれる想定）

- [ ] **Step 5: commit**

```bash
rtk git add src/components/MitigationSheet.tsx
rtk git commit -m "feat(miti-sheet): OGP画像を Storage キャッシュ経路に切替"
```

---

## Task 4: `_ugcHandler.ts` GET レスポンス拡張

**Files:**
- Modify: `api/admin/_ugcHandler.ts` (line 54-64)

AdminFeatured 画面で使う情報を追加する。新 API を作らず既存エンドポイントを拡張。

- [ ] **Step 1: GET レスポンス構造を変更**

[api/admin/_ugcHandler.ts:54-64](api/admin/_ugcHandler.ts#L54-L64) を以下に:

```ts
if (req.method === 'GET') {
  const data = snap.data()!;
  return res.status(200).json({
    shareId: data.shareId,
    title: data.title || '',
    contentId: data.contentId || null,
    createdAt: data.createdAt || null,
    type: data.type || 'single',
    hasLogo: !!data.logoBase64,
    logoBase64: data.logoBase64 || null,
    featured: data.featured === true,
    copyCount: data.copyCount || 0,
    imageHash: data.imageHash || null,
  });
```

- [ ] **Step 2: 既存 AdminUgc への影響を確認**

Run: `rtk grep "resource=ugc" src/components/admin`
Expected: `AdminUgc.tsx` で検索 GET を叩く箇所のみ

既存 `AdminUgc.tsx` のレスポンス型 `SharedPlanInfo` は `shareId / title / contentId / createdAt / type / hasLogo / logoBase64` のみ参照。追加フィールドがあっても存在を参照しないので既存動作に影響しない（TypeScript は JSON の追加フィールドを無視）。

- [ ] **Step 3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: commit**

```bash
rtk git add api/admin/_ugcHandler.ts
rtk git commit -m "feat(admin-api): UGC GET に featured/copyCount/imageHash を追加"
```

---

## Task 5: `PATCH /api/popular` ハンドラ追加

**Files:**
- Modify: `api/popular/index.ts` (`handler` 末尾の else 分岐追加、および先頭 import 追加)

トランザクションで shared_plans を更新する本体。`og_image_meta` の keepForever は Task 6 で別に扱う。

- [ ] **Step 1: verifyAdmin の import を追加**

[api/popular/index.ts:8-11](api/popular/index.ts#L8-L11) の import ブロックに追加:

```ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { verifyAdmin } from '../../src/lib/adminAuth.js';
```

`initAdmin` は既存のものを使う（`adminAuth.ts` にも同名があるが、`api/popular/index.ts` 側は既に独自定義済みなのでそのまま使う）。

- [ ] **Step 2: ハンドラ末尾の else ブランチを追加**

[api/popular/index.ts:300-302](api/popular/index.ts#L300-L302) の:

```ts
} else {
    return res.status(405).json({ error: 'Method not allowed' });
}
```

を以下に変更:

```ts
} else if (req.method === 'PATCH') {
    // ── 管理者専用: featured フラグ切替 ──
    const adminUid = await verifyAdmin(req);
    if (!adminUid) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const { shareId, featured } = req.body ?? {};
    if (typeof shareId !== 'string' || typeof featured !== 'boolean') {
        return res.status(400).json({ error: 'shareId (string) and featured (boolean) required' });
    }

    const docRef = db.collection(COLLECTION).doc(shareId);
    const snap = await docRef.get();
    if (!snap.exists) {
        return res.status(404).json({ error: 'not found' });
    }
    const data = snap.data()!;
    const contentId = data.contentId;
    if (!contentId) {
        return res.status(400).json({ error: 'plan has no contentId' });
    }
    const newImageHash = (data.imageHash as string) ?? null;

    // トランザクション前に同コンテンツの既存 featured を取得
    const oldFeaturedSnap = await db
        .collection(COLLECTION)
        .where('contentId', '==', contentId)
        .where('featured', '==', true)
        .get();
    const oldFeaturedEntries: { shareId: string; imageHash: string | null }[] =
        oldFeaturedSnap.docs
            .filter(d => d.id !== shareId)
            .map(d => ({
                shareId: d.id,
                imageHash: (d.data().imageHash as string) ?? null,
            }));

    // トランザクション: shared_plans のみ一貫更新
    await db.runTransaction(async (tx) => {
        if (featured) {
            for (const entry of oldFeaturedEntries) {
                tx.update(db.collection(COLLECTION).doc(entry.shareId), { featured: false });
            }
        }
        tx.update(docRef, { featured });
    });

    // og_image_meta の keepForever 制御（Task 6 で追加）
    // ここは Task 6 で埋める（今は空のまま）

    return res.status(200).json({ ok: true });

} else {
    return res.status(405).json({ error: 'Method not allowed' });
}
```

- [ ] **Step 3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: OPTIONS プリフライトの Allow-Methods に PATCH を追加**

[api/popular/index.ts:113](api/popular/index.ts#L113) を:

```ts
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
```

から:

```ts
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
```

- [ ] **Step 5: commit**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat(api): PATCH /api/popular で featured 切替 (admin 専用)"
```

---

## Task 6: `PATCH` に og_image_meta.keepForever 制御を追加

**Files:**
- Modify: `api/popular/index.ts` (Task 5 で埋めるコメントのブロック)

- [ ] **Step 1: `OG_IMAGE_META_COLLECTION` 定数を先頭に追加**

[api/popular/index.ts:12](api/popular/index.ts#L12) の `const COLLECTION = 'shared_plans';` の下に追加:

```ts
const COLLECTION = 'shared_plans';
const OG_IMAGE_META_COLLECTION = 'og_image_meta';
```

- [ ] **Step 2: Task 5 で空にしたコメント位置に以下を埋める**

Task 5 で追加した `// ここは Task 6 で埋める（今は空のまま）` のコメント部分を以下に置き換え:

```ts
// og_image_meta.keepForever の制御（トランザクション外で best-effort）
const metaCol = db.collection(OG_IMAGE_META_COLLECTION);
if (featured) {
    if (newImageHash) {
        await metaCol.doc(newImageHash).update({ keepForever: true })
            .catch(() => { /* meta が無い古いプランは無視 */ });
    }
    for (const entry of oldFeaturedEntries) {
        if (entry.imageHash && entry.imageHash !== newImageHash) {
            await metaCol.doc(entry.imageHash).update({ keepForever: FieldValue.delete() })
                .catch(() => {});
        }
    }
} else {
    if (newImageHash) {
        await metaCol.doc(newImageHash).update({ keepForever: FieldValue.delete() })
            .catch(() => {});
    }
}
```

- [ ] **Step 3: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 4: commit**

```bash
rtk git add api/popular/index.ts
rtk git commit -m "feat(api): PATCH で og_image_meta.keepForever を set/clear"
```

---

## Task 7: `cleanup-og-images` cron に keepForever スキップを追加

**Files:**
- Modify: `api/cron/cleanup-og-images/index.ts` (line 67-93 のループ内)

- [ ] **Step 1: 削除ループ内に keepForever 判定を挿入**

[api/cron/cleanup-og-images/index.ts:67-93](api/cron/cleanup-og-images/index.ts#L67-L93) を以下に置換:

```ts
for (const file of files) {
    if (checked >= MAX_PROCESS) break;
    checked++;
    try {
        // ハッシュ抽出（`og-images/{16hex}.png` 形式）
        const match = file.name.match(/^og-images\/([a-f0-9]{16})\.png$/);
        const hash = match?.[1];

        // keepForever フラグ: Featured 指定中のプランは絶対に削除しない
        if (hash) {
            const metaSnap = await db.collection(OG_IMAGE_META_COLLECTION).doc(hash).get();
            if (metaSnap.exists && metaSnap.data()?.keepForever === true) {
                continue;
            }
        }

        const [metadata] = await file.getMetadata();
        const lastAccessedRaw = (metadata.metadata as any)?.lastAccessedAt;
        const lastAccessed = typeof lastAccessedRaw === 'string' && /^\d+$/.test(lastAccessedRaw)
            ? Number(lastAccessedRaw)
            : new Date(metadata.updated || metadata.timeCreated || 0).getTime();
        if (lastAccessed >= cutoff) continue;

        await file.delete();
        deletedCount++;

        // og_image_meta/{hash} も同時に削除
        if (hash) {
            try {
                await db.collection(OG_IMAGE_META_COLLECTION).doc(hash).delete();
            } catch { /* meta 削除失敗は致命的でない */ }
            deletedHashes.push(hash);
        }
    } catch (err) {
        console.warn(`Cleanup skipped for ${file.name}:`, err);
    }
}
```

変更点:
- hash 抽出を先頭に移動
- `keepForever === true` なら `continue`
- meta 削除ロジックも hash 再利用できるよう整理（重複した再抽出削除）

- [ ] **Step 2: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: commit**

```bash
rtk git add api/cron/cleanup-og-images/index.ts
rtk git commit -m "feat(cron): keepForever: true の OGP 画像は削除対象から除外"
```

---

## Task 8: `ja.json` に Featured 設定用の i18n キーを追加

**Files:**
- Modify: `src/locales/ja.json` (`admin` ネスト内、`ugc_*` キーの後)

- [ ] **Step 1: `ugc_delete_success` の直後に featured_* を挿入**

[src/locales/ja.json:1495](src/locales/ja.json#L1495) の `"ugc_delete_success": "ロゴを削除し、ブロックリストに登録しました"` の直後（`}` の前）に以下を追加:

```json
        "ugc_delete_success": "ロゴを削除し、ブロックリストに登録しました",
        "featured_title": "Featured設定",
        "featured_description": "野良主流に固定するプランを共有URLから指定します。1コンテンツにつき1件のみ設定できます。",
        "featured_url_placeholder": "共有URLまたはshareIDを貼り付け",
        "featured_search": "検索",
        "featured_current_content": "コンテンツ",
        "featured_plan_title": "タイトル",
        "featured_copy_count": "コピー数",
        "featured_created": "作成日",
        "featured_status_on": "現在 Featured に設定中",
        "featured_status_off": "未設定",
        "featured_set_button": "Featuredにする",
        "featured_unset_button": "Featuredを解除",
        "featured_set_success": "Featuredに設定しました",
        "featured_unset_success": "Featuredを解除しました",
        "featured_not_found": "共有IDが見つかりません",
        "featured_confirm_set": "このプランを「{{content}}」のFeaturedに設定します。同じコンテンツの既存Featuredは自動的に外れます。よろしいですか？",
        "featured_confirm_unset": "このプランのFeaturedを解除します。よろしいですか？"
```

（末尾の `}` / `,` の構文に注意。JSON Lint で文法確認する）

- [ ] **Step 2: 構文チェック**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/locales/ja.json','utf-8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: commit**

```bash
rtk git add src/locales/ja.json
rtk git commit -m "feat(i18n): Featured設定画面の日本語キーを追加"
```

---

## Task 9: `AdminFeatured.tsx` コンポーネントを新規作成

**Files:**
- Create: `src/components/admin/AdminFeatured.tsx`

AdminUgc のパターンを踏襲。URL 貼り付け → 検索 → featured 切替。

- [ ] **Step 1: ファイルを新規作成**

`src/components/admin/AdminFeatured.tsx` に以下を記述:

```tsx
/**
 * Featured 設定ページ
 * 共有URLを貼り付けて検索 → プランを野良主流 Featured に指定/解除
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';
import { Search, Star, Loader2 } from 'lucide-react';

/** 共有URLまたはshareIdからshareId部分を抽出 */
function extractShareId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/share\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return trimmed;
}

interface PlanInfo {
  shareId: string;
  title: string;
  contentId: string | null;
  createdAt: number | null;
  featured: boolean;
  copyCount: number;
  imageHash: string | null;
}

function getOgpUrl(plan: PlanInfo): string {
  return plan.imageHash
    ? `/og/${plan.imageHash}.png`
    : `/api/og?id=${encodeURIComponent(plan.shareId)}`;
}

export function AdminFeatured() {
  const { t } = useTranslation();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [patching, setPatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const handleSearch = async () => {
    const shareId = extractShareId(input);
    if (!shareId) return;

    setLoading(true);
    setError(null);
    setPlan(null);
    setToast(null);

    try {
      const res = await apiFetch(`/api/admin?resource=ugc&shareId=${encodeURIComponent(shareId)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t('admin.featured_not_found'));
          return;
        }
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      const data = await res.json();
      setPlan({
        shareId: data.shareId,
        title: data.title || '',
        contentId: data.contentId || null,
        createdAt: data.createdAt || null,
        featured: data.featured === true,
        copyCount: data.copyCount || 0,
        imageHash: data.imageHash || null,
      });
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFeatured = async (next: boolean) => {
    if (!plan) return;
    const contentIdStr = plan.contentId || '(未設定)';
    const confirmMsg = next
      ? t('admin.featured_confirm_set', { content: contentIdStr })
      : t('admin.featured_confirm_unset');
    if (!confirm(confirmMsg)) return;

    setPatching(true);
    setError(null);
    setToast(null);

    try {
      const res = await apiFetch('/api/popular', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: plan.shareId, featured: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || `Error: ${res.status}`);
        return;
      }
      setPlan({ ...plan, featured: next });
      setToast(next ? t('admin.featured_set_success') : t('admin.featured_unset_success'));
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setPatching(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-app-3xl font-bold mb-4">{t('admin.featured_title')}</h1>
      <p className="text-app-lg text-app-text-muted mb-4">{t('admin.featured_description')}</p>

      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder={t('admin.featured_url_placeholder')}
          className="flex-1 bg-app-surface2 border border-app-border rounded-lg px-3 py-2 text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none"
        />
        <button
          onClick={handleSearch}
          disabled={loading || !input.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          {t('admin.featured_search')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
          {error}
        </div>
      )}

      {toast && (
        <div className="mb-4 p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
          {toast}
        </div>
      )}

      {plan && (
        <div className="border border-app-border rounded-lg p-4">
          <div className="flex gap-4 mb-4">
            <img
              src={getOgpUrl(plan)}
              alt=""
              className="w-48 h-auto rounded-lg border border-app-border bg-app-surface2"
              style={{ aspectRatio: '1200 / 630', objectFit: 'cover' }}
            />
            <div className="flex-1">
              <table className="w-full text-app-lg">
                <tbody>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted w-28">
                      {t('admin.featured_current_content')}
                    </th>
                    <td className="py-1">{plan.contentId || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_plan_title')}
                    </th>
                    <td className="py-1">{plan.title || '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_copy_count')}
                    </th>
                    <td className="py-1">{plan.copyCount}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">
                      {t('admin.featured_created')}
                    </th>
                    <td className="py-1">{plan.createdAt ? new Date(plan.createdAt).toLocaleString() : '—'}</td>
                  </tr>
                  <tr>
                    <th className="text-left font-semibold py-1 pr-3 text-app-text-muted">Status</th>
                    <td className="py-1 font-semibold">
                      {plan.featured ? (
                        <span className="text-app-yellow flex items-center gap-1.5">
                          <Star size={14} fill="currentColor" />
                          {t('admin.featured_status_on')}
                        </span>
                      ) : (
                        <span className="text-app-text-muted">
                          {t('admin.featured_status_off')}
                        </span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t border-app-border pt-4 flex justify-end">
            {plan.featured ? (
              <button
                onClick={() => handleToggleFeatured(false)}
                disabled={patching}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md text-app-lg font-semibold text-app-red hover:bg-app-red-dim transition-colors disabled:opacity-40"
              >
                {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                {t('admin.featured_unset_button')}
              </button>
            ) : (
              <button
                onClick={() => handleToggleFeatured(true)}
                disabled={patching}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-app-blue text-white text-app-lg font-semibold hover:bg-app-blue-hover transition-colors disabled:opacity-40"
              >
                {patching ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} fill="currentColor" />}
                {t('admin.featured_set_button')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 型チェック**

Run: `rtk tsc --noEmit`
Expected: エラーなし

- [ ] **Step 3: commit**

```bash
rtk git add src/components/admin/AdminFeatured.tsx
rtk git commit -m "feat(admin): AdminFeatured コンポーネント追加 (URL貼り付け式)"
```

---

## Task 10: ルーティング + ナビゲーション追加

**Files:**
- Modify: `src/App.tsx` (import + Route)
- Modify: `src/components/admin/AdminLayout.tsx` (NAV_ITEMS)

- [ ] **Step 1: App.tsx に import 追加**

[src/App.tsx:27](src/App.tsx#L27) の `import { AdminUgc } from './components/admin/AdminUgc';` の直後に追加:

```ts
import { AdminUgc } from './components/admin/AdminUgc';
import { AdminFeatured } from './components/admin/AdminFeatured';
```

- [ ] **Step 2: App.tsx に Route 追加**

[src/App.tsx:138](src/App.tsx#L138) の `<Route path="ugc" element={<AdminUgc />} />` の直後に追加:

```tsx
<Route path="ugc" element={<AdminUgc />} />
<Route path="featured" element={<AdminFeatured />} />
```

- [ ] **Step 3: AdminLayout.tsx の NAV_ITEMS に追加**

[src/components/admin/AdminLayout.tsx:11-23](src/components/admin/AdminLayout.tsx#L11-L23) を以下に変更（ugc の直後に featured を追加）:

```ts
const NAV_ITEMS = [
  { path: '/admin', labelKey: 'admin.dashboard', end: true },
  { path: '/admin/contents', labelKey: 'admin.contents', end: false },
  { path: '/admin/templates', labelKey: 'admin.templates', end: false },
  { path: '/admin/skills', labelKey: 'admin.skills', end: false },
  { path: '/admin/translations', labelKey: 'admin.translations', end: false },
  { path: '/admin/stats', labelKey: 'admin.stats', end: false },
  { path: '/admin/servers', labelKey: 'admin.servers', end: false },
  { path: '/admin/config', labelKey: 'admin.config', end: false },
  { path: '/admin/backups', labelKey: 'admin.backups_title', end: false },
  { path: '/admin/logs', labelKey: 'admin.logs_title', end: false },
  { path: '/admin/ugc', labelKey: 'admin.ugc_title', end: false },
  { path: '/admin/featured', labelKey: 'admin.featured_title', end: false },
] as const;
```

- [ ] **Step 4: 型チェック + ビルド**

Run: `rtk tsc --noEmit`
Expected: エラーなし

Run: `rtk npm run build`
Expected: `✓ built in` が出て成功

- [ ] **Step 5: commit**

```bash
rtk git add src/App.tsx src/components/admin/AdminLayout.tsx
rtk git commit -m "feat(admin): /admin/featured ルートとナビを追加"
```

---

## Task 11: AdminUgc i18n 現象確認

**Files:**
- Read only: `src/components/admin/AdminUgc.tsx`, `src/locales/ja.json`

ユーザ報告「タグみたいな状態で出ている」の実機確認。既に ja.json にキーが揃っていることは確認済み（feedback）。

- [ ] **Step 1: ローカル dev server で `/admin/ugc` を開く**

Run: `npm run dev`
ブラウザで http://localhost:5173/admin/ugc にアクセス（管理者ログイン済の状態）

- [ ] **Step 2: 画面表示を確認**

- 見出し「UGC管理」が日本語で表示されていれば ✓（再現しない）
- 「admin.ugc_title」などのキーそのままなら ✗（再現する）

- [ ] **Step 3-A: 再現しなかった場合**

引き継ぎメッセージに「AdminUgc の i18n 現象は実機で再現せず。クローズ」と記載。このタスクはコード変更なしで完了。

- [ ] **Step 3-B: 再現した場合**

以下を実施:
1. DevTools Console で `i18next.options` と `i18next.language` を確認
2. `t('admin.ugc_title')` を Console で呼び出して結果確認
3. 原因を特定して最小修正で対応（例: namespace 設定、言語 fallback 設定）
4. 修正内容を commit（メッセージ例: `fix(i18n): AdminUgc で翻訳キーが表示されていた問題を修正`）

---

## Task 12: エンドツーエンド手動検証

**目的:** 本番に上げる前に全タスクの動作を確認する。

- [ ] **Step 1: dev server 起動（既に起動してなければ）**

Run: `npm run dev`

- [ ] **Step 2: 非管理者の PATCH が拒否されるか確認**

DevTools Console で（ログアウト状態 or 非管理者ユーザで）:

```js
fetch('/api/popular', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shareId: 'xxx', featured: true })
}).then(r => console.log(r.status));
```
Expected: `403`

- [ ] **Step 3: 管理者として `/admin/featured` を開く**

- サイドナビに「Featured設定」が表示されている
- ページ見出しが「Featured設定」で、説明文が日本語で表示される

- [ ] **Step 4: 存在する shareId（`5lCMACDB` = FRU_LoPo テスト）で検索**

- サムネ画像が表示される（`/og/{hash}.png` が叩かれる）
- コンテンツ、タイトル、コピー数、作成日が表示される
- Status が「未設定」または現在の状態を正しく反映

- [ ] **Step 5: [Featuredにする] を押下**

- 確認ダイアログが出る → OK
- トーストで成功表示
- Status が「現在 Featured に設定中」に変わる
- Firestore Console で `shared_plans/5lCMACDB.featured === true` 確認
- Firestore Console で `og_image_meta/{imageHash}.keepForever === true` 確認

- [ ] **Step 6: ボトムシートで featured 表示確認**

`/miti` でボトムシートを開く → FRU の代表カードが該当プランになっている（Phase 2 既存動作が壊れていない）

- [ ] **Step 7: [Featuredを解除] を押下**

- 確認 → OK
- Status が「未設定」に戻る
- Firestore で `featured: false` かつ `keepForever` フィールドが消えている

- [ ] **Step 8: 存在しない shareId で検索**

- 「共有IDが見つかりません」のエラー表示

- [ ] **Step 9: ボトムシート OGP 高速化の確認**

- `/miti` ボトムシート → DevTools Network タブでカード画像 URL が `/og/{hash}.png` になっていることを確認
- 存在する 1 件のカードで HTTP 200 かつ比較的高速（Storage HIT 時）

- [ ] **Step 10: cron 動作を手動確認（任意）**

Firestore で適当な古い画像の `og_image_meta/{hash}.keepForever = true` を手で立てる → Vercel Cron を手動起動（`curl -H "Authorization: Bearer $CRON_SECRET" https://lopoly.app/api/cron/cleanup-og-images`）→ 当該画像が削除されていないことを確認（本ステップは本番デプロイ後、時間があるときでもよい）。

---

## Task 13: ビルド + テスト + プッシュ準備

- [ ] **Step 1: 全テスト実行**

Run: `rtk vitest run`
Expected: 既存テスト 148/148 pass（新規テストは API 層のため未追加、回帰しなければ OK）

- [ ] **Step 2: 本番ビルド**

Run: `rtk npm run build`
Expected: 成功、バンドルサイズ警告のみ

- [ ] **Step 3: i18n 確認（英語フォールバック）**

dev server でブラウザの言語を英語にしてから `/admin/featured` を開く → 日本語で表示される（フォールバック動作）。
英語で表示したい場合は将来対応（本タスクではスコープ外）。

- [ ] **Step 4: TODO.md を更新**

`docs/TODO.md` の「現在の状態」セクションに以下を追加:

```
- **Phase 3 完了（2026-04-XX）**: 管理画面 Featured 設定UI（URL貼り付け式）、ボトムシートOGP高速化、Featured OGP削除防止
```

「次にやること」から Phase 3 行を削除、「今セッションの完了事項」に詳細追加。

- [ ] **Step 5: commit**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(todo): Phase 3 完了を反映"
```

- [ ] **Step 6: push**

```bash
rtk git push
```

Expected: Vercel 自動デプロイが始まる

- [ ] **Step 7: 本番動作確認**

デプロイ完了（Vercel ダッシュボードまたはメール）後:
- lopoly.app/admin/featured が開けて動作する
- lopoly.app/miti のボトムシートで OGP が `/og/{hash}.png` 経由になる
- PATCH 本番叩きで Firestore に反映される

---

## 完了判定

全タスクのチェックボックスが ✓ になり、以下が満たされれば完了:

- [ ] Admin が URL 貼り付けで Featured 設定/解除できる
- [ ] 同コンテンツに 2 つの Featured が同時に立たない
- [ ] 非管理者が PATCH を叩くと 403
- [ ] ボトムシートで OGP が `/og/{hash}.png` 経由で表示される
- [ ] imageHash 無しの古いプランは `/api/og?id=X` へフォールバック
- [ ] Featured 指定中の `og_image_meta` に `keepForever: true` が立つ
- [ ] Featured 解除で `keepForever` が消える
- [ ] cleanup-og-images cron が `keepForever: true` を絶対に消さない
- [ ] AdminUgc の i18n 現象が確認・対応済み
- [ ] 既存テスト 148/148 pass
- [ ] 本番ビルドが通る
- [ ] 本番デプロイで動作確認済み

---

## リスク時のロールバック

- `api/popular/index.ts` の変更: git revert で即座に戻せる（シリアライズ互換、imageHash フィールド追加は既存クライアントを壊さない）
- `MitigationSheet.tsx` の変更: imageHash が null なら従来経路を叩くのでフォールバック済み
- `og_image_meta.keepForever`: フィールド追加のみ、既存 cron ロジックは keepForever 無しのケースで従来通り動く
- `AdminFeatured.tsx`: 新規ファイル、削除すれば元に戻る
- `ja.json`: 追加したキーを削除すれば元に戻る

各 commit は機能単位で分かれているので、特定の変更だけ revert できる構造になっている。
