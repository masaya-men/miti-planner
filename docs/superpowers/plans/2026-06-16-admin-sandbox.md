# 管理画面サンドボックス Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 開発時だけ「ログインの壁スルー＋データをダミーにすり替え」で、本物の `/admin`（まずテンプレート管理ページ）をローカルでデプロイ無しに表示・操作できる開発専用サンドボックスを追加する。

**Architecture:** モード判定 `isAdminSandbox()`（`import.meta.env.DEV` かつ `MODE==='admin-sandbox'` の二重ガード）が真のときだけ、①起動時に偽管理者を `useAuthStore` へ注入し本物の `AdminGuard` を通過、②単一窓口 `apiFetch` の先頭でダミー応答にすり替え。ダミー一式は `src/dev/adminSandbox/` に隔離し動的 import 境界 + `import.meta.env.DEV` 静的ガードで本番バンドルから完全除外。本体改変は `apiClient.ts` の分岐1本・`useAuthStore.ts` のリスナー条件化・`main.tsx` の起動フックのみ。

**Tech Stack:** Vite 7 (`--mode`), React 19, Zustand 5, Firebase Auth (型のみ流用), Vitest 4。新規ライブラリ依存なし。

設計書: [docs/superpowers/specs/2026-06-16-admin-sandbox-design.md](../specs/2026-06-16-admin-sandbox-design.md)

---

## File Structure

| ファイル | 責務 | 種別 |
|---------|------|------|
| `src/dev/sandboxMode.ts` | `isAdminSandbox(env?)` 純関数（二重ガード判定）。本番でも false を返すだけの軽量モジュール（静的 import 可） | 新規 |
| `src/dev/sandboxMode.test.ts` | 判定ロジックのテスト（ON/OFF・本番で必ず false） | 新規 |
| `src/dev/adminSandbox/fixtures/templates.ts` | テンプレート管理ページ用ダミー生成（contents / 一覧 / 詳細 / 昇格候補） | 新規 |
| `src/dev/adminSandbox/store.ts` | メモリ上の可変ストア。CRUD で書き換え→再取得に反映 + テスト用 reset | 新規 |
| `src/dev/adminSandbox/mockApi.ts` | `mockApiFetch(url, options)`: URL/メソッドからダミー `Response` を返す。未対応は `null` | 新規 |
| `src/dev/adminSandbox/mockApi.test.ts` | mockApi + store の振る舞いテスト | 新規 |
| `src/dev/adminSandbox/bootstrap.ts` | `initAdminSandbox()`: 偽管理者を `useAuthStore` に注入 | 新規 |
| `src/lib/apiClient.ts` | `apiFetch` 先頭にサンドボックス分岐を1本追加 | 改修 |
| `src/store/useAuthStore.ts` | 末尾の `onAuthStateChanged` 登録 + `processPendingAuth()` をサンドボックス時はスキップ | 改修 |
| `src/main.tsx` | サンドボックス時のみ bootstrap を動的 import して起動 | 改修 |
| `package.json` | `dev:admin` script 追加 | 改修 |

**重要な不変条件（全タスク共通・絶対に崩さない）:**
本番（`vite build`）に開発専用コードを1バイトも入れないため、本体側の各ガードは必ず `import.meta.env.DEV && isAdminSandbox()` の形にする。先頭の `import.meta.env.DEV` は Vite が本番ビルドで静的に `false` へ置換し、`false && ...`（内側の `await import(...)` 含む）を dead-code として丸ごと除去するために**必須**。`isAdminSandbox()` も内部で DEV を見るが、関数呼び出しは静的除去できないため、この先頭ガードは「冗長に見えても削除しない」。

---

## Task 1: モード判定ヘルパー `isAdminSandbox`

