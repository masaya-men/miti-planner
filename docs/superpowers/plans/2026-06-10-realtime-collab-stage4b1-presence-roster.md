# 段取り④-b-1 presence roster 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集の部屋にいる参加者の顔ぶれ(誰がいる・色・編集/閲覧の別・人数)を、既存 WebSocket awareness 経由で全員に確実表示する。

**Architecture:** クライアントのみ(サーバ改修ゼロ)。y-partyserver の `provider.awareness`(y-protocols Awareness・既にサーバが中継済み)に各クライアントが `presence` フィールドを載せ、変化を購読して roster を組み立て、zustand store 経由で UI(ツールバーのチップ + オーナーパネル)に出す。yjs/y-protocols を静的 import しない遅延境界を維持するため、awareness を触る配線は遅延チャンク(`collabProvider.ts`)に置き、純粋ロジックは `presence.ts`(yjs 非依存)に分離してテストする。

**Tech Stack:** TypeScript / React / zustand / y-partyserver provider.awareness / vitest(happy-dom)。

**設計書:** [docs/superpowers/specs/2026-06-10-realtime-collab-stage4b-presence-cursors-design.md](../specs/2026-06-10-realtime-collab-stage4b-presence-cursors-design.md) §3・§4.1・§7・§10(④-b-1)。

**スコープ注記(設計書 §10 からの精緻化):** ④-b-1 は「誰がいるか(色・編集/閲覧バッジ・人数)」の表示に絞る。`PresenceState` には `jobId` / `cursorEnabled` フィールドを**最初から持たせる**(④-b-2 で awareness を作り直さないため)が、**その選択 UI(ジョブ自己選択・カーソル ON/OFF トグル)は ④-b-2 に送る**(カーソルが出て初めて意味を持つため)。b-1 では `jobId=null` / `cursorEnabled=true` 固定。

---

## File Structure

- **Create `src/lib/collab/presence.ts`** — 純粋ロジック + awareness 配線。`PresenceState` / `RosterEntry` 型、`PALETTE`、`colorForClient`、`buildRoster`、`AwarenessLike` 型、`wirePresence`。yjs 非依存。
- **Create `src/lib/collab/__tests__/presence.test.ts`** — 上記の純粋テスト(fake awareness)。
- **Create `src/store/useCollabPresenceStore.ts`** — `roster` を保持し UI へ公開する zustand store(非永続)。
- **Create `src/store/__tests__/useCollabPresenceStore.test.ts`** — store テスト。
- **Modify `src/lib/collab/collabProvider.ts`** — `startCollabSession` で `wirePresence` を結線し roster を store へ、`disconnect` で解除。
- **Modify `src/components/ShareButtons.tsx`** — オーナーのツールバーチップに実人数を表示。
- **Create `src/components/collab/__tests__/ShareButtons.roster.test.tsx`** — チップ人数表示テスト。
- **Modify `src/components/collab/OwnerCollabPanel.tsx`** — パネルに参加者リスト(色ドット + 編集/閲覧バッジ)。
- **Modify `src/components/collab/__tests__/OwnerCollabPanel.test.tsx`** — roster 表示テストを追加。
- **Modify `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`** — `collab.chip_active_count` / `collab.roster_*` キー。

---

## Task 1: presence.ts 純粋ロジック(色 + roster 組み立て)

