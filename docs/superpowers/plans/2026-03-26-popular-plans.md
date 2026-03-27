# 軽減表人気ページ 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共有プランのコピー数を追跡し、コンテンツ別の人気ランキングを表示する `/popular` ページを作成する

**Architecture:** 既存の共有プラン（`shared_plans` Firestoreコレクション）に `copyCount` フィールドを追加してコピー数を追跡。Vercel APIでコンテンツ別のトップ2を返すエンドポイントを新設。フロントエンドは独立ページ(`/popular`)としてカード形式で表示。

**Tech Stack:** React 19, TypeScript, Zustand, Firebase/Firestore, Vercel Serverless Functions, i18next, Tailwind CSS

---

## ファイル構成

### 新規作成
| ファイル | 責務 |
|---------|------|
| `api/popular/index.ts` | 人気プラン取得API（GET）+ コピーカウント増加（POST） |
| `src/components/PopularPage.tsx` | 人気ページUI（カード一覧、まとめてコピー） |

### 変更
| ファイル | 変更内容 |
|---------|---------|
| `api/share/index.ts` | POST時に `copyCount: 0` をドキュメントに追加 |
| `src/components/SharePage.tsx` | コピー時にcopyCount増加APIを呼ぶ |
| `src/components/ConsolidatedHeader.tsx` | コントロールバーに人気ページボタン追加 |
| `src/components/Timeline.tsx` | モバイルツールシートに人気ページリンク追加 |
| `src/App.tsx` | `/popular` ルート追加 |
| `src/locales/ja.json` | 人気ページ用i18nキー追加 |
| `src/locales/en.json` | 同上（英語） |

---

## Task 1: 共有プランに copyCount フィールドを追加

**Files:**
- Modify: `api/share/index.ts:73-85`（単一プラン保存部分）

- [ ] **Step 1: api/share/index.ts の POST 単一プラン保存に copyCount: 0 を追加**

`api/share/index.ts` の単一プラン doc オブジェクトに `copyCount: 0` を追加する。
バンドルにも追加する（バンドル全体のコピー数追跡用）。

```typescript
// 単一プラン（約83行目付近）
const doc = {
    shareId,
    title: title || '',
    contentId: contentId || null,
    planData,
    copyCount: 0,        // ← 追加
    createdAt: Date.now(),
};

// バンドル（約65行目付近）
const doc = {
    shareId,
    type: 'bundle',
    plans: plans.map((p: any) => ({
        contentId: p.contentId || null,
        title: p.title || '',
        planData: p.planData,
    })),
    copyCount: 0,        // ← 追加
    createdAt: Date.now(),
};
```

- [ ] **Step 2: コミット**

```bash
git add api/share/index.ts
git commit -m "feat: 共有プランにcopyCountフィールド追加"
```

---

## Task 2: コピー数増加API + 人気プラン取得API

**Files:**
- Create: `api/popular/index.ts`

- [ ] **Step 1: api/popular/index.ts を作成**