**Files:**
- Create: `src/dev/sandboxMode.ts`
- Test: `src/dev/sandboxMode.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/dev/sandboxMode.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isAdminSandbox } from './sandboxMode';

describe('isAdminSandbox', () => {
  it('DEV かつ MODE=admin-sandbox のとき true', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'admin-sandbox' })).toBe(true);
  });

  it('本番ビルド (DEV=false) では必ず false', () => {
    expect(isAdminSandbox({ DEV: false, MODE: 'admin-sandbox' })).toBe(false);
  });

  it('MODE が別 (通常の dev) なら false', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'development' })).toBe(false);
  });

  it('vitest のデフォルト MODE=test なら false', () => {
    expect(isAdminSandbox({ DEV: true, MODE: 'test' })).toBe(false);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/dev/sandboxMode.test.ts`
Expected: FAIL（`isAdminSandbox` が存在しない）

- [ ] **Step 3: 実装を書く**

`src/dev/sandboxMode.ts`:
```ts
/**
 * 管理画面サンドボックスモードの判定（単一の真実源）。
 * 有効になるのは「dev サーバー (import.meta.env.DEV) かつ MODE==='admin-sandbox'」のときだけ。
 * 本番ビルドでは DEV が false になるため、ここは必ず false を返す。
 *
 * env を引数で受けるのはテスト容易性のため。実コードは引数なしで呼ぶ。
 */
export function isAdminSandbox(
  env: { DEV: boolean; MODE: string } = import.meta.env,
): boolean {
  return env.DEV === true && env.MODE === 'admin-sandbox';
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/dev/sandboxMode.test.ts`
Expected: PASS（4件）

- [ ] **Step 5: コミット**

```bash
rtk git add src/dev/sandboxMode.ts src/dev/sandboxMode.test.ts
rtk git commit -m "feat(admin-sandbox): モード判定ヘルパー isAdminSandbox (二重ガード)"
```

---

## Task 2: ダミーデータ生成（fixtures）