**Files:**
- Create: `src/lib/collab/presence.ts`
- Test: `src/lib/collab/__tests__/presence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collab/__tests__/presence.test.ts
import { describe, it, expect } from 'vitest';
import { PALETTE, colorForClient, buildRoster, type PresenceState } from '../presence';

const p = (over: Partial<PresenceState> = {}): PresenceState => ({
  color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, ...over,
});

describe('colorForClient', () => {
  it('PALETTE 内の色を返し、同じ clientId は毎回同じ', () => {
    const c = colorForClient(5);
    expect(PALETTE).toContain(c);
    expect(colorForClient(5)).toBe(c);
  });
  it('負の clientId でも範囲内', () => {
    expect(PALETTE).toContain(colorForClient(-3));
  });
});

describe('buildRoster', () => {
  it('presence 付き state を RosterEntry 化し、自分を先頭・他は clientId 昇順', () => {
    const states = new Map<number, { presence?: PresenceState }>([
      [10, { presence: p({ color: '#aaa', isEditor: false }) }],
      [2, { presence: p({ color: '#bbb', isEditor: true }) }],
      [7, { presence: p({ color: '#ccc', isEditor: true }) }], // self
    ]);
    const r = buildRoster(states, 7);
    expect(r.map(e => e.clientId)).toEqual([7, 2, 10]);
    expect(r[0].isLocal).toBe(true);
    expect(r.find(e => e.clientId === 10)!.isEditor).toBe(false);
  });
  it('presence 未設定の state は除外する', () => {
    const states = new Map<number, { presence?: PresenceState }>([
      [1, {}],            // 未設定
      [2, { presence: p() }],
    ]);
    const r = buildRoster(states, 99);
    expect(r.map(e => e.clientId)).toEqual([2]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: FAIL（`Cannot find module '../presence'`）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collab/presence.ts
// ④-b-1: presence(roster)の純粋ロジック + awareness 配線(設計書 §3・§4.1)。
// roster は WS awareness(provider.awareness)で全員に確実配信する。
// yjs/y-protocols を静的 import しない(遅延境界)。awareness は AwarenessLike 経由で受け取り、
// 本物の Awareness は collabProvider(遅延チャンク)から、テストは fake を渡す。

/** 各クライアントが awareness.presence に載せる気配情報。④-b-2 で jobId/cursorEnabled を活用。 */
export interface PresenceState {
  color: string;          // 自動配色(colorForClient)。roster/カーソル共通。
  jobId: string | null;   // 自己表現ジョブ(④-b-2 で選択 UI)。b-1 は null。
  isEditor: boolean;      // 表示用バッジ(真実の権限は④-a サーバゲート)= !readOnly。
  cursorEnabled: boolean; // カーソル配信 ON/OFF(④-b-2 のトグル)。b-1 は既定 true。
}

/** UI が描く 1 参加者分。 */
export interface RosterEntry {
  clientId: number;
  color: string;
  jobId: string | null;
  isEditor: boolean;
  cursorEnabled: boolean;
  isLocal: boolean;
}

/**
 * 同室内で識別しやすい中間トーンのパレット。機能色の意味(純赤=削除/純青=進む/純黄=警告)と
 * 衝突しない色相に寄せる(DESIGN ルール)。最終色はユーザー視覚確認で微調整可(設計書 §11)。
 */
export const PALETTE: readonly string[] = [
  '#34d399', '#a78bfa', '#f472b6', '#22d3ee', '#fb923c',
  '#a3e635', '#e879f9', '#2dd4bf', '#818cf8', '#fbbf24',
];

/** clientId → 決定的に配色(同じ人は毎回同じ色)。負数も範囲内に丸める。 */
export function colorForClient(clientId: number): string {
  const n = PALETTE.length;
  return PALETTE[((clientId % n) + n) % n];
}

/** awareness の states マップを roster 配列へ。presence 未設定は除外。自分先頭→clientId 昇順。 */
export function buildRoster(
  states: Map<number, { presence?: PresenceState } | null | undefined>,
  localClientId: number,
): RosterEntry[] {
  const out: RosterEntry[] = [];
  for (const [clientId, st] of states) {
    const p = st?.presence;
    if (!p) continue;
    out.push({
      clientId,
      color: p.color,
      jobId: p.jobId ?? null,
      isEditor: !!p.isEditor,
      cursorEnabled: p.cursorEnabled !== false,
      isLocal: clientId === localClientId,
    });
  }
  out.sort((a, b) => (a.isLocal === b.isLocal ? a.clientId - b.clientId : a.isLocal ? -1 : 1));
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/collab/presence.ts src/lib/collab/__tests__/presence.test.ts
rtk git commit -m "feat(collab): ④-b-1 presence 純粋ロジック(colorForClient/buildRoster)"
```

---

## Task 2: wirePresence(awareness 配線)

**Files:**
- Modify: `src/lib/collab/presence.ts`
- Modify: `src/lib/collab/__tests__/presence.test.ts`

- [ ] **Step 1: Write the failing test**

`presence.test.ts` の末尾に追記:

```ts
import { wirePresence, type AwarenessLike } from '../presence';

class FakeAwareness implements AwarenessLike {
  clientID = 7;
  private local: Record<string, unknown> = {};
  private states = new Map<number, Record<string, unknown>>();
  private cbs: Array<() => void> = [];
  setLocalStateField(field: string, value: unknown) {
    this.local[field] = value;
    this.states.set(this.clientID, { ...this.local });
    this.fire();
  }
  getStates() { return this.states; }
  on(_e: 'change', cb: () => void) { this.cbs.push(cb); }
  off(_e: 'change', cb: () => void) { this.cbs = this.cbs.filter(c => c !== cb); }
  /** テスト用: 他者の参加をシミュレート。 */
  addPeer(id: number, state: Record<string, unknown>) { this.states.set(id, state); this.fire(); }
  private fire() { this.cbs.forEach(c => c()); }
}

describe('wirePresence', () => {
  it('local presence を載せ、変化のたびに roster を通知し、cleanup で購読解除', () => {
    const aw = new FakeAwareness();
    const seen: number[] = [];
    const stop = wirePresence(aw, p({ color: '#111' }), (r) => seen.push(r.length));
    // setLocalStateField(初期) で自分1人の roster が出る
    expect(seen.at(-1)).toBe(1);
    aw.addPeer(2, { presence: p({ color: '#222' }) });
    expect(seen.at(-1)).toBe(2);
    stop();
    aw.addPeer(3, { presence: p({ color: '#333' }) });
    expect(seen.at(-1)).toBe(2); // 解除後は通知されない
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: FAIL（`wirePresence` / `AwarenessLike` is not exported）

- [ ] **Step 3: Write minimal implementation**

`presence.ts` の末尾に追記:

```ts
/** provider.awareness(y-protocols Awareness)の必要最小インタフェース。テストで fake 可能にする。 */
export interface AwarenessLike {
  clientID: number;
  setLocalStateField(field: string, value: unknown): void;
  getStates(): Map<number, Record<string, unknown>>;
  on(event: 'change', cb: () => void): void;
  off(event: 'change', cb: () => void): void;
}

/**
 * local presence を awareness に載せ、変化を購読して roster を通知する。戻り値は購読解除関数。
 * setLocalStateField は内部で change を発火するため初期 roster も流れるが、念のため明示 emit する。
 */
export function wirePresence(
  awareness: AwarenessLike,
  local: PresenceState,
  onRoster: (roster: RosterEntry[]) => void,
): () => void {
  const emit = () =>
    onRoster(
      buildRoster(
        awareness.getStates() as Map<number, { presence?: PresenceState }>,
        awareness.clientID,
      ),
    );
  awareness.on('change', emit);
  awareness.setLocalStateField('presence', local);
  emit();
  return () => awareness.off('change', emit);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: PASS（全 describe 緑）

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/collab/presence.ts src/lib/collab/__tests__/presence.test.ts
rtk git commit -m "feat(collab): ④-b-1 wirePresence(awareness→roster 配線)"
```

---

## Task 3: useCollabPresenceStore

**Files:**
- Create: `src/store/useCollabPresenceStore.ts`
- Test: `src/store/__tests__/useCollabPresenceStore.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/store/__tests__/useCollabPresenceStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCollabPresenceStore } from '../useCollabPresenceStore';
import type { RosterEntry } from '../../lib/collab/presence';

const entry = (clientId: number): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, isLocal: false,
});

beforeEach(() => useCollabPresenceStore.setState({ roster: [] }));