```typescript
/**
 * Vercel Serverless Function — 人気プランAPI
 *
 * GET  /api/popular?contentIds=m9s,m10s,...  — コンテンツ別の人気プラン（top2）を返す
 * POST /api/popular  { shareId }             — コピーカウント +1
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const COLLECTION = 'shared_plans';

function initAdmin() {
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

export default async function handler(req: any, res: any) {
    // CORS（api/share と同じパターン）
    const origin = req.headers?.origin || '';
    const allowedOrigins = [
        'https://lopoly.app',
        'https://lopo-miti.vercel.app',
        'http://localhost:5173',
        'http://localhost:4173',
    ];
    const isAllowed = allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : allowedOrigins[0]);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        initAdmin();
        const db = getFirestore();

        if (req.method === 'GET') {
            // ── 人気プラン取得 ──
            const { contentIds } = req.query;
            if (!contentIds) {
                return res.status(400).json({ error: 'contentIds is required' });
            }

            const ids = (contentIds as string).split(',').filter(Boolean);
            const results: Record<string, any[]> = {};

            // 各コンテンツIDごとにcopyCount降順でtop2を取得
            // Firestoreの複合インデックスが必要: contentId ASC, copyCount DESC
            await Promise.all(ids.map(async (contentId) => {
                const snap = await db.collection(COLLECTION)
                    .where('contentId', '==', contentId)
                    .orderBy('copyCount', 'desc')
                    .limit(2)
                    .get();

                results[contentId] = snap.docs.map(doc => {
                    const data = doc.data();
                    return {
                        shareId: data.shareId,
                        title: data.title,
                        contentId: data.contentId,
                        copyCount: data.copyCount || 0,
                        createdAt: data.createdAt,
                        // パーティ構成（ジョブアイコン表示用）
                        partyMembers: data.planData?.partyMembers?.map((m: any) => ({
                            id: m.id,
                            jobId: m.jobId,
                            role: m.role,
                        })) || [],
                    };
                });
            }));

            // 15分キャッシュ（サーバー）、5分キャッシュ（ブラウザ）
            res.setHeader('Cache-Control', 'public, s-maxage=900, max-age=300');
            return res.status(200).json(results);

        } else if (req.method === 'POST') {
            // ── コピーカウント増加 ──
            const { shareId } = req.body;
            if (!shareId) {
                return res.status(400).json({ error: 'shareId is required' });
            }

            const docRef = db.collection(COLLECTION).doc(shareId);
            const snap = await docRef.get();
            if (!snap.exists) {
                return res.status(404).json({ error: 'not found' });
            }

            await docRef.update({
                copyCount: FieldValue.increment(1),
            });

            return res.status(200).json({ success: true });

        } else {
            return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err: any) {
        console.error('Popular API error:', err);
        return res.status(500).json({ error: 'Internal server error', details: String(err) });
    }
}
```

- [ ] **Step 2: Firestoreの複合インデックスをデプロイ**

`firestore.indexes.json` にインデックスを追加するか、Firebase Consoleで手動作成:

```
コレクション: shared_plans
フィールド: contentId ASC, copyCount DESC
```

※ 初回クエリ時にFirestoreがエラーログでインデックス作成URLを提供するので、そのURLをクリックして作成するのが最も簡単。

- [ ] **Step 3: コミット**

```bash
git add api/popular/index.ts
git commit -m "feat: 人気プランAPI（取得+コピーカウント増加）"
```

---

## Task 3: 共有ページのコピー時にカウントを増加

**Files:**
- Modify: `src/components/SharePage.tsx`（handleCopyToMine関数）

- [ ] **Step 1: SharePage.tsx にコピーカウント増加ロジックを追加**

`handleCopyToMine` 関数の先頭付近（コピー処理の後）に以下を追加:

```typescript
// handleCopyToMine 関数内、navigate('/miti') の直前に追加

// コピーカウント増加（重複防止）
const copiedKey = 'lopo_copied_shares';
const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
const targetShareId = sharedData.shareId;
if (targetShareId && !copiedList.includes(targetShareId)) {
    copiedList.push(targetShareId);
    localStorage.setItem(copiedKey, JSON.stringify(copiedList));
    // Fire-and-forget（失敗してもコピー自体は成功させる）
    fetch('/api/popular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareId: targetShareId }),
    }).catch(() => {});
}
```

この処理をバンドルコピーと単一コピーの両方のパス（`navigate('/miti')` の直前）に追加する。

- [ ] **Step 2: コミット**

```bash
git add src/components/SharePage.tsx
git commit -m "feat: 共有プランコピー時にcopyCount増加（重複防止付き）"
```

---