テンプレート管理ページが読む実際のフィールドに厳密一致させる。型は実コード由来:
`TimelineEvent`([src/types/index.ts:103](../../../src/types/index.ts#L103))、`LocalizedString`([src/types/index.ts:1](../../../src/types/index.ts#L1))、`TemplateData.phases/labels`([src/data/templateLoader.ts:14](../../../src/data/templateLoader.ts#L14))。

**Files:**
- Create: `src/dev/adminSandbox/fixtures/templates.ts`

- [ ] **Step 1: fixtures を実装**

`src/dev/adminSandbox/fixtures/templates.ts`:
```ts
import type { TimelineEvent, LocalizedString } from '../../../types';

/** ドロップダウン用コンテンツ（AdminTemplates が読むのは id / nameJa / name?.ja のみ） */
export interface ContentItem {
  id: string;
  nameJa?: string;
  name?: { ja?: string; en?: string };
}

/** 一覧テーブル1行（API レスポンス形。AdminTemplates が lastUpdatedAt→updatedAt にマップする） */
export interface TemplateRow {
  contentId: string;
  source: string;
  eventCount: number;
  phaseCount: number;
  lockedAt: string | null;
  lastUpdatedAt: string;
}

/** 昇格候補 */
export interface PromotionCandidate {
  shareId: string;
  contentId: string;
  title: string;
  copyCount: number;
}

/** スプレッドシート詳細（GET ?resource=templates&id=◯◯ のレスポンス形） */
export interface TemplateDetail {
  timelineEvents: TimelineEvent[];
  phases: { id: number; startTimeSec: number; name?: LocalizedString }[];
  labels: { id: number; startTimeSec: number; name: LocalizedString; endTimeSec?: number }[];
}

const SOURCES = ['admin_editor', 'csv_import', 'plan_promote', 'fflogs'];

const contentId = (i: number) => `content-${String(i + 1).padStart(3, '0')}`;

/** 決定的な ISO 日付（Date.now を使わず再現性を確保） */
const isoDate = (i: number) => {
  const day = String((i % 28) + 1).padStart(2, '0');
  return `2026-05-${day}T08:30:00.000Z`;
};

export function makeContents(n: number): ContentItem[] {
  return Array.from({ length: n }, (_, i) => ({
    id: contentId(i),
    nameJa: `ダミーコンテンツ ${i + 1}`,
    name: { ja: `ダミーコンテンツ ${i + 1}`, en: `Dummy Content ${i + 1}` },
  }));
}

export function makeTemplateRows(n: number): TemplateRow[] {
  return Array.from({ length: n }, (_, i) => ({
    contentId: contentId(i),
    source: SOURCES[i % SOURCES.length],
    eventCount: 20 + (i % 30),
    phaseCount: 3 + (i % 5),
    lockedAt: i % 4 === 0 ? isoDate(i) : null,
    lastUpdatedAt: isoDate(i),
  }));
}

export function makeCandidates(n: number): PromotionCandidate[] {
  return Array.from({ length: n }, (_, i) => ({
    shareId: `share-${String(i + 1).padStart(3, '0')}`,
    contentId: contentId(i),
    title: `みんなの軽減表 候補 ${i + 1}`,
    copyCount: 50 - i * 3,
  }));
}

/** id を渡すと、その表の中身を決定的に生成する */
export function makeTimelineDetail(id: string): TemplateDetail {
  const damageTypes: TimelineEvent['damageType'][] = ['magical', 'physical', 'unavoidable', 'enrage'];
  const targets = ['AoE', 'MT', 'ST'] as const;

  const timelineEvents: TimelineEvent[] = Array.from({ length: 40 }, (_, i) => ({
    id: `${id}-ev-${i + 1}`,
    time: 10 + i * 15,
    // 3件に1件は en 未翻訳にして「未翻訳あり」状態の見た目も確認できるようにする
    name: { ja: `ギミック${i + 1}`, en: i % 3 === 0 ? '' : `Mechanic ${i + 1}` },
    damageType: damageTypes[i % damageTypes.length],
    damageAmount: 80000 + (i % 5) * 10000,
    target: targets[i % targets.length],
  }));

  const phases = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    startTimeSec: i * 120,
    name: { ja: `フェーズ${i + 1}`, en: `Phase ${i + 1}` } as LocalizedString,
  }));

  const labels = Array.from({ length: 6 }, (_, i) => ({
    id: i + 1,
    startTimeSec: i * 100,
    name: { ja: `ラベル${i + 1}`, en: `Label ${i + 1}` } as LocalizedString,
  }));

  return { timelineEvents, phases, labels };
}
```

- [ ] **Step 2: 型チェックで壊れていないことを確認**

Run: `npx tsc -b --noEmit` *(または該当ファイルが含まれる `npm run build` の tsc フェーズ)*
Expected: エラーなし（fixtures の型が実型と一致）

- [ ] **Step 3: コミット**

```bash
rtk git add src/dev/adminSandbox/fixtures/templates.ts
rtk git commit -m "feat(admin-sandbox): テンプレート管理ページ用ダミーデータ生成"
```

---

## Task 3: メモリ上ストア（CRUD 反映）

**Files:**
- Create: `src/dev/adminSandbox/store.ts`

- [ ] **Step 1: ストアを実装**

`src/dev/adminSandbox/store.ts`:
```ts
import {
  makeContents,
  makeTemplateRows,
  makeCandidates,
  makeTimelineDetail,
  type ContentItem,
  type TemplateRow,
  type PromotionCandidate,
  type TemplateDetail,
} from './fixtures/templates';

let contents: ContentItem[];
let templates: TemplateRow[];
let candidates: PromotionCandidate[];
let detailCache: Map<string, TemplateDetail>;

/** 初期データを再シードする（テストの beforeEach でも使用） */
export function resetSandboxStore(): void {
  contents = makeContents(60);
  templates = makeTemplateRows(60);
  candidates = makeCandidates(8);
  detailCache = new Map();
}

resetSandboxStore(); // モジュール読込時に初回シード

interface SaveBody {
  contentId: string;
  timelineEvents?: TemplateDetail['timelineEvents'];
  phases?: TemplateDetail['phases'];
  labels?: TemplateDetail['labels'];
  source?: string;
}

export const sandboxStore = {
  listContents: (): ContentItem[] => contents,
  listTemplates: (): TemplateRow[] => templates,
  listCandidates: (): PromotionCandidate[] => candidates,

  /** 詳細は初回アクセス時に生成してキャッシュ（同じ表は同じ中身を返す） */
  getTemplateDetail(id: string): TemplateDetail {
    if (!detailCache.has(id)) detailCache.set(id, makeTimelineDetail(id));
    return detailCache.get(id)!;
  },

  /** 保存: 詳細を差し替え、一覧行を更新（無ければ先頭に追加） */
  saveTemplate(body: SaveBody): void {
    const now = '2026-06-16T12:00:00.000Z';
    detailCache.set(body.contentId, {
      timelineEvents: body.timelineEvents ?? [],
      phases: body.phases ?? [],
      labels: body.labels ?? [],
    });
    const eventCount = body.timelineEvents?.length ?? 0;
    const phaseCount = body.phases?.length ?? 0;
    const existing = templates.find((t) => t.contentId === body.contentId);
    if (existing) {
      templates = templates.map((t) =>
        t.contentId === body.contentId
          ? { ...t, eventCount, phaseCount, lastUpdatedAt: now, source: body.source ?? t.source }
          : t,
      );
    } else {
      templates = [
        { contentId: body.contentId, source: body.source ?? 'admin_editor', eventCount, phaseCount, lockedAt: null, lastUpdatedAt: now },
        ...templates,
      ];
    }
  },

  setLock(contentId: string, lock: boolean): void {
    const now = '2026-06-16T12:00:00.000Z';
    templates = templates.map((t) =>
      t.contentId === contentId ? { ...t, lockedAt: lock ? now : null } : t,
    );
  },

  deleteTemplate(contentId: string): void {
    templates = templates.filter((t) => t.contentId !== contentId);
    detailCache.delete(contentId);
  },

  resolveCandidate(shareId: string): void {
    candidates = candidates.filter((c) => c.shareId !== shareId);
  },
};
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/dev/adminSandbox/store.ts
rtk git commit -m "feat(admin-sandbox): メモリ上ストア(CRUDで一覧に即反映)"
```

---

## Task 4: ダミー API ルーター `mockApiFetch`（TDD）

**Files:**
- Create: `src/dev/adminSandbox/mockApi.ts`
- Test: `src/dev/adminSandbox/mockApi.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/dev/adminSandbox/mockApi.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mockApiFetch } from './mockApi';
import { resetSandboxStore } from './store';

beforeEach(() => resetSandboxStore());

describe('mockApiFetch', () => {
  it('GET contents は items 配列を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=contents');
    expect(res).not.toBeNull();
    const body = await res!.json();
    expect(body.items.length).toBe(60);
    expect(body.items[0].id).toBe('content-001');
  });

  it('GET templates 一覧は templates 配列を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    expect(body.templates.length).toBe(60);
    expect(body.templates[0]).toHaveProperty('lastUpdatedAt');
  });

  it('GET templates&id は詳細(timelineEvents/phases/labels)を返す', async () => {
    const res = await mockApiFetch('/api/admin?resource=templates&id=content-001');
    const body = await res!.json();
    expect(body.timelineEvents.length).toBe(40);
    expect(body.phases.length).toBe(5);
    expect(body.labels.length).toBe(6);
  });

  it('DELETE templates は一覧から消える', async () => {
    await mockApiFetch('/api/admin?resource=templates&contentId=content-001', { method: 'DELETE' });
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    expect(body.templates.some((t: { contentId: string }) => t.contentId === 'content-001')).toBe(false);
    expect(body.templates.length).toBe(59);
  });

  it('PUT templates でロック状態が反映される', async () => {
    await mockApiFetch('/api/admin?resource=templates', {
      method: 'PUT',
      body: JSON.stringify({ contentId: 'content-002', lock: true }),
    });
    const res = await mockApiFetch('/api/admin?resource=templates');
    const body = await res!.json();
    const row = body.templates.find((t: { contentId: string }) => t.contentId === 'content-002');
    expect(row.lockedAt).not.toBeNull();
  });

  it('GET 昇格候補は candidates を返し、POST で1件消える', async () => {
    const before = await (await mockApiFetch('/api/template?action=promote&candidates=true'))!.json();
    expect(before.candidates.length).toBe(8);
    await mockApiFetch('/api/template?action=promote', {
      method: 'POST',
      body: JSON.stringify({ shareId: before.candidates[0].shareId, action: 'approve' }),
    });
    const after = await (await mockApiFetch('/api/template?action=promote&candidates=true'))!.json();
    expect(after.candidates.length).toBe(7);
  });

  it('未対応の URL は null を返す(本物へフォールバック)', async () => {
    const res = await mockApiFetch('/api/auth?provider=discord', { method: 'POST' });
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/dev/adminSandbox/mockApi.test.ts`
Expected: FAIL（`mockApi` が存在しない）

- [ ] **Step 3: 実装を書く**

`src/dev/adminSandbox/mockApi.ts`:
```ts
import { sandboxStore } from './store';

/**
 * 管理画面の API 呼び出しをダミーにすり替える。
 * 該当する URL/メソッドならダミー Response を、該当しなければ null（=本物の fetch へフォールバック）を返す。
 * ネットワーク・本番・Firestore には一切アクセスしない。
 */
export async function mockApiFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response | null> {
  const method = (options.method ?? 'GET').toUpperCase();
  const parsed = new URL(url, 'http://localhost');
  const path = parsed.pathname;
  const params = parsed.searchParams;

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  const readBody = (): Record<string, unknown> =>
    options.body ? JSON.parse(options.body as string) : {};

  // /api/admin?resource=contents
  if (path === '/api/admin' && params.get('resource') === 'contents' && method === 'GET') {
    return json({ items: sandboxStore.listContents() });
  }

  // /api/admin?resource=templates  (id ありは詳細、なしは一覧、POST/PUT/DELETE は更新)
  if (path === '/api/admin' && params.get('resource') === 'templates') {
    const id = params.get('id');
    if (method === 'GET' && id) {
      return json(sandboxStore.getTemplateDetail(id));
    }
    if (method === 'GET') {
      return json({ templates: sandboxStore.listTemplates() });
    }
    if (method === 'POST') {
      sandboxStore.saveTemplate(readBody() as Parameters<typeof sandboxStore.saveTemplate>[0]);
      return json({ ok: true });
    }
    if (method === 'PUT') {
      const body = readBody();
      sandboxStore.setLock(String(body.contentId), Boolean(body.lock));
      return json({ ok: true });
    }
    if (method === 'DELETE') {
      sandboxStore.deleteTemplate(params.get('contentId') ?? '');
      return json({ ok: true });
    }
  }

  // /api/template?action=promote
  if (path === '/api/template' && params.get('action') === 'promote') {
    if (method === 'GET' && params.get('candidates') === 'true') {
      return json({ candidates: sandboxStore.listCandidates() });
    }
    if (method === 'POST') {
      sandboxStore.resolveCandidate(String(readBody().shareId));
      return json({ ok: true });
    }
  }

  return null; // 未対応 → 本物へフォールバック
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/dev/adminSandbox/mockApi.test.ts`
Expected: PASS（7件）

- [ ] **Step 5: コミット**

```bash
rtk git add src/dev/adminSandbox/mockApi.ts src/dev/adminSandbox/mockApi.test.ts
rtk git commit -m "feat(admin-sandbox): ダミーAPIルーター mockApiFetch (TDD)"
```

---

## Task 5: 偽管理者の注入 `bootstrap`

`useAuthStore` の状態を直接書き換えて「管理者でログイン済み」を作る。`AdminGuard`([src/components/admin/AdminGuard.tsx:9](../../../src/components/admin/AdminGuard.tsx#L9)) は `loading`/`user`/`isAdmin` のみ見るので、最小の偽ユーザーで通過する。`apiFetch` はサンドボックスでは本物の `auth.currentUser` に到達する前にすり替えられるため、偽ユーザーは型を満たす最小実装でよい。

**Files:**
- Create: `src/dev/adminSandbox/bootstrap.ts`

- [ ] **Step 1: bootstrap を実装**

`src/dev/adminSandbox/bootstrap.ts`:
```ts
import type { User } from 'firebase/auth';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * 偽管理者を useAuthStore に注入する。
 * サンドボックスでは onAuthStateChanged を登録しない（useAuthStore 側でガード）ため、
 * この状態が null で上書きされることはない。
 */
export function initAdminSandbox(): void {
  const fakeUser = {
    uid: 'sandbox-admin',
    displayName: 'Sandbox Admin',
    email: null,
    photoURL: null,
  } as unknown as User;

  useAuthStore.setState({
    user: fakeUser,
    isAdmin: true,
    loading: false,
    profileDisplayName: 'Sandbox Admin',
    isNewUser: false,
  });

  // eslint-disable-next-line no-console
  console.info('[admin-sandbox] 偽管理者を注入しました。/admin が利用可能です。');
}
```

- [ ] **Step 2: 型チェック**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
rtk git add src/dev/adminSandbox/bootstrap.ts
rtk git commit -m "feat(admin-sandbox): 偽管理者を注入する bootstrap"
```

---

## Task 6: 本体配線（apiFetch 分岐 / 認証リスナー条件化 / 起動フック / script）

ここで初めて本体に触れる。3 箇所すべて `import.meta.env.DEV && isAdminSandbox()` 形のガード付き（File Structure の不変条件参照）。

**Files:**
- Modify: `src/lib/apiClient.ts:9-37`
- Modify: `src/store/useAuthStore.ts:279-320`
- Modify: `src/main.tsx:1-15`
- Modify: `package.json:7`

- [ ] **Step 1: `apiFetch` の先頭にダミー分岐を追加**

`src/lib/apiClient.ts` — 既存の import 群に追加:
```ts
import { isAdminSandbox } from '../dev/sandboxMode';
```
`apiFetch` 関数本体の冒頭（`const headers = new Headers(...)` の直前）に挿入:
```ts
  // 管理画面サンドボックス: dev かつ admin-sandbox モードのときだけダミー応答にすり替える。
  // 先頭の import.meta.env.DEV は本番ビルドでこのブロック(動的importごと)を dead-code 除去するために必須。
  if (import.meta.env.DEV && isAdminSandbox()) {
    const { mockApiFetch } = await import('../dev/adminSandbox/mockApi');
    const mocked = await mockApiFetch(url, options);
    if (mocked) return mocked;
  }
```

- [ ] **Step 2: 認証リスナーをサンドボックス時はスキップ**

`src/store/useAuthStore.ts` — 既存 import 群に追加:
```ts
import { isAdminSandbox } from '../dev/sandboxMode';
```
末尾の `onAuthStateChanged(auth, async (user) => { ... });`（[L280-317](../../../src/store/useAuthStore.ts#L280)）と `processPendingAuth();`（L320）を、まとめて条件ブロックで囲う:
```ts
// サンドボックスでは本物の認証を一切起動しない（偽管理者が bootstrap で注入される）。
// 先頭の import.meta.env.DEV は本番でこの条件を常に true 側へ静的解決させ通常起動を保証する。
if (!(import.meta.env.DEV && isAdminSandbox())) {
  // Auth状態の監視（アプリ起動時に1回だけ実行）
  onAuthStateChanged(auth, async (user) => {
    // ……既存の中身をそのまま……
  });

  // リダイレクト認証の結果を処理
  processPendingAuth();
}
```
（中身は既存コードを移動するだけ。ロジック変更なし。）

- [ ] **Step 3: `main.tsx` で起動時に bootstrap を動的 import**

`src/main.tsx` を次のように変更:
```ts
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import './i18n'
import './styles/housing.css'
import { isAdminSandbox } from './dev/sandboxMode'

// 管理画面サンドボックス: 偽管理者を注入してから描画する。
// 先頭の import.meta.env.DEV は本番でこのブロック(動的importごと)を dead-code 除去するために必須。
if (import.meta.env.DEV && isAdminSandbox()) {
  void import('./dev/adminSandbox/bootstrap').then((m) => m.initAdminSandbox())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 4: `dev:admin` script を追加**

`package.json` の `scripts` に追加（`"dev": "vite",` の直後）:
```json
    "dev:admin": "vite --mode admin-sandbox",
```

- [ ] **Step 5: 通常の dev/test/build が無影響なことを確認**

Run: `npx vitest run src/dev`
Expected: PASS（Task1+4 の全テスト緑）

Run: `npm run build`
Expected: EXIT 0（tsc 厳密ビルド通過。未使用 import なし）

- [ ] **Step 6: コミット**

```bash
rtk git add src/lib/apiClient.ts src/store/useAuthStore.ts src/main.tsx package.json
rtk git commit -m "feat(admin-sandbox): 本体配線(apiFetch分岐/認証スキップ/起動フック/dev:adminスクリプト)"
```

---

## Task 7: 手動動作確認（テンプレート管理ページ）

自動テストでロジックは担保済み。ここは実画面の目視確認（ユーザーと一緒に）。

- [ ] **Step 1: サンドボックス起動**

Run: `npm run dev:admin`
ブラウザで `http://localhost:5173/admin/templates` を開く。

- [ ] **Step 2: 確認項目**

- ログイン無しで `/admin/templates` が表示される（`/` にリダイレクトされない）
- 一覧テーブルに 60 行のダミーが並ぶ（source / イベント数 / フェーズ数 / ロック / 更新日が埋まっている）
- ドロップダウンに 60 件のコンテンツが出る
- 行クリック → スプレッドシートエディターが開き、40 イベント・5 フェーズが表示される
- 「ロック」ボタン → 表示が「ロック中」に変わる
- 「削除」ボタン → 確認 OK で一覧から消える
- 昇格候補セクションに 8 件出る → 承認/却下で 1 件減る
- ブラウザをリロード → ダミーが初期状態に戻る（メモリ上のため正常）

- [ ] **Step 3: 通常 dev に副作用がないことを確認**

Run: `npm run dev`（別途）
`http://localhost:5173/admin` を開く → **ログインを要求/リダイレクトされる**（=サンドボックスが誤発火していない）。確認したら停止。

---

## Task 8: 本番バンドル除外の検証

- [ ] **Step 1: 本番ビルド**

Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 2: 成果物に開発専用コードが入っていないことを確認**

Run（Git Bash）: `grep -rl "ダミーコンテンツ\|sandbox-admin\|mockApiFetch" dist/ ; echo "exit=$?"`
Expected: 何もヒットしない（`grep` が exit=1）。= fixtures/mockApi/bootstrap の文字列が本番成果物に存在しない。

- [ ] **Step 3: 確認結果をコミット不要（検証のみ）**

問題があれば File Structure 冒頭の不変条件（`import.meta.env.DEV &&` の静的ガード）が崩れていないか Task 6 を見直す。

---

## Self-Review チェック結果

- **Spec coverage**: 設計書§3(すり替え2点)=Task5/6、§3起動方法=Task6 Step4、§4モジュール構成=Task1-5、§5データフロー/ダミー=Task2-4、§6エラー(未対応URLはnull)=Task4 最終テスト、§7テスト=Task1/4、§8本番除外=Task8。網羅。
- **Placeholder scan**: TBD/TODO・抽象指示なし。全コード実体記載。
- **Type consistency**: `isAdminSandbox` 署名・`sandboxStore` メソッド名(saveTemplate/setLock/deleteTemplate/resolveCandidate/getTemplateDetail/list*)・fixtures 型(ContentItem/TemplateRow/PromotionCandidate/TemplateDetail) は Task 間で一致。`mockApiFetch` 戻り値 `Response|null` は apiClient 分岐の `if (mocked) return mocked` と整合。