describe('useCollabPresenceStore', () => {
  it('setRoster で roster を置き換える', () => {
    useCollabPresenceStore.getState().setRoster([entry(1), entry(2)]);
    expect(useCollabPresenceStore.getState().roster).toHaveLength(2);
  });
  it('clear で空にする', () => {
    useCollabPresenceStore.getState().setRoster([entry(1)]);
    useCollabPresenceStore.getState().clear();
    expect(useCollabPresenceStore.getState().roster).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/useCollabPresenceStore.test.ts`
Expected: FAIL（`Cannot find module '../useCollabPresenceStore'`）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/store/useCollabPresenceStore.ts
// ④-b-1: 部屋の参加者 roster を UI へ公開する store(非永続)。
// 遅延チャンク(collabProvider の wirePresence)が setRoster で更新し、
// ツールバーチップ/オーナーパネルが購読する。yjs 非依存(RosterEntry 型のみ参照)。
import { create } from 'zustand';
import type { RosterEntry } from '../lib/collab/presence';

interface CollabPresenceState {
  roster: RosterEntry[];
  setRoster: (roster: RosterEntry[]) => void;
  clear: () => void;
}

export const useCollabPresenceStore = create<CollabPresenceState>((set) => ({
  roster: [],
  setRoster: (roster) => set({ roster }),
  clear: () => set({ roster: [] }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/__tests__/useCollabPresenceStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/store/useCollabPresenceStore.ts src/store/__tests__/useCollabPresenceStore.test.ts
rtk git commit -m "feat(collab): ④-b-1 useCollabPresenceStore(roster 公開)"
```

---

## Task 4: collabProvider に presence を結線

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

> このタスクは実 `YProvider`(WebSocket)を生成する `startCollabSession` への配線で、単体テスト対象外(既存 collabProvider も純粋関数のみテスト)。ロジックは Task 1〜3 の単体テストで担保し、本タスクは型/ビルド + 後日の 2 ブラウザ実機で確認する。

- [ ] **Step 1: import を追加**

`collabProvider.ts` の import 群(`./collabTypes` の隣)に追加:

```ts
import { colorForClient, wirePresence, type AwarenessLike, type PresenceState } from './presence';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
```

- [ ] **Step 2: startCollabSession 内で wirePresence を結線**

`startCollabSession` 内、`const readOnly = opts.readOnly ?? false;` の行の**直後**に追加:

```ts
  // ④-b-1: roster(誰がいる・色・編集/閲覧)を WS awareness で全員に配信。
  // isEditor は表示用バッジ(真実の権限は④-a のサーバゲート)= 編集接続(!readOnly)か。
  const localPresence: PresenceState = {
    color: colorForClient(provider.awareness.clientID),
    jobId: null,         // ④-b-2 で自己選択 UI
    isEditor: !readOnly,
    cursorEnabled: true, // ④-b-2 でトグル
  };
  const stopPresence = wirePresence(
    provider.awareness as unknown as AwarenessLike,
    localPresence,
    (roster) => useCollabPresenceStore.getState().setRoster(roster),
  );
```

- [ ] **Step 3: disconnect で解除 + roster クリア**

`disconnect` 関数内、`provider.destroy();` の**直前**に追加:

```ts
    stopPresence();
    useCollabPresenceStore.getState().clear();
```

- [ ] **Step 4: 型チェック**

Run: `npx tsc -b --noEmit` （または `npm run build` を Task 8 でまとめて）
Expected: 型エラーなし（`provider.awareness` は AwarenessLike と構造的に互換。cast 済み）

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/collab/collabProvider.ts
rtk git commit -m "feat(collab): ④-b-1 startCollabSession に presence(roster)を結線"
```

---

## Task 5: ツールバーチップに実人数

**Files:**
- Modify: `src/components/ShareButtons.tsx`
- Modify: `src/locales/ja.json`
- Test: `src/components/collab/__tests__/ShareButtons.roster.test.tsx`

- [ ] **Step 1: ja.json にキー追加**

`collab` ブロックの `chip_active` の直後に追加:

```json
    "chip_active_count": "共同編集中 · {{count}}人",
```

- [ ] **Step 2: Write the failing test**

```tsx
// @vitest-environment happy-dom
// src/components/collab/__tests__/ShareButtons.roster.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShareButtons } from '../../ShareButtons';
import { useCollabSessionStore } from '../../../store/useCollabSessionStore';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.count != null ? `${k}:${o.count}` : k) }),
}));
vi.mock('../../../store/useAuthStore', () => ({ useAuthStore: () => ({ user: { uid: 'u1' } }) }));

const entry = (id: number): RosterEntry => ({
  clientId: id, color: '#fff', jobId: null, isEditor: true, cursorEnabled: true, isLocal: false,
});

beforeEach(() => {
  useCollabSessionStore.setState({ active: true } as any);
  useCollabPresenceStore.setState({ roster: [entry(1), entry(2), entry(3)] });
});