## Task 4: i18nキー追加

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`

- [ ] **Step 1: ja.json に popular セクション追加**

```json
"popular": {
    "title": "みんなの軽減表",
    "subtitle": "よく使われている軽減表",
    "savage_section": "零式（最新）",
    "ultimate_section": "絶",
    "copy_button": "コピー",
    "copy_all_rank1": "1位をまとめてコピー",
    "copy_all_rank2": "2位をまとめてコピー",
    "copied_toast": "コピーしました",
    "copied_all_toast": "{{count}}件の軽減表をコピーしました",
    "no_data": "まだデータがありません",
    "copy_count": "{{count}}回コピー",
    "open_popular": "みんなの軽減表",
    "rank": "{{rank}}位"
}
```

- [ ] **Step 2: en.json に popular セクション追加**

```json
"popular": {
    "title": "Popular Plans",
    "subtitle": "Most used mitigation plans",
    "savage_section": "Savage (Latest)",
    "ultimate_section": "Ultimate",
    "copy_button": "Copy",
    "copy_all_rank1": "Copy all #1",
    "copy_all_rank2": "Copy all #2",
    "copied_toast": "Copied",
    "copied_all_toast": "Copied {{count}} plans",
    "no_data": "No data yet",
    "copy_count": "{{count}} copies",
    "open_popular": "Popular Plans",
    "rank": "#{{rank}}"
}
```

- [ ] **Step 3: コミット**

```bash
git add src/locales/ja.json src/locales/en.json
git commit -m "feat: 人気ページ用i18nキー追加（日英）"
```

---

## Task 5: PopularPage コンポーネント作成

**Files:**
- Create: `src/components/PopularPage.tsx`

- [ ] **Step 1: PopularPage.tsx を作成**

```typescript
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../store/useThemeStore';
import { usePlanStore } from '../store/usePlanStore';
import { CONTENT_DEFINITIONS, getContentById } from '../data/contentRegistry';
import { JOBS } from '../data/mockData';
import { Copy, Crown, Users } from 'lucide-react';
import clsx from 'clsx';

// ============================================================
// 型定義
// ============================================================
interface PopularPlan {
    shareId: string;
    title: string;
    contentId: string;
    copyCount: number;
    createdAt: number;
    partyMembers: { id: string; jobId: string | null; role: string }[];
}

type PopularData = Record<string, PopularPlan[]>;

// ============================================================
// 対象コンテンツID取得
// ============================================================
function getLatestSavageIds(): string[] {
    const savageContents = CONTENT_DEFINITIONS.filter(c => c.category === 'savage');
    if (savageContents.length === 0) return [];
    const latestPatch = savageContents.reduce((max, c) => c.patch > max ? c.patch : max, '0');
    return savageContents.filter(c => c.patch === latestPatch).map(c => c.id);
}

function getUltimateIds(): string[] {
    return CONTENT_DEFINITIONS.filter(c => c.category === 'ultimate').map(c => c.id);
}

// ============================================================
// ジョブアイコン表示
// ============================================================
function JobIcon({ jobId }: { jobId: string | null }) {
    if (!jobId) return <div className="w-5 h-5 rounded-full bg-app-border" />;
    const job = JOBS.find(j => j.id === jobId);
    if (!job) return <div className="w-5 h-5 rounded-full bg-app-border" />;
    return (
        <img
            src={job.icon}
            alt={job.id}
            className="w-5 h-5 rounded-full"
            loading="lazy"
        />
    );
}