describe('ShareButtons チップ人数', () => {
  it('active かつ roster があれば人数つきチップを表示', () => {
    render(<ShareButtons contentLabel={null} currentPlan={undefined} />);
    expect(screen.getByText('collab.chip_active_count:3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/collab/__tests__/ShareButtons.roster.test.tsx`
Expected: FAIL（チップは静的 `collab.chip_active` を出すため `:3` が見つからない）

- [ ] **Step 4: ShareButtons を実人数表示に**

`ShareButtons.tsx` の `const { active, start } = useCollabSessionStore();` の直後に追加:

```tsx
    const rosterCount = useCollabPresenceStore(s => s.roster.length);
```

import 追加(`useCollabSessionStore` の import 行の下):

```tsx
import { useCollabPresenceStore } from '../store/useCollabPresenceStore';
```

チップのラベル部分を変更。現状:

```tsx
                        <Users size={13} /> {t('collab.chip_active')}
```

を次に置換:

```tsx
                        <Users size={13} /> {rosterCount > 0 ? t('collab.chip_active_count', { count: rosterCount }) : t('collab.chip_active')}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/collab/__tests__/ShareButtons.roster.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/ShareButtons.tsx src/components/collab/__tests__/ShareButtons.roster.test.tsx src/locales/ja.json
rtk git commit -m "feat(collab): ④-b-1 ツールバーチップに実参加人数を表示"
```

---

## Task 6: オーナーパネルに参加者リスト

**Files:**
- Modify: `src/components/collab/OwnerCollabPanel.tsx`
- Modify: `src/locales/ja.json`
- Modify: `src/components/collab/__tests__/OwnerCollabPanel.test.tsx`

- [ ] **Step 1: ja.json にキー追加**

`collab` ブロックの `participants_solo` の直後に追加:

```json
    "roster_title": "参加者",
    "roster_editor": "編集",
    "roster_viewer": "閲覧",
    "roster_you": "あなた",
```

- [ ] **Step 2: Write the failing test**

`OwnerCollabPanel.test.tsx` の `beforeEach` を roster も初期化する形に差し替え、テストを 1 つ追加。

ファイル先頭の import に追加:

```ts
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';
import type { RosterEntry } from '../../../lib/collab/presence';
```

`react-i18next` モックを count/max 両対応に差し替え:

```ts
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: any) => (o?.max ? `${k}:${o.max}` : o?.count != null ? `${k}:${o.count}` : k) }),
}));
```

`beforeEach` の末尾(`useCollabSessionStore.setState(...)` の後)に追加:

```ts
  useCollabPresenceStore.setState({
    roster: [
      { clientId: 7, color: '#34d399', jobId: null, isEditor: true, cursorEnabled: true, isLocal: true } as RosterEntry,
      { clientId: 2, color: '#a78bfa', jobId: null, isEditor: false, cursorEnabled: true, isLocal: false } as RosterEntry,
    ],
  });
```

`describe` 内に追加:

```ts
  it('参加者リストを色ドット + 編集/閲覧バッジで表示する', () => {
    render(<OwnerCollabPanel planId="plan1" onClose={() => {}} />);
    expect(screen.getByText('collab.roster_title')).toBeInTheDocument();
    expect(screen.getByText('collab.roster_you')).toBeInTheDocument();   // 自分の行
    expect(screen.getByText('collab.roster_editor')).toBeInTheDocument(); // 編集バッジ
    expect(screen.getByText('collab.roster_viewer')).toBeInTheDocument(); // 閲覧バッジ
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: FAIL（roster セクション未実装で `collab.roster_title` が無い）

- [ ] **Step 4: OwnerCollabPanel に roster セクション追加**

import 追加(`useCollabSessionStore` の import 行の下):

```tsx
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
```

コンポーネント本体、`const url = ...` の直後に追加:

```tsx
  const roster = useCollabPresenceStore(s => s.roster);
```

「人数」セクション(`{/* 人数 */}` の div)の**直後**に参加者リストを追加:

```tsx
          {/* 参加者(④-b-1) */}
          {roster.length > 0 && (
            <div>
              <div className="text-app-xs uppercase tracking-wide text-app-text-muted mb-1.5">{t('collab.roster_title')}</div>
              <ul className="space-y-1.5">
                {roster.map((m) => (
                  <li key={m.clientId} className="flex items-center gap-2 text-app-sm text-app-text">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                    <span className="flex-1 truncate">{m.isLocal ? t('collab.roster_you') : `#${m.clientId}`}</span>
                    <span className={`text-app-xs px-1.5 py-0.5 rounded ${m.isEditor ? 'text-app-text border border-app-border' : 'text-app-text-muted'}`}>
                      {m.isEditor ? t('collab.roster_editor') : t('collab.roster_viewer')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/collab/__tests__/OwnerCollabPanel.test.tsx`
Expected: PASS（既存 4 件 + 新規 1 件）

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/collab/OwnerCollabPanel.tsx src/components/collab/__tests__/OwnerCollabPanel.test.tsx src/locales/ja.json
rtk git commit -m "feat(collab): ④-b-1 オーナーパネルに参加者リスト(色/編集・閲覧バッジ)"
```

---

## Task 7: 多言語(en / ko / zh)

**Files:**
- Modify: `src/locales/en.json` / `src/locales/ko.json` / `src/locales/zh.json`

- [ ] **Step 1: 各 locale の `collab` ブロックにキー追加**

en.json(`chip_active` / `participants_solo` 付近に):

```json
    "chip_active_count": "Editing together · {{count}}",
    "roster_title": "Participants",
    "roster_editor": "Editing",
    "roster_viewer": "Viewing",
    "roster_you": "You",
```

ko.json:

```json
    "chip_active_count": "공동 편집 중 · {{count}}명",
    "roster_title": "참가자",
    "roster_editor": "편집",
    "roster_viewer": "보기",
    "roster_you": "나",
```

zh.json:

```json
    "chip_active_count": "协作编辑中 · {{count}}人",
    "roster_title": "参加者",
    "roster_editor": "编辑",
    "roster_viewer": "查看",
    "roster_you": "你",
```

> 各ファイルの既存 `collab` ブロック内に、キー名が他言語と一致するよう追加する(JSON カンマに注意)。

- [ ] **Step 2: JSON 妥当性確認**

Run: `node -e "['en','ko','zh','ja'].forEach(l=>{const j=require('./src/locales/'+l+'.json'); if(!j.collab.chip_active_count||!j.collab.roster_title) throw new Error(l); }); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
rtk git add src/locales/en.json src/locales/ko.json src/locales/zh.json
rtk git commit -m "feat(collab): ④-b-1 roster 文言の多言語(en/ko/zh)"
```

---

## Task 8: 全体検証 + 仕上げ

**Files:** なし(検証のみ)

- [ ] **Step 1: collab 関連テスト一式**

Run: `npx vitest run src/lib/collab src/store/__tests__/useCollabPresenceStore.test.ts src/store/__tests__/useCollabSessionStore.test.ts src/components/collab`
Expected: 全 PASS

- [ ] **Step 2: 型 + 本番ビルド([[feedback_vercel_tsc_strict]])**

Run: `npm run build`
Expected: 成功(tsc -b 厳密でも未使用変数/型不足なし)

- [ ] **Step 3: yjs 遅延チャンク維持の確認**

`presence.ts` / `useCollabPresenceStore.ts` / `ShareButtons.tsx` / `OwnerCollabPanel.tsx` のいずれも `yjs` / `y-partyserver` を静的 import していないこと(awareness を触るのは `collabProvider.ts` のみ)を grep で確認:

Run: `npx vitest run` を待たず、`rtk grep -n "from 'yjs'\|y-partyserver" src/lib/collab/presence.ts src/store/useCollabPresenceStore.ts src/components/ShareButtons.tsx src/components/collab/OwnerCollabPanel.tsx`
Expected: 0 件

- [ ] **Step 4: held のまま(push/deploy しない)**

設計書 §13 / 親方針どおり ④-b-1 も **UI 非露出・held**。ブランチに積むのみ。push/deploy/UI 露出は ⑤-3d 統合検証 + ユーザー承認まで保留。

> 注: ④-b-1 のチップ/パネルは「共同編集セッションが active のとき」だけ現れる。共同編集の入口(⑤-3a)自体が held で UI 非露出のため、roster もユーザーには見えない(ソロ利用者に影響ゼロ)。

---

## Self-Review（記入済み）

- **Spec coverage:** 設計書 §3(roster=WS / 表示は全員)→Task 1〜6。§4.1 `PresenceState`→Task 1。色→`colorForClient`(Task 1)。editor/viewer バッジ→Task 6。人数→Task 5。i18n(§7 4 言語)→Task 5〜7。$0(§9: WS awareness は低頻度・サーバ改修なし)→アーキ上自明。**ジョブ自己選択/カーソルトグル(§10 b-1 記載)は本計画で ④-b-2 に再配置**(スコープ注記参照・フィールドは Task 1 で先行定義)。
- **Placeholder scan:** TBD/TODO なし。全コードブロック実体あり。
- **Type consistency:** `PresenceState`/`RosterEntry` は Task 1 定義を Task 3/5/6 で一貫使用。`wirePresence`(Task 2)→`startCollabSession`(Task 4)で同名・同引数。`setRoster`/`clear`(Task 3)を Task 4 で使用。`chip_active_count`/`roster_*` キーは Task 5〜7 で一致。