// ============================================================
// プランカード
// ============================================================
function PlanCard({
    plan,
    rank,
    contentId,
    onCopy,
    lang,
    t,
}: {
    plan: PopularPlan;
    rank: number;
    contentId: string;
    onCopy: (plan: PopularPlan) => void;
    lang: string;
    t: any;
}) {
    const content = getContentById(contentId);
    const contentName = content ? (content.name[lang as 'ja' | 'en'] || content.name.ja) : contentId;

    return (
        <div className="glass-tier3 rounded-xl p-4 flex flex-col gap-3">
            {/* ヘッダー: 順位 + コンテンツ名 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={clsx(
                        "text-xs font-black px-2 py-0.5 rounded-full",
                        rank === 1 ? "bg-app-text text-app-bg" : "bg-app-border text-app-text-muted"
                    )}>
                        {t('popular.rank', { rank })}
                    </span>
                    <span className="font-bold text-sm text-app-text">{contentName}</span>
                </div>
                <span className="text-xs text-app-text-muted">
                    {t('popular.copy_count', { count: plan.copyCount })}
                </span>
            </div>

            {/* プラン名 */}
            <p className="text-xs text-app-text-sec truncate">{plan.title}</p>

            {/* ジョブ構成 */}
            <div className="flex items-center gap-1">
                <Users size={12} className="text-app-text-muted shrink-0" />
                <div className="flex gap-0.5">
                    {plan.partyMembers.map((m) => (
                        <JobIcon key={m.id} jobId={m.jobId} />
                    ))}
                </div>
            </div>

            {/* コピーボタン */}
            <button
                onClick={() => onCopy(plan)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border text-app-text text-xs font-bold hover:bg-app-text hover:text-app-bg transition-all duration-200 cursor-pointer active:scale-95"
            >
                <Copy size={12} />
                {t('popular.copy_button')}
            </button>
        </div>
    );
}

// ============================================================
// メインページ
// ============================================================
export const PopularPage: React.FC = () => {
    const { t } = useTranslation();
    const { theme, contentLanguage } = useThemeStore();
    const lang = contentLanguage || 'ja';

    const [data, setData] = useState<PopularData>({});
    const [loading, setLoading] = useState(true);

    const savageIds = getLatestSavageIds();
    const ultimateIds = getUltimateIds();
    const allIds = [...savageIds, ...ultimateIds];

    // テーマクラスを適用
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('theme-dark', 'theme-light');
        root.classList.add(`theme-${theme}`);
    }, [theme]);

    // データ取得
    useEffect(() => {
        if (allIds.length === 0) return;
        setLoading(true);
        fetch(`/api/popular?contentIds=${allIds.join(',')}`)
            .then(res => res.json())
            .then(json => setData(json))
            .catch(err => console.error('Popular fetch error:', err))
            .finally(() => setLoading(false));
    }, []);

    // コピー処理
    const showToast = (msg: string) => {
        // 簡易トースト（既存のToastを使うか、alertで代用）
        // PopularPageは別タブなので、簡易的に自前で表示
        const el = document.createElement('div');
        el.textContent = msg;
        el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-app-text text-app-bg px-4 py-2 rounded-full text-sm font-bold z-50 animate-fade-in';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 2000);
    };

    const copySinglePlan = async (plan: PopularPlan) => {
        const content = getContentById(plan.contentId);
        const contentName = content ? (content.name[lang as 'ja' | 'en'] || content.name.ja) : '';

        // 共有プランの全データを取得
        const res = await fetch(`/api/share?id=${plan.shareId}`);
        if (!res.ok) return;
        const sharedData = await res.json();

        const planData = sharedData.planData || sharedData;
        const newPlan = {
            id: crypto.randomUUID(),
            ownerId: '',
            ownerDisplayName: '',
            title: plan.title || contentName || 'Popular Plan',
            contentId: plan.contentId,
            isPublic: false,
            copyCount: 0,
            useCount: 0,
            data: planData,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        usePlanStore.getState().addPlan(newPlan);

        // コピーカウント増加（重複防止）
        const copiedKey = 'lopo_copied_shares';
        const copiedList: string[] = JSON.parse(localStorage.getItem(copiedKey) || '[]');
        if (!copiedList.includes(plan.shareId)) {
            copiedList.push(plan.shareId);
            localStorage.setItem(copiedKey, JSON.stringify(copiedList));
            fetch('/api/popular', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ shareId: plan.shareId }),
            }).catch(() => {});
        }

        showToast(t('popular.copied_toast'));
    };

    const copyAllByRank = async (rank: number) => {
        // rank: 1 or 2（配列index: 0 or 1）
        const idx = rank - 1;
        let count = 0;
        for (const contentId of savageIds) {
            const plans = data[contentId];
            if (plans && plans[idx]) {
                await copySinglePlan(plans[idx]);
                count++;
            }
        }
        if (count > 0) {
            showToast(t('popular.copied_all_toast', { count }));
        }
    };

    // ============================================================
    // レンダリング
    // ============================================================
    return (
        <div className="min-h-screen bg-app-bg text-app-text">
            {/* ヘッダー */}
            <header className="border-b border-app-border px-6 py-8">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-2xl font-black tracking-tight">{t('popular.title')}</h1>
                    <p className="text-sm text-app-text-muted mt-1">{t('popular.subtitle')}</p>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-6 h-6 border-2 border-app-border border-t-app-text rounded-full animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* ── 零式セクション ── */}
                        <section className="mb-12">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold flex items-center gap-2">
                                    <Crown size={18} />
                                    {t('popular.savage_section')}
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => copyAllByRank(1)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-app-text text-app-bg text-xs font-bold hover:opacity-80 transition-opacity cursor-pointer active:scale-95"
                                    >
                                        <Copy size={12} />
                                        {t('popular.copy_all_rank1')}
                                    </button>
                                    <button
                                        onClick={() => copyAllByRank(2)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-app-border text-app-text text-xs font-bold hover:bg-app-text hover:text-app-bg transition-all duration-200 cursor-pointer active:scale-95"
                                    >
                                        <Copy size={12} />
                                        {t('popular.copy_all_rank2')}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {savageIds.map(contentId => {
                                    const plans = data[contentId] || [];
                                    if (plans.length === 0) {
                                        const content = getContentById(contentId);
                                        const name = content ? (content.name[lang as 'ja' | 'en'] || content.name.ja) : contentId;
                                        return (
                                            <div key={contentId} className="glass-tier3 rounded-xl p-4 opacity-50">
                                                <span className="text-sm font-bold">{name}</span>
                                                <p className="text-xs text-app-text-muted mt-1">{t('popular.no_data')}</p>
                                            </div>
                                        );
                                    }
                                    return plans.map((plan, idx) => (
                                        <PlanCard
                                            key={plan.shareId}
                                            plan={plan}
                                            rank={idx + 1}
                                            contentId={contentId}
                                            onCopy={copySinglePlan}
                                            lang={lang}
                                            t={t}
                                        />
                                    ));
                                })}
                            </div>
                        </section>

                        {/* ── 絶セクション ── */}
                        <section>
                            <h2 className="text-lg font-bold flex items-center gap-2 mb-6">
                                <Crown size={18} />
                                {t('popular.ultimate_section')}
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {ultimateIds.map(contentId => {
                                    const plans = data[contentId] || [];
                                    if (plans.length === 0) {
                                        const content = getContentById(contentId);
                                        const name = content ? (content.name[lang as 'ja' | 'en'] || content.name.ja) : contentId;
                                        return (
                                            <div key={contentId} className="glass-tier3 rounded-xl p-4 opacity-50">
                                                <span className="text-sm font-bold">{name}</span>
                                                <p className="text-xs text-app-text-muted mt-1">{t('popular.no_data')}</p>
                                            </div>
                                        );
                                    }
                                    return plans.map((plan, idx) => (
                                        <PlanCard
                                            key={plan.shareId}
                                            plan={plan}
                                            rank={idx + 1}
                                            contentId={contentId}
                                            onCopy={copySinglePlan}
                                            lang={lang}
                                            t={t}
                                        />
                                    ));
                                })}
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/PopularPage.tsx
git commit -m "feat: 人気ページコンポーネント作成"
```

---

## Task 6: ルーティング追加

**Files:**
- Modify: `src/App.tsx:88-96`（Route定義部分）

- [ ] **Step 1: App.tsx に /popular ルートを追加**

`src/App.tsx` のインポートに追加:
```typescript
import { PopularPage } from './components/PopularPage';
```

Route定義に追加（`/share/:shareId` の前あたり）:
```typescript
<Route path="/popular" element={<PopularPage />} />
```

- [ ] **Step 2: コミット**

```bash
git add src/App.tsx
git commit -m "feat: /popularルート追加"
```

---

## Task 7: コントロールバーに人気ページボタン追加

**Files:**
- Modify: `src/components/ConsolidatedHeader.tsx:372-384`（My Job Highlightボタンの前）

- [ ] **Step 1: ハイライトボタンの左隣に人気ページボタンを追加**

`ConsolidatedHeader.tsx` の右側グループ、`{/* My Job Highlight */}` の直前に追加:

```typescript
{/* Popular Plans — 別タブで /popular を開く */}
<Tooltip content={t('popular.open_popular')}>
    <button
        onClick={() => window.open('/popular', '_blank')}
        className={clsx(pillBtnBase, pillBtnDefault)}
    >
        <Crown size={14} className="shrink-0 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />
        <span className="text-[10px] font-black uppercase tracking-[0.1em]">{t('popular.open_popular')}</span>
    </button>
</Tooltip>
```

インポートに `Crown` を追加（lucide-reactから）:
```typescript
import { ..., Crown } from 'lucide-react';
```

- [ ] **Step 2: コミット**

```bash
git add src/components/ConsolidatedHeader.tsx
git commit -m "feat: コントロールバーに人気ページボタン追加"
```

---

## Task 8: モバイルツールシートに人気ページリンク追加

**Files:**
- Modify: `src/components/Timeline.tsx:2221-2298`（MobileBottomSheet内）

- [ ] **Step 1: ツールシートに人気ページリンクを追加**

`Timeline.tsx` のモバイルツールシート内（Auto Planボタンの後）に追加:

```typescript
{/* Popular Plans */}
<button
    onClick={() => {
        window.open('/popular', '_blank');
        setMobileToolsSheetOpen(false);
    }}
    className="flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl border border-app-border hover:bg-app-surface2 transition-colors"
>
    <Crown size={18} className="text-app-text shrink-0" />
    <div>
        <p className="text-sm font-bold text-app-text">{t('popular.open_popular')}</p>
        <p className="text-xs text-app-text-muted">{t('popular.subtitle')}</p>
    </div>
</button>
```

インポートに `Crown` を追加:
```typescript
import { ..., Crown } from 'lucide-react';
```

- [ ] **Step 2: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat: モバイルツールシートに人気ページリンク追加"
```

---

## Task 9: 動作確認 + 最終コミット

- [ ] **Step 1: ローカルで dev サーバーを起動して動作確認**

```bash
npm run dev
```

確認項目:
1. `/miti` のコントロールバーに人気ページボタンが表示される
2. ボタンクリックで `/popular` が別タブで開く
3. `/popular` ページがダーク/ライトテーマで正しく表示される
4. 日本語/英語の切り替えが動作する
5. 「まだデータがありません」が各コンテンツカードに表示される（初回はデータなし）
6. スマホ表示でツールシートに人気ページリンクがある

- [ ] **Step 2: 共有→コピーの一連フローを確認**

1. `/miti` でプランを作成→共有URLを生成
2. 共有URLを開いて「自分のプランにコピー」
3. `/popular` を開いてコピーしたプランが表示されるか確認（キャッシュ15分なので即時反映されない場合あり）

- [ ] **Step 3: Firestoreインデックスの確認**

初回の `/api/popular` GET リクエストでFirestoreがインデックスエラーを返す場合:
- Vercelのログに複合インデックス作成URLが表示される
- そのURLをクリックしてFirebase Consoleでインデックスを作成する
- インデックス作成には数分かかる

- [ ] **Step 4: まとめコミット（必要なら）**

```bash
git add -A
git commit -m "feat: 軽減表人気ページ完成"
```
