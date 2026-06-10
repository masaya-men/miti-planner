# ④-b-2 live カーソル(P2P) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 共同編集の参加者カーソルを、タイムライン上で滑らかに動かして見せる(P2P=$0・既定 OFF オプトイン・実名なし)。

**Architecture:** signaling は既存 WS awareness に専用フィールドで相乗り(新 DO/migration/依存ゼロ)。カーソル位置は自前の最小 WebRTC データチャネル(unreliable)で P2P 配信。純粋ロジック(mesh membership・initiator 判定・補間・古パケット破棄)は WebRTC/yjs 非依存の注入式で TDD。描画は overlay に transform 直書き + rAF lerp 補間で「高頻度 setState 禁止」を遵守。

**Tech Stack:** TypeScript / React 19 / zustand / yjs awareness(既存) / ブラウザ標準 RTCPeerConnection(新依存なし) / vitest。

**設計書:** [docs/superpowers/specs/2026-06-10-realtime-collab-stage4b2-live-cursors-design.md](../specs/2026-06-10-realtime-collab-stage4b2-live-cursors-design.md)

**前提(held 継続):** push/deploy/UI 露出は ⑤-3d 統合検証 + 承認まで held。本計画は実装のみ。

---

## File Structure

- **Create** `src/lib/collab/cursorInterp.ts` — 純関数: lerp 補間・古パケット破棄(`t` 比較)・可視判定。WebRTC/yjs 非依存。
- **Create** `src/lib/collab/cursorTransport.ts` — 純関数: mesh membership 導出(roster→接続すべき clientID)・initiator 判定(glare 回避)・signal メッセージ宛先判定。WebRTC/yjs 非依存。
- **Create** `src/lib/collab/cursorMesh.ts` — RTCPeerConnection 管理(membership 差分で接続の張り直し / offer-answer / datachannel)。`PeerConnectionLike` 注入式でテスト。
- **Create** `src/lib/collab/cursorSignal.ts` — awareness `signal` フィールド送受信の薄いラッパ(`AwarenessLike` 注入)。
- **Create** `src/components/collab/CursorOverlay.tsx` — タイムライン上の他者カーソル描画(transform 直書き + rAF lerp)。
- **Create** `src/components/collab/CursorOptInModal.tsx` — ON 時の正直な説明モーダル。
- **Create** `src/components/collab/PresenceControls.tsx` — ジョブ自己選択 + カーソル ON/OFF トグル(OwnerCollabPanel に組み込む)。
- **Modify** `src/lib/collab/presence.ts` — local presence の実行時更新(`updateLocalPresence`)を追加(b-1 は初期設定のみ)。
- **Modify** `src/store/useCollabPresenceStore.ts` — local cursorEnabled / jobId / fallback 状態 + setter を追加。
- **Modify** `src/lib/collab/collabProvider.ts` — cursor transport(mesh + signal)を session に結線。
- **Modify** `src/components/Timeline.tsx` — `CursorOverlay` を MemoOverlay の隣にマウント。
- **Modify** `src/components/collab/OwnerCollabPanel.tsx` — `PresenceControls` を組み込む。
- **Modify** `src/locales/{ja,en,ko,zh}.json` — collab.cursor_* キー追加。

---

## Task 0: ブランチ作成

- [ ] **Step 1: b-1 の上に b-2 ブランチを切る**

Run:
```bash
git checkout -b feat/collab-stage4b2-live-cursors
git log --oneline -1
```
Expected: HEAD が `feat/collab-stage4b1-presence-roster` の最新コミット(b-2 設計書コミット含む)を指す。

---

## Task 1: cursorInterp.ts(純関数・補間/古パケット破棄/可視判定)

**Files:**
- Create: `src/lib/collab/cursorInterp.ts`
- Test: `src/lib/collab/__tests__/cursorInterp.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collab/__tests__/cursorInterp.test.ts
import { describe, it, expect } from 'vitest';
import { lerp, isFresher, type CursorPos } from '../cursorInterp';

describe('lerp', () => {
  it('alpha=0 は現在値、alpha=1 は目標値', () => {
    expect(lerp(0, 10, 0)).toBe(0);
    expect(lerp(0, 10, 1)).toBe(10);
  });
  it('alpha=0.5 は中点', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
  });
  it('alpha は [0,1] にクランプ', () => {
    expect(lerp(0, 10, 2)).toBe(10);
    expect(lerp(0, 10, -1)).toBe(0);
  });
});

describe('isFresher', () => {
  it('新しい t のみ true', () => {
    expect(isFresher(100, 50)).toBe(true);
    expect(isFresher(50, 100)).toBe(false);
    expect(isFresher(50, 50)).toBe(false);
  });
  it('last が null(初回)は常に true', () => {
    expect(isFresher(1, null)).toBe(true);
  });
});

describe('CursorPos 型', () => {
  it('null は非表示を表す(型の存在確認)', () => {
    const pos: CursorPos = null;
    expect(pos).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/cursorInterp.test.ts`
Expected: FAIL（`cursorInterp` が存在しない）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collab/cursorInterp.ts
// ④-b-2: カーソル補間の純関数。WebRTC/yjs 非依存。
// 受信パケットはまばら(~10–15Hz)なので、描画側で目標位置へ lerp して滑らかに見せる。

/** タイムライン上の位置。null = タイムライン外 → 非表示。 */
export type CursorPos = { timeSec: number; xRatio: number } | null;

/** 線形補間。alpha を [0,1] にクランプ。 */
export function lerp(current: number, target: number, alpha: number): number {
  const a = Math.max(0, Math.min(1, alpha));
  return current + (target - current) * a;
}

/** 受信パケットが手元の最新より新しいか(古い/同時刻パケットは破棄)。last=null は初回。 */
export function isFresher(incomingT: number, lastT: number | null): boolean {
  return lastT === null || incomingT > lastT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/cursorInterp.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/cursorInterp.ts src/lib/collab/__tests__/cursorInterp.test.ts
git commit -m "feat(collab): ④-b-2 cursorInterp 純関数(lerp/古パケット破棄)"
```

---

## Task 2: cursorTransport.ts(純関数・mesh membership/initiator/宛先判定)

**Files:**
- Create: `src/lib/collab/cursorTransport.ts`
- Test: `src/lib/collab/__tests__/cursorTransport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collab/__tests__/cursorTransport.test.ts
import { describe, it, expect } from 'vitest';
import { meshTargets, isInitiator, isForMe, type SignalMsg } from '../cursorTransport';
import type { RosterEntry } from '../presence';

const entry = (clientId: number, cursorEnabled: boolean, isLocal = false): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled, isLocal,
});

describe('meshTargets', () => {
  it('local が ON のとき、cursorEnabled な他者の clientId を返す', () => {
    const roster = [entry(7, true, true), entry(2, true), entry(9, false), entry(4, true)];
    expect(meshTargets(roster, 7, true).sort()).toEqual([2, 4]);
  });
  it('local が OFF のとき空(誰とも繋がない=IP 露出ゼロ)', () => {
    const roster = [entry(7, false, true), entry(2, true)];
    expect(meshTargets(roster, 7, false)).toEqual([]);
  });
  it('自分自身は含めない', () => {
    const roster = [entry(7, true, true)];
    expect(meshTargets(roster, 7, true)).toEqual([]);
  });
});

describe('isInitiator', () => {
  it('clientId が小さい側だけ initiator(glare 回避)', () => {
    expect(isInitiator(2, 9)).toBe(true);
    expect(isInitiator(9, 2)).toBe(false);
  });
});

describe('isForMe', () => {
  it('to が自分宛のときだけ true', () => {
    const msg: SignalMsg = { to: 5, from: 2, kind: 'offer', sdp: 'x', nonce: 1 };
    expect(isForMe(msg, 5)).toBe(true);
    expect(isForMe(msg, 9)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/cursorTransport.test.ts`
Expected: FAIL（`cursorTransport` が存在しない）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collab/cursorTransport.ts
// ④-b-2: P2P mesh の純粋ロジック(WebRTC/yjs 非依存)。誰と繋ぐか・誰が offer を作るか・宛先判定。
import type { RosterEntry } from './presence';

/** awareness の専用 `signal` フィールドに載せる番号交換メッセージ(non-trickle: SDP に ICE 同梱)。 */
export interface SignalMsg {
  to: number;        // 宛先 clientID
  from: number;      // 送信元 clientID
  kind: 'offer' | 'answer';
  sdp: string;       // ICE candidate を含む完全 SDP
  nonce: number;     // 再接続時に古い offer/answer を区別
}

/**
 * 自分が P2P を張るべき相手の clientID 集合。
 * local が OFF なら空(誰とも繋がない=IP を一切共有しない)。local が ON のとき、
 * roster で cursorEnabled な他者のみ(自分自身は除外)。
 */
export function meshTargets(
  roster: RosterEntry[],
  localClientId: number,
  localCursorEnabled: boolean,
): number[] {
  if (!localCursorEnabled) return [];
  return roster
    .filter((e) => e.clientId !== localClientId && e.cursorEnabled)
    .map((e) => e.clientId);
}

/** ペアのうち clientID が小さい側だけが offer を作る(両者同時 offer=glare を防ぐ決定的ルール)。 */
export function isInitiator(localClientId: number, remoteClientId: number): boolean {
  return localClientId < remoteClientId;
}

/** signal が自分宛か。 */
export function isForMe(msg: SignalMsg, localClientId: number): boolean {
  return msg.to === localClientId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/cursorTransport.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/cursorTransport.ts src/lib/collab/__tests__/cursorTransport.test.ts
git commit -m "feat(collab): ④-b-2 cursorTransport 純関数(mesh membership/initiator/宛先)"
```

---

## Task 3: presence.ts に実行時更新を追加(cursorEnabled/jobId トグル用)

**Files:**
- Modify: `src/lib/collab/presence.ts`(`wirePresence` の戻り値を拡張)
- Test: `src/lib/collab/__tests__/presence.test.ts`(既存に追記)

b-1 の `wirePresence` は初期 presence を 1 回載せるだけ。b-2 はトグルで `cursorEnabled`/`jobId` を実行時に変える必要があるため、更新関数を返すよう拡張する(既存呼び出しは戻り値を `() => void` として使っているので、関数 + プロパティの形にして後方互換を保つ)。

- [ ] **Step 1: Write the failing test(既存ファイルに追記)**

`src/lib/collab/__tests__/presence.test.ts` の末尾に追記:

```ts
describe('wirePresence の実行時更新', () => {
  it('update で cursorEnabled を変えると awareness に再反映され roster に出る', () => {
    const aw = new FakeAwareness();
    let last: import('../presence').RosterEntry[] = [];
    const handle = wirePresence(aw, p({ cursorEnabled: false }), (r) => { last = r; });
    expect(last[0].cursorEnabled).toBe(false);
    handle.update({ cursorEnabled: true });
    expect(last[0].cursorEnabled).toBe(true);
    handle.stop();
  });
  it('stop で購読解除(後方互換: 戻り値は stop を持つ)', () => {
    const aw = new FakeAwareness();
    const handle = wirePresence(aw, p(), () => {});
    expect(typeof handle.stop).toBe('function');
    handle.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: FAIL（`handle.update` / `handle.stop` が存在しない）

- [ ] **Step 3: Update implementation**

`src/lib/collab/presence.ts` の `wirePresence` を差し替え:

```ts
/** wirePresence の戻り値: 実行時更新(update)と購読解除(stop)。 */
export interface PresenceHandle {
  update(patch: Partial<PresenceState>): void;
  stop(): void;
}

/**
 * local presence を awareness に載せ、変化を購読して roster を通知する。
 * update でトグル(cursorEnabled/jobId)を実行時に反映、stop で購読解除。
 */
export function wirePresence(
  awareness: AwarenessLike,
  local: PresenceState,
  onRoster: (roster: RosterEntry[]) => void,
): PresenceHandle {
  let current: PresenceState = { ...local };
  const emit = () =>
    onRoster(
      buildRoster(
        awareness.getStates() as Map<number, { presence?: PresenceState }>,
        awareness.clientID,
      ),
    );
  awareness.on('change', emit);
  awareness.setLocalStateField('presence', current);
  emit();
  return {
    update(patch) {
      current = { ...current, ...patch };
      awareness.setLocalStateField('presence', current);
    },
    stop() {
      awareness.off('change', emit);
    },
  };
}
```

- [ ] **Step 4: Update the b-1 caller(collabProvider.ts)**

`src/lib/collab/collabProvider.ts` の `stopPresence` 利用箇所を `presenceHandle` に変更。
- 250-260 行付近: `const stopPresence = wirePresence(...)` → `const presenceHandle = wirePresence(...)`
- 282 行 `stopPresence();` → `presenceHandle.stop();`

(この時点では update は未使用。Task 7 で結線する。)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/collab/__tests__/presence.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/collab/presence.ts src/lib/collab/__tests__/presence.test.ts src/lib/collab/collabProvider.ts
git commit -m "feat(collab): ④-b-2 wirePresence に実行時 update を追加(b-1 後方互換)"
```

---

## Task 4: useCollabPresenceStore に local cursor 状態を追加

**Files:**
- Modify: `src/store/useCollabPresenceStore.ts`
- Test: `src/store/__tests__/useCollabPresenceStore.cursor.test.ts`(新規)

- [ ] **Step 1: Write the failing test**

```ts
// src/store/__tests__/useCollabPresenceStore.cursor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCollabPresenceStore } from '../useCollabPresenceStore';

describe('useCollabPresenceStore cursor 状態', () => {
  beforeEach(() => useCollabPresenceStore.getState().clear());

  it('初期は cursorEnabled=false(オプトイン), jobId=null, cursorFallback=false', () => {
    const s = useCollabPresenceStore.getState();
    expect(s.cursorEnabled).toBe(false);
    expect(s.jobId).toBeNull();
    expect(s.cursorFallback).toBe(false);
  });
  it('setCursorEnabled / setJobId / setCursorFallback が反映', () => {
    const s = useCollabPresenceStore.getState();
    s.setCursorEnabled(true);
    s.setJobId('war');
    s.setCursorFallback(true);
    const n = useCollabPresenceStore.getState();
    expect(n.cursorEnabled).toBe(true);
    expect(n.jobId).toBe('war');
    expect(n.cursorFallback).toBe(true);
  });
  it('clear で roster と cursor 状態が初期化(jobId は保持しない)', () => {
    const s = useCollabPresenceStore.getState();
    s.setCursorEnabled(true);
    s.setJobId('war');
    s.clear();
    const n = useCollabPresenceStore.getState();
    expect(n.roster).toEqual([]);
    expect(n.cursorEnabled).toBe(false);
    expect(n.jobId).toBeNull();
    expect(n.cursorFallback).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/store/__tests__/useCollabPresenceStore.cursor.test.ts`
Expected: FAIL（`setCursorEnabled` 等が存在しない）

- [ ] **Step 3: Update implementation**

```ts
// src/store/useCollabPresenceStore.ts
// ④-b-1: 部屋の参加者 roster を UI へ公開する store(非永続)。
// ④-b-2: 自分の cursorEnabled(既定 OFF オプトイン)/ jobId / フォールバック状態を追加。
import { create } from 'zustand';
import type { RosterEntry } from '../lib/collab/presence';

interface CollabPresenceState {
  roster: RosterEntry[];
  setRoster: (roster: RosterEntry[]) => void;
  // ④-b-2: 自分のカーソル設定(IP 露出を伴うため既定 OFF)。
  cursorEnabled: boolean;
  jobId: string | null;
  cursorFallback: boolean; // P2P が張れず自分のカーソルが相手に出ていない状態(静かに通知)
  setCursorEnabled: (v: boolean) => void;
  setJobId: (id: string | null) => void;
  setCursorFallback: (v: boolean) => void;
  clear: () => void;
}

export const useCollabPresenceStore = create<CollabPresenceState>((set) => ({
  roster: [],
  setRoster: (roster) => set({ roster }),
  cursorEnabled: false,
  jobId: null,
  cursorFallback: false,
  setCursorEnabled: (v) => set({ cursorEnabled: v }),
  setJobId: (id) => set({ jobId: id }),
  setCursorFallback: (v) => set({ cursorFallback: v }),
  clear: () => set({ roster: [], cursorEnabled: false, jobId: null, cursorFallback: false }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/store/__tests__/useCollabPresenceStore.cursor.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/useCollabPresenceStore.ts src/store/__tests__/useCollabPresenceStore.cursor.test.ts
git commit -m "feat(collab): ④-b-2 presence store に cursor 状態(既定OFF)"
```

---

## Task 5: cursorSignal.ts(awareness 相乗りの送受信ラッパ)

**Files:**
- Create: `src/lib/collab/cursorSignal.ts`
- Test: `src/lib/collab/__tests__/cursorSignal.test.ts`

awareness の専用 `signal` フィールドに `SignalMsg` を載せ、変化を購読して「自分宛のメッセージ」だけをコールバックする。confirm 後はフィールドをクリア(SDP=IP を awareness に残さない)。

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collab/__tests__/cursorSignal.test.ts
import { describe, it, expect } from 'vitest';
import { wireSignal } from '../cursorSignal';
import type { AwarenessLike } from '../presence';
import type { SignalMsg } from '../cursorTransport';

class FakeAwareness implements AwarenessLike {
  clientID = 5;
  local: Record<string, unknown> = {};
  states = new Map<number, Record<string, unknown>>();
  cbs: Array<() => void> = [];
  setLocalStateField(f: string, v: unknown) { this.local[f] = v; this.states.set(this.clientID, { ...this.local }); this.fire(); }
  getStates() { return this.states; }
  on(_e: 'change', cb: () => void) { this.cbs.push(cb); }
  off(_e: 'change', cb: () => void) { this.cbs = this.cbs.filter(c => c !== cb); }
  peer(id: number, signal: SignalMsg) { this.states.set(id, { signal }); this.fire(); }
  fire() { this.cbs.forEach(c => c()); }
}

const msg = (over: Partial<SignalMsg> = {}): SignalMsg => ({ to: 5, from: 2, kind: 'offer', sdp: 'sdp', nonce: 1, ...over });

describe('wireSignal', () => {
  it('自分宛の signal だけをコールバックする', () => {
    const aw = new FakeAwareness();
    const got: SignalMsg[] = [];
    const h = wireSignal(aw, (m) => got.push(m));
    aw.peer(2, msg({ to: 5 }));       // 自分宛
    aw.peer(9, msg({ to: 8, from: 9 })); // 他人宛
    expect(got.map(m => m.from)).toEqual([2]);
    h.stop();
  });
  it('send で awareness の signal フィールドに載る', () => {
    const aw = new FakeAwareness();
    const h = wireSignal(aw, () => {});
    h.send(msg({ to: 2, from: 5 }));
    expect((aw.local.signal as SignalMsg).to).toBe(2);
    h.stop();
  });
  it('clear で signal フィールドを空にする(SDP=IP を残さない)', () => {
    const aw = new FakeAwareness();
    const h = wireSignal(aw, () => {});
    h.send(msg());
    h.clear();
    expect(aw.local.signal).toBeNull();
    h.stop();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/cursorSignal.test.ts`
Expected: FAIL（`cursorSignal` が存在しない）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collab/cursorSignal.ts
// ④-b-2: signaling を既存 WS awareness に相乗りさせる薄いラッパ(新 DO/依存ゼロ)。
// 自分宛の SignalMsg だけを購読コールバックし、confirm 後は clear で SDP を残さない(プライバシー)。
import type { AwarenessLike } from './presence';
import { isForMe, type SignalMsg } from './cursorTransport';

export interface SignalHandle {
  send(msg: SignalMsg): void;
  clear(): void;
  stop(): void;
}

export function wireSignal(
  awareness: AwarenessLike,
  onSignal: (msg: SignalMsg) => void,
): SignalHandle {
  const seen = new Set<string>(); // from:nonce 重複発火を防ぐ(awareness は同 state を再ブロードキャストしうる)
  const handler = () => {
    const states = awareness.getStates();
    for (const [clientId, st] of states) {
      if (clientId === awareness.clientID) continue;
      const sig = (st as { signal?: SignalMsg } | undefined)?.signal;
      if (!sig || !isForMe(sig, awareness.clientID)) continue;
      const key = `${sig.from}:${sig.kind}:${sig.nonce}`;
      if (seen.has(key)) continue;
      seen.add(key);
      onSignal(sig);
    }
  };
  awareness.on('change', handler);
  return {
    send(msg) { awareness.setLocalStateField('signal', msg); },
    clear() { awareness.setLocalStateField('signal', null); },
    stop() { awareness.off('change', handler); },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/cursorSignal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/cursorSignal.ts src/lib/collab/__tests__/cursorSignal.test.ts
git commit -m "feat(collab): ④-b-2 cursorSignal(awareness 相乗り・自分宛のみ・clear)"
```

---

## Task 6: cursorMesh.ts(RTCPeerConnection 管理・注入式)

**Files:**
- Create: `src/lib/collab/cursorMesh.ts`
- Test: `src/lib/collab/__tests__/cursorMesh.test.ts`

roster 変化に応じて peer 接続を「張る/閉じる」差分管理し、offer/answer を `cursorSignal` 経由でやり取り、datachannel で `CursorPacket` を送受信する。`RTCPeerConnection` は `PeerConnectionLike` ファクトリ注入でテスト。

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/collab/__tests__/cursorMesh.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createCursorMesh, type PeerConnectionLike, type CursorPacket } from '../cursorMesh';
import type { RosterEntry } from '../presence';

const entry = (clientId: number, cursorEnabled = true, isLocal = false): RosterEntry => ({
  clientId, color: '#fff', jobId: null, isEditor: true, cursorEnabled, isLocal,
});

// 最小 fake PC: datachannel は即 open 扱い、SDP は固定文字列。
function fakePCFactory() {
  const created: FakePC[] = [];
  class FakePC implements PeerConnectionLike {
    ondata: ((p: CursorPacket) => void) | null = null;
    onclosed: (() => void) | null = null;
    sent: CursorPacket[] = [];
    closed = false;
    constructor() { created.push(this); }
    async createOfferSDP() { return 'offer-sdp'; }
    async acceptOfferCreateAnswerSDP(_sdp: string) { return 'answer-sdp'; }
    async acceptAnswer(_sdp: string) {}
    send(p: CursorPacket) { this.sent.push(p); }
    close() { this.closed = true; }
  }
  return { factory: () => new FakePC(), created };
}

describe('createCursorMesh', () => {
  it('local=7 が ON のとき、cursorEnabled な他者(2)に対し initiator(7>2 なので answerer)挙動を選ぶ', async () => {
    const { factory, created } = fakePCFactory();
    const send = vi.fn();
    const mesh = createCursorMesh({ localClientId: 7, makePeer: factory, sendSignal: send });
    await mesh.reconcile([entry(7, true, true), entry(2, true)], true);
    // 7 > 2 なので 7 は answerer = 自分から offer を送らない(2 からの offer を待つ)
    expect(send).not.toHaveBeenCalled();
    expect(created.length).toBe(1); // peer は作る(受け入れ準備)
    mesh.destroy();
  });

  it('local=2 が ON のとき、相手(9)に initiator として offer を送る', async () => {
    const { factory } = fakePCFactory();
    const send = vi.fn();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: send });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 9, from: 2, kind: 'offer' }));
    mesh.destroy();
  });

  it('local が OFF なら peer を作らない(IP 露出ゼロ)', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, false, true), entry(9, true)], false);
    expect(created.length).toBe(0);
    mesh.destroy();
  });

  it('roster から消えた peer の接続は閉じる', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    await mesh.reconcile([entry(2, true, true)], true); // 9 が退室
    expect(created[0].closed).toBe(true);
    mesh.destroy();
  });

  it('broadcast は全 open peer に CursorPacket を送る', async () => {
    const { factory, created } = fakePCFactory();
    const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn() });
    await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
    const pkt: CursorPacket = { clientId: 2, pos: { timeSec: 10, xRatio: 0.5 }, t: 1 };
    mesh.broadcast(pkt);
    expect(created[0].sent).toContainEqual(pkt);
    mesh.destroy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/cursorMesh.test.ts`
Expected: FAIL（`cursorMesh` が存在しない）

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/collab/cursorMesh.ts
// ④-b-2: P2P mesh の管理(接続の張り/閉じ・offer/answer・datachannel 送受信)。
// RTCPeerConnection は PeerConnectionLike 注入でテスト可能にする(実体は cursorPeer.ts)。
import { meshTargets, isInitiator, type SignalMsg } from './cursorTransport';
import type { RosterEntry } from './presence';

/** datachannel で流すカーソルパケット(色/ジョブは載せない=roster 側)。 */
export interface CursorPacket {
  clientId: number;
  pos: { timeSec: number; xRatio: number } | null;
  t: number;
}

/** RTCPeerConnection の最小抽象(テストで fake 可能に)。 */
export interface PeerConnectionLike {
  createOfferSDP(): Promise<string>;
  acceptOfferCreateAnswerSDP(remoteSdp: string): Promise<string>;
  acceptAnswer(remoteSdp: string): Promise<void>;
  send(packet: CursorPacket): void;
  close(): void;
  ondata: ((p: CursorPacket) => void) | null;
  onclosed: (() => void) | null;
}

export interface CursorMeshOptions {
  localClientId: number;
  makePeer: () => PeerConnectionLike;
  sendSignal: (msg: SignalMsg) => void;
  onPacket?: (p: CursorPacket) => void;
}

export interface CursorMesh {
  reconcile(roster: RosterEntry[], localEnabled: boolean): Promise<void>;
  handleSignal(msg: SignalMsg): Promise<void>;
  broadcast(p: CursorPacket): void;
  destroy(): void;
}

export function createCursorMesh(opts: CursorMeshOptions): CursorMesh {
  const peers = new Map<number, PeerConnectionLike>();
  let nonce = 1;

  const drop = (id: number) => {
    const pc = peers.get(id);
    if (pc) { pc.close(); peers.delete(id); }
  };

  const ensurePeer = (remoteId: number): PeerConnectionLike => {
    let pc = peers.get(remoteId);
    if (pc) return pc;
    pc = opts.makePeer();
    pc.ondata = (p) => opts.onPacket?.(p);
    pc.onclosed = () => peers.delete(remoteId);
    peers.set(remoteId, pc);
    return pc;
  };

  return {
    async reconcile(roster, localEnabled) {
      const targets = new Set(meshTargets(roster, opts.localClientId, localEnabled));
      // 不要になった接続を閉じる
      for (const id of [...peers.keys()]) if (!targets.has(id)) drop(id);
      // 新規 target を張る。initiator(小さい clientID)だけが offer を送る。answerer は offer を待つ。
      for (const remoteId of targets) {
        if (peers.has(remoteId)) continue;
        const pc = ensurePeer(remoteId);
        if (isInitiator(opts.localClientId, remoteId)) {
          const sdp = await pc.createOfferSDP();
          opts.sendSignal({ to: remoteId, from: opts.localClientId, kind: 'offer', sdp, nonce: nonce++ });
        }
      }
    },
    async handleSignal(msg) {
      if (msg.kind === 'offer') {
        // answerer 側: peer を用意して answer を返す。
        const pc = ensurePeer(msg.from);
        const sdp = await pc.acceptOfferCreateAnswerSDP(msg.sdp);
        opts.sendSignal({ to: msg.from, from: opts.localClientId, kind: 'answer', sdp, nonce: nonce++ });
      } else {
        // initiator 側: 自分が作った peer に answer を流し込む。
        const pc = peers.get(msg.from);
        if (pc) await pc.acceptAnswer(msg.sdp);
      }
    },
    broadcast(p) {
      for (const pc of peers.values()) pc.send(p);
    },
    destroy() {
      for (const id of [...peers.keys()]) drop(id);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/collab/__tests__/cursorMesh.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/cursorMesh.ts src/lib/collab/__tests__/cursorMesh.test.ts
git commit -m "feat(collab): ④-b-2 cursorMesh(接続差分管理/offer-answer/broadcast・注入式)"
```

---

## Task 7: cursorPeer.ts(実 RTCPeerConnection アダプタ・薄い)

**Files:**
- Create: `src/lib/collab/cursorPeer.ts`

`PeerConnectionLike` をブラウザ標準 `RTCPeerConnection` で実装する薄いアダプタ。non-trickle(ICE gathering 完了を待って完全 SDP を返す)・unreliable datachannel。ユニットテストはブラウザ API のため付けず(ロジックは Task 6 で網羅済み)、build(tsc)で型を担保する。

- [ ] **Step 1: Write implementation**

```ts
// src/lib/collab/cursorPeer.ts
// ④-b-2: PeerConnectionLike をブラウザ標準 RTCPeerConnection で実装する薄いアダプタ。
// non-trickle: ICE gathering 完了まで待ち、candidate 込みの完全 SDP を返す(signaling 回数を最小化)。
// datachannel は unreliable/unordered(カーソルは最新位置のみ意味があり取りこぼし無害)。
import type { PeerConnectionLike, CursorPacket } from './cursorMesh';

// STUN は NAT 越え用の公開サーバ(Google・無料・中継しないので IP は STUN に渡るが媒体は流れない)。
const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** ICE gathering 完了を待って完全な SDP を得る(non-trickle)。 */
function waitGatheringComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export function createRealPeer(): PeerConnectionLike {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  const self: PeerConnectionLike = {
    ondata: null,
    onclosed: null,
    async createOfferSDP() {
      const ch = pc.createDataChannel('cursor', { ordered: false, maxRetransmits: 0 });
      bindChannel(ch);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitGatheringComplete(pc);
      return pc.localDescription!.sdp;
    },
    async acceptOfferCreateAnswerSDP(remoteSdp) {
      pc.ondatachannel = (e) => bindChannel(e.channel);
      await pc.setRemoteDescription({ type: 'offer', sdp: remoteSdp });
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await waitGatheringComplete(pc);
      return pc.localDescription!.sdp;
    },
    async acceptAnswer(remoteSdp) {
      await pc.setRemoteDescription({ type: 'answer', sdp: remoteSdp });
    },
    send(packet) {
      if (channel && channel.readyState === 'open') channel.send(JSON.stringify(packet));
    },
    close() {
      try { channel?.close(); } catch { /* noop */ }
      try { pc.close(); } catch { /* noop */ }
    },
  };

  let channel: RTCDataChannel | null = null;
  function bindChannel(ch: RTCDataChannel) {
    channel = ch;
    ch.onmessage = (e) => {
      try { self.ondata?.(JSON.parse(e.data as string) as CursorPacket); } catch { /* 壊れたパケットは無視 */ }
    };
    ch.onclose = () => self.onclosed?.();
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') self.onclosed?.();
  };

  return self;
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc -b --noEmit` （または `npm run build` の tsc 部分）
Expected: 型エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/lib/collab/cursorPeer.ts
git commit -m "feat(collab): ④-b-2 cursorPeer(実 RTCPeerConnection・non-trickle/unreliable)"
```

---

## Task 8: CursorOverlay.tsx(他者カーソル描画・transform 直書き + rAF lerp)

**Files:**
- Create: `src/components/collab/CursorOverlay.tsx`
- Create: `src/components/collab/cursor.css`
- Test: `src/components/collab/__tests__/CursorOverlay.test.tsx`

他者カーソルを overlay に描く。位置は受信ループが ref に書いた目標へ rAF で lerp し、`transform: translate3d` を直接更新(React 再レンダーは peer 集合の増減時のみ)。色/ジョブは roster から引く。

- [ ] **Step 1: Write the failing test(描画=peer 集合のみ)**

```tsx
// src/components/collab/__tests__/CursorOverlay.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CursorOverlay, type RemoteCursor } from '../CursorOverlay';

const tMap = new Map<number, number>([[0, 0], [100, 1000]]);

describe('CursorOverlay', () => {
  it('cursorEnabled かつ pos 非 null の peer だけ要素を描く', () => {
    const cursors: RemoteCursor[] = [
      { clientId: 2, color: '#222', jobId: null, pos: { timeSec: 50, xRatio: 0.5 } },
      { clientId: 3, color: '#333', jobId: null, pos: null }, // タイムライン外 → 非表示
    ];
    const { container } = render(
      <CursorOverlay cursors={cursors} timeToYMap={tMap} sheetWidth={800} />,
    );
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(1);
    expect(container.querySelector('[data-cursor-id="2"]')).not.toBeNull();
  });
  it('cursors 空なら何も描かない', () => {
    const { container } = render(<CursorOverlay cursors={[]} timeToYMap={tMap} sheetWidth={800} />);
    expect(container.querySelectorAll('[data-cursor-id]').length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/collab/__tests__/CursorOverlay.test.tsx`
Expected: FAIL（`CursorOverlay` が存在しない）

- [ ] **Step 3: Write implementation**

```tsx
// src/components/collab/CursorOverlay.tsx
// ④-b-2: 他者カーソルをタイムライン上に描く。位置は rAF lerp で transform 直書き(高頻度 setState 禁止)。
// React 再レンダーは「描く peer 集合の増減」時のみ。色/ジョブは roster 由来(props)。
import React, { useEffect, useRef } from 'react';
import { timeSecToY, xRatioToPx } from '../Memo/coords';
import { lerp } from '../../lib/collab/cursorInterp';
import './cursor.css';

export interface RemoteCursor {
  clientId: number;
  color: string;
  jobId: string | null;
  pos: { timeSec: number; xRatio: number } | null;
}

interface CursorOverlayProps {
  cursors: RemoteCursor[];
  timeToYMap: Map<number, number>;
  sheetWidth: number;
}

export const CursorOverlay: React.FC<CursorOverlayProps> = ({ cursors, timeToYMap, sheetWidth }) => {
  // 目標座標を ref で保持(描画ループが毎フレーム読む。setState しない)。
  const targets = useRef<Map<number, { timeSec: number; xRatio: number }>>(new Map());
  const elRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const positions = useRef<Map<number, { x: number; y: number }>>(new Map());

  // 最新の目標 + 変換材料を ref に同期(props 変化のたび)。
  targets.current = new Map(
    cursors.filter((c) => c.pos).map((c) => [c.clientId, c.pos!]),
  );
  const mapRef = useRef(timeToYMap); mapRef.current = timeToYMap;
  const widthRef = useRef(sheetWidth); widthRef.current = sheetWidth;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      for (const [id, target] of targets.current) {
        const el = elRefs.current.get(id);
        if (!el) continue;
        const tx = xRatioToPx(target.xRatio, widthRef.current);
        const ty = timeSecToY(target.timeSec, mapRef.current);
        const cur = positions.current.get(id) ?? { x: tx, y: ty };
        const next = { x: lerp(cur.x, tx, 0.25), y: lerp(cur.y, ty, 0.25) };
        positions.current.set(id, next);
        el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const visible = cursors.filter((c) => c.pos);
  return (
    <>
      {visible.map((c) => (
        <div
          key={c.clientId}
          data-cursor-id={c.clientId}
          ref={(el) => { if (el) elRefs.current.set(c.clientId, el); else elRefs.current.delete(c.clientId); }}
          className="collab-cursor"
          style={{ color: c.color }}
        >
          <svg className="collab-cursor__arrow" width="14" height="20" viewBox="0 0 14 20" aria-hidden>
            <path d="M1 1 L1 16 L5 12 L8 18 L10 17 L7 11 L13 11 Z" fill="currentColor" stroke="#000" strokeWidth="1" />
          </svg>
          {c.jobId && <img className="collab-cursor__job" src={`/icons/jobs/${c.jobId}.png`} alt="" />}
        </div>
      ))}
    </>
  );
};
```

```css
/* src/components/collab/cursor.css */
.collab-cursor {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 40;
  will-change: transform;
}
.collab-cursor__arrow { display: block; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.5)); }
.collab-cursor__job {
  position: absolute;
  top: -4px;
  left: 12px;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  box-shadow: 0 0 0 1.5px currentColor;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/collab/__tests__/CursorOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/collab/CursorOverlay.tsx src/components/collab/cursor.css src/components/collab/__tests__/CursorOverlay.test.tsx
git commit -m "feat(collab): ④-b-2 CursorOverlay(transform直書き+rAF lerp・色/ジョブ付き矢印)"
```

> **注**: `/icons/jobs/<jobId>.png` のパスは実装時に既存ジョブアイコンの実パスを [JobPicker.tsx](../../../src/components/JobPicker.tsx) で確認して合わせる(rewrite/Storage 経由の可能性・memory `feedback_icon_firebase_upload`)。確認できないなら jobId 表示は b-2 後半に回し、まず色付き矢印のみで通す。

---

## Task 9: collabProvider に cursor transport を結線

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

session 開始時に mesh/signal を生成し、roster 変化で `reconcile`、awareness signal を `handleSignal` に流す。受信パケットは `useCollabPresenceStore` 経由でなく、CursorOverlay に渡すための軽量 store(高頻度なので別管理)へ。ここは結線のみ(ロジックはテスト済み)。

- [ ] **Step 1: 受信カーソルの軽量 store を作る**

`src/store/useRemoteCursorsStore.ts`(新規)— 高頻度更新用に roster store と分離。位置は描画層が ref で持つので、ここでは「どの peer が表示対象か(clientId→pos の最新)」だけ保持し、CursorOverlay に渡す。

```ts
// src/store/useRemoteCursorsStore.ts
// ④-b-2: 受信カーソル(高頻度)。roster(低頻度)とは別 store。
import { create } from 'zustand';
import type { CursorPacket } from '../lib/collab/cursorMesh';

interface RemoteCursorsState {
  byClient: Record<number, { pos: CursorPacket['pos']; t: number }>;
  apply: (p: CursorPacket) => void;
  remove: (clientId: number) => void;
  clear: () => void;
}

export const useRemoteCursorsStore = create<RemoteCursorsState>((set, get) => ({
  byClient: {},
  apply: (p) => {
    const prev = get().byClient[p.clientId];
    if (prev && p.t <= prev.t) return; // 古い/同時刻パケットは破棄(isFresher と同義)
    set((s) => ({ byClient: { ...s.byClient, [p.clientId]: { pos: p.pos, t: p.t } } }));
  },
  remove: (clientId) => set((s) => {
    const next = { ...s.byClient }; delete next[clientId]; return { byClient: next };
  }),
  clear: () => set({ byClient: {} }),
}));
```

- [ ] **Step 2: collabProvider.ts に結線**

`startCollabSession` 内、`stopPresence`/`presenceHandle` の直後に追加:

```ts
// ④-b-2: live カーソル(P2P)。mesh + signaling(awareness 相乗り)。
// WebRTC は遅延チャンク内なので main bundle 非混入。
import { createCursorMesh } from './cursorMesh';
import { createRealPeer } from './cursorPeer';
import { wireSignal } from './cursorSignal';
import { useRemoteCursorsStore } from '../../store/useRemoteCursorsStore';

// ... startCollabSession 内:
const awarenessLike = provider.awareness as unknown as AwarenessLike;
const signal = wireSignal(awarenessLike, (msg) => void mesh.handleSignal(msg));
const mesh = createCursorMesh({
  localClientId: provider.awareness.clientID,
  makePeer: createRealPeer,
  sendSignal: (m) => signal.send(m),
  onPacket: (p) => useRemoteCursorsStore.getState().apply(p),
});

// roster 変化のたびに mesh を reconcile(presence store の roster と自分の cursorEnabled を読む)。
// reconcile は cursorEnabled の最新値が要るので useCollabPresenceStore を参照。
const reconcile = () => {
  const st = useCollabPresenceStore.getState();
  void mesh.reconcile(st.roster, st.cursorEnabled);
};
const unsubReconcile = useCollabPresenceStore.subscribe(reconcile);
```

- [ ] **Step 3: disconnect に後始末を追加**

`disconnect` 内に追加:
```ts
unsubReconcile();
signal.stop();
signal.clear();        // awareness の signal フィールドを空に(SDP=IP を残さない)
mesh.destroy();
useRemoteCursorsStore.getState().clear();
```

- [ ] **Step 4: build + 既存 collab テスト**

Run: `npx vitest run src/lib/collab src/store && npx tsc -b --noEmit`
Expected: 既存 + 新規すべて PASS、型エラーなし

- [ ] **Step 5: Commit**

```bash
git add src/lib/collab/collabProvider.ts src/store/useRemoteCursorsStore.ts
git commit -m "feat(collab): ④-b-2 collabProvider に mesh/signal 結線(受信は別store)"
```

---

## Task 10: 自分のカーソル送信(Timeline で間引きサンプル)

**Files:**
- Modify: `src/components/Timeline.tsx`(CursorOverlay マウント + 送信ループ)

タイムライン上の `pointermove` を ref に書き、~15Hz の rAF 間引きで `(timeSec, xRatio)` に変換し、前回と変わったら `mesh.broadcast`。送信は collabProvider が公開する関数を経由(Timeline は yjs を import しないため、`useRemoteCursorsStore` と並ぶ送信用 store にブリッジする)。

- [ ] **Step 1: 送信ブリッジ store**

`src/store/useCursorSendStore.ts`(新規)— Timeline(yjs 非依存)と collabProvider(遅延チャンク)を疎結合に繋ぐ。collabProvider が `setBroadcaster` で送信関数を登録、Timeline が `broadcast` を呼ぶ。

```ts
// src/store/useCursorSendStore.ts
// ④-b-2: Timeline(yjs 非依存)→ collabProvider(遅延チャンク)へカーソル送信をブリッジ。
import { create } from 'zustand';
import type { CursorPacket } from '../lib/collab/cursorMesh';

interface CursorSendState {
  broadcaster: ((p: CursorPacket) => void) | null;
  localClientId: number | null;
  setBroadcaster: (fn: ((p: CursorPacket) => void) | null, clientId: number | null) => void;
  broadcast: (p: CursorPacket) => void;
}

export const useCursorSendStore = create<CursorSendState>((set, get) => ({
  broadcaster: null,
  localClientId: null,
  setBroadcaster: (fn, clientId) => set({ broadcaster: fn, localClientId: clientId }),
  broadcast: (p) => get().broadcaster?.(p),
}));
```

collabProvider の結線(Task 9)に追記:
```ts
import { useCursorSendStore } from '../../store/useCursorSendStore';
// reconcile 結線の後:
useCursorSendStore.getState().setBroadcaster((p) => mesh.broadcast(p), provider.awareness.clientID);
// disconnect 内:
useCursorSendStore.getState().setBroadcaster(null, null);
```

- [ ] **Step 2: Timeline に CursorOverlay マウント + 送信ループ**

[Timeline.tsx:3137](../../../src/components/Timeline.tsx) の MemoOverlay 直後に追加:
```tsx
<CursorOverlay
  cursors={remoteCursors}
  timeToYMap={timeToYMapRef.current}
  sheetWidth={sheetWidth}
/>
```

`remoteCursors` は `useRemoteCursorsStore` の `byClient` + `useCollabPresenceStore` の roster を突き合わせて `RemoteCursor[]` に変換(色/ジョブを引く・自分は除外):
```tsx
const byClient = useRemoteCursorsStore(s => s.byClient);
const roster = useCollabPresenceStore(s => s.roster);
const remoteCursors: RemoteCursor[] = React.useMemo(() =>
  roster.filter(r => !r.isLocal && r.cursorEnabled).map(r => ({
    clientId: r.clientId, color: r.color, jobId: r.jobId,
    pos: byClient[r.clientId]?.pos ?? null,
  })), [roster, byClient]);
```

送信ループ(自分が cursorEnabled のときだけ。sheet コンテナの pointermove → ref → ~15Hz 間引き → broadcast):
```tsx
const cursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);
const lastPointer = useRef<{ x: number; y: number } | null>(null);
const lastSent = useRef<{ timeSec: number; xRatio: number } | null>(null);
// sheet の pointermove ハンドラ(既存 sheet container の onPointerMove に併設):
const handleCursorPointerMove = useCallback((e: React.PointerEvent) => {
  const rect = e.currentTarget.getBoundingClientRect();
  lastPointer.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
}, []);
useEffect(() => {
  if (!cursorEnabled) return;
  const SEND_MS = 66; // ~15Hz
  let raf = 0; let lastT = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - lastT < SEND_MS) return;
    lastT = now;
    const lp = lastPointer.current;
    const { broadcast, localClientId } = useCursorSendStore.getState();
    if (localClientId == null) return;
    let pos: { timeSec: number; xRatio: number } | null = null;
    if (lp) {
      const timeSec = yToTimeSec(lp.y, timeToYMapRef.current);
      pos = timeSec === null ? null : { timeSec, xRatio: clampXRatio(pxToXRatio(lp.x, sheetWidth)) };
    }
    const prev = lastSent.current;
    const changed = !prev || !pos || prev.timeSec !== pos.timeSec || prev.xRatio !== pos.xRatio;
    if (changed) {
      lastSent.current = pos;
      broadcast({ clientId: localClientId, pos, t: now });
    }
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
}, [cursorEnabled, sheetWidth]);
```
sheet container(MemoOverlay/CursorOverlay を含む親 div)の `onPointerMove` に `handleCursorPointerMove` を併設(既存ハンドラがあれば共存)。

- [ ] **Step 3: build + 全テスト**

Run: `npm run build && npx vitest run`
Expected: build 緑、テスト緑(既知5失敗=TopBar4+HousingWorkspace1 のみ)

- [ ] **Step 4: Commit**

```bash
git add src/components/Timeline.tsx src/store/useCursorSendStore.ts src/lib/collab/collabProvider.ts
git commit -m "feat(collab): ④-b-2 自分カーソル送信(~15Hz間引き)+CursorOverlayマウント"
```

---

## Task 11: PresenceControls(ジョブ選択 + ON/OFF トグル + オプトインモーダル)

**Files:**
- Create: `src/components/collab/CursorOptInModal.tsx`
- Create: `src/components/collab/PresenceControls.tsx`
- Test: `src/components/collab/__tests__/PresenceControls.test.tsx`
- Modify: `src/components/collab/OwnerCollabPanel.tsx`(PresenceControls を組み込む)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/collab/__tests__/PresenceControls.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresenceControls } from '../PresenceControls';
import { useCollabPresenceStore } from '../../../store/useCollabPresenceStore';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

describe('PresenceControls', () => {
  beforeEach(() => useCollabPresenceStore.getState().clear());

  it('OFF→トグル ON で説明モーダルが出て、確認するまで cursorEnabled は false', () => {
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    expect(screen.getByText('collab.cursor_optin_title')).toBeInTheDocument();
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(false); // まだ
  });

  it('モーダルで確認すると cursorEnabled=true', () => {
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    fireEvent.click(screen.getByText('collab.cursor_optin_confirm'));
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(true);
  });

  it('ON→トグルで即 OFF(説明なし)', () => {
    useCollabPresenceStore.getState().setCursorEnabled(true);
    render(<PresenceControls />);
    fireEvent.click(screen.getByLabelText('cursor-toggle'));
    expect(useCollabPresenceStore.getState().cursorEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/collab/__tests__/PresenceControls.test.tsx`
Expected: FAIL（`PresenceControls` が存在しない）

- [ ] **Step 3: Write implementations**

```tsx
// src/components/collab/CursorOptInModal.tsx
// ④-b-2: カーソル ON 時の正直な説明(インフォームド・オプトイン)。
import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

interface Props { onConfirm: () => void; onCancel: () => void; }

export const CursorOptInModal: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation();
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" onClick={onCancel}>
      <div className="relative glass-tier3 rounded-2xl shadow-2xl w-[360px] max-w-[90vw] p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h3 className="text-app-xl font-bold text-app-text">{t('collab.cursor_optin_title')}</h3>
        <p className="text-app-sm leading-relaxed text-app-text-muted">{t('collab.cursor_optin_body')}</p>
        <p className="text-app-sm leading-relaxed rounded-lg p-3 border border-app-border bg-app-surface2/40 text-app-text-muted">
          {t('collab.cursor_optin_ip')}
        </p>
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_optin_reassure')}</p>
        <div className="flex gap-2 pt-2">
          <button onClick={onCancel} className="flex-1 h-9 rounded-lg border border-app-border bg-app-surface2/60 text-app-text text-app-sm active:scale-95">
            {t('collab.cursor_optin_cancel')}
          </button>
          <button onClick={onConfirm} className="flex-1 h-9 rounded-lg bg-app-text text-app-bg font-bold text-app-sm active:scale-95">
            {t('collab.cursor_optin_confirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
```

```tsx
// src/components/collab/PresenceControls.tsx
// ④-b-2: ジョブ自己選択 + カーソル ON/OFF トグル。OwnerCollabPanel/ジョイナー UI に組み込む。
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useCollabPresenceStore } from '../../store/useCollabPresenceStore';
import { CursorOptInModal } from './CursorOptInModal';

export const PresenceControls: React.FC = () => {
  const { t } = useTranslation();
  const cursorEnabled = useCollabPresenceStore(s => s.cursorEnabled);
  const cursorFallback = useCollabPresenceStore(s => s.cursorFallback);
  const setCursorEnabled = useCollabPresenceStore(s => s.setCursorEnabled);
  const [optInOpen, setOptInOpen] = React.useState(false);

  const toggle = () => {
    if (cursorEnabled) setCursorEnabled(false);   // ON→OFF は即時
    else setOptInOpen(true);                        // OFF→ON は説明を挟む
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-app-sm text-app-text flex-1">{t('collab.cursor_share_label')}</span>
        <button
          aria-label="cursor-toggle"
          onClick={toggle}
          className={`relative w-11 h-6 rounded-full transition-colors ${cursorEnabled ? 'bg-app-text' : 'bg-app-surface2 border border-app-border'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-app-bg transition-transform ${cursorEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>
      {cursorEnabled && cursorFallback && (
        <p className="text-app-xs text-app-text-muted">{t('collab.cursor_fallback')}</p>
      )}
      {optInOpen && (
        <CursorOptInModal
          onConfirm={() => { setCursorEnabled(true); setOptInOpen(false); }}
          onCancel={() => setOptInOpen(false)}
        />
      )}
    </div>
  );
};
```

> ジョブ自己選択 UI は b-2 後半 / 別 step で追加可(まず ON/OFF + フォールバックを通す)。jobId 駆動は `useCollabPresenceStore.setJobId` + Task 12 の presence 反映で繋ぐ。

- [ ] **Step 4: OwnerCollabPanel に組み込む**

`src/components/collab/OwnerCollabPanel.tsx` の roster ブロック(120-136 行)の直後に追加:
```tsx
{roster.length > 0 && (
  <div className="pt-1"><PresenceControls /></div>
)}
```
import 追加: `import { PresenceControls } from './PresenceControls';`

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/collab/__tests__/PresenceControls.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/collab/CursorOptInModal.tsx src/components/collab/PresenceControls.tsx src/components/collab/__tests__/PresenceControls.test.tsx src/components/collab/OwnerCollabPanel.tsx
git commit -m "feat(collab): ④-b-2 PresenceControls(ON/OFFトグル+オプトイン説明)"
```

---

## Task 12: トグル → presence/mesh への反映(awareness の cursorEnabled を駆動)

**Files:**
- Modify: `src/lib/collab/collabProvider.ts`

store の `cursorEnabled`/`jobId` 変化を awareness presence に反映(`presenceHandle.update`)し、reconcile を走らせる。これで「ON にした人だけが mesh に入る」が成立。

- [ ] **Step 1: collabProvider に store 購読を追加**

Task 9 の reconcile 結線を拡張: `useCollabPresenceStore.subscribe` のコールバックで presence も更新する。

```ts
// localPresence の初期 isEditor/color は据え置き。cursorEnabled/jobId は store を真実に。
let lastEnabled = false;
let lastJobId: string | null = null;
const syncLocalPresence = () => {
  const st = useCollabPresenceStore.getState();
  if (st.cursorEnabled !== lastEnabled || st.jobId !== lastJobId) {
    lastEnabled = st.cursorEnabled;
    lastJobId = st.jobId;
    presenceHandle.update({ cursorEnabled: st.cursorEnabled, jobId: st.jobId });
  }
  void mesh.reconcile(st.roster, st.cursorEnabled);
};
const unsubReconcile = useCollabPresenceStore.subscribe(syncLocalPresence);
```

(Task 9 の `reconcile`/`unsubReconcile` をこの `syncLocalPresence` に置き換える。)

- [ ] **Step 2: localPresence の初期値を OFF に**

`localPresence` の `cursorEnabled: true` → `cursorEnabled: false`(設計書 §3.2 既定 OFF)。jobId は `null` のまま。

- [ ] **Step 3: build + 全テスト**

Run: `npm run build && npx vitest run`
Expected: build 緑、テスト緑(既知5失敗のみ)

- [ ] **Step 4: Commit**

```bash
git add src/lib/collab/collabProvider.ts
git commit -m "feat(collab): ④-b-2 トグル→awareness presence/mesh 反映(既定OFF)"
```

---

## Task 13: フォールバック検知(P2P 不成立で静かに通知)

**Files:**
- Modify: `src/lib/collab/cursorMesh.ts`(接続失敗の通知)
- Modify: `src/lib/collab/collabProvider.ts`(fallback を store へ)
- Test: `src/lib/collab/__tests__/cursorMesh.test.ts`(追記)

initiator が offer を送ってから一定時間 answer/接続が来ない、または connectionState=failed の peer を「フォールバック」とみなし、`onFallback` で通知。collabProvider が `setCursorFallback(true)` する。

- [ ] **Step 1: Write the failing test(追記)**

```ts
it('peer が onclosed(失敗)を発火したら onFallback が呼ばれる', async () => {
  const { factory, created } = fakePCFactory();
  const onFallback = vi.fn();
  const mesh = createCursorMesh({ localClientId: 2, makePeer: factory, sendSignal: vi.fn(), onFallback });
  await mesh.reconcile([entry(2, true, true), entry(9, true)], true);
  created[0].onclosed?.();
  expect(onFallback).toHaveBeenCalledWith(9);
  mesh.destroy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/collab/__tests__/cursorMesh.test.ts`
Expected: FAIL（`onFallback` 未対応）

- [ ] **Step 3: cursorMesh に onFallback を追加**

`CursorMeshOptions` に `onFallback?: (remoteId: number) => void;` を追加。`ensurePeer` の `pc.onclosed` を:
```ts
pc.onclosed = () => { peers.delete(remoteId); opts.onFallback?.(remoteId); };
```

- [ ] **Step 4: collabProvider で fallback を store へ**

mesh 生成に `onFallback: () => useCollabPresenceStore.getState().setCursorFallback(true)` を追加。reconcile 成功時(targets が空 or 全接続生存)は適宜 false に戻す簡易ロジックは plan の実機チューニングで詰める(まず true 表示のみ)。

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run src/lib/collab && npx tsc -b --noEmit`
Expected: PASS、型エラーなし

- [ ] **Step 6: Commit**

```bash
git add src/lib/collab/cursorMesh.ts src/lib/collab/collabProvider.ts src/lib/collab/__tests__/cursorMesh.test.ts
git commit -m "feat(collab): ④-b-2 P2P不成立を静かにフォールバック通知"
```

---

## Task 14: i18n(ja/en/ko/zh)

**Files:**
- Modify: `src/locales/ja.json` / `en.json` / `ko.json` / `zh.json`(`collab` ブロックに追記)

- [ ] **Step 1: 4 言語にキー追加**

各ファイルの `collab` オブジェクトに以下を追加(値は言語ごと):

ja.json:
```json
"cursor_share_label": "カーソル共有",
"cursor_optin_title": "カーソル共有をオンにします",
"cursor_optin_body": "あなたのマウスの動きが、この部屋の参加者に見えるようになります。",
"cursor_optin_ip": "技術的な副作用として、部屋の参加者にあなたの IP アドレス(おおよその地域が分かる程度。名前・住所は分かりません)が見えます。部屋に入れるのは、リンクを渡した相手だけです。",
"cursor_optin_reassure": "オンにしない限り IP は出ません。いつでもオフに戻せます。",
"cursor_optin_confirm": "オンにする",
"cursor_optin_cancel": "やめる",
"cursor_fallback": "あなたのカーソルは今、相手に表示されていません(接続できませんでした)。"
```

en.json:
```json
"cursor_share_label": "Share cursor",
"cursor_optin_title": "Turn on cursor sharing",
"cursor_optin_body": "Your mouse movements will become visible to people in this room.",
"cursor_optin_ip": "As a technical side effect, people in this room can see your IP address (enough to estimate your rough region; not your name or home address). Only people you shared the link with can join.",
"cursor_optin_reassure": "Your IP is never shared unless you turn this on. You can turn it off anytime.",
"cursor_optin_confirm": "Turn on",
"cursor_optin_cancel": "Cancel",
"cursor_fallback": "Your cursor isn't visible to others right now (couldn't connect)."
```

ko.json:
```json
"cursor_share_label": "커서 공유",
"cursor_optin_title": "커서 공유를 켭니다",
"cursor_optin_body": "당신의 마우스 움직임이 이 방의 참가자에게 보이게 됩니다.",
"cursor_optin_ip": "기술적인 부작용으로, 방의 참가자에게 당신의 IP 주소(대략적인 지역을 알 수 있는 정도. 이름·주소는 알 수 없습니다)가 보입니다. 방에 들어올 수 있는 사람은 링크를 건넨 상대뿐입니다.",
"cursor_optin_reassure": "켜지 않는 한 IP는 노출되지 않습니다. 언제든지 끌 수 있습니다.",
"cursor_optin_confirm": "켜기",
"cursor_optin_cancel": "취소",
"cursor_fallback": "당신의 커서가 지금 상대에게 표시되지 않습니다 (연결하지 못했습니다)."
```

zh.json:
```json
"cursor_share_label": "光标共享",
"cursor_optin_title": "开启光标共享",
"cursor_optin_body": "你的鼠标移动将对此房间的参与者可见。",
"cursor_optin_ip": "作为技术副作用，房间内的参与者可以看到你的 IP 地址（大致能推测所在地区，但无法得知姓名和住址）。只有收到链接的人才能加入房间。",
"cursor_optin_reassure": "不开启就不会泄露 IP。随时可以关闭。",
"cursor_optin_confirm": "开启",
"cursor_optin_cancel": "取消",
"cursor_fallback": "你的光标当前未显示给对方（无法连接）。"
```

- [ ] **Step 2: build で i18n 型/欠落チェック**

Run: `npm run build`
Expected: build 緑(4 言語キー揃い・欠落なし)

- [ ] **Step 3: Commit**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(collab): ④-b-2 カーソル共有 i18n(ja/en/ko/zh)"
```

---

## Task 15: 最終確認(全テスト + build + 遅延境界)

- [ ] **Step 1: 全テスト + build**

Run: `npm run build && npx vitest run`
Expected: build 緑、root テスト緑(既知5失敗=TopBar4+HousingWorkspace1 のみ)、worker は無改修なので不変

- [ ] **Step 2: 遅延境界の確認(yjs/WebRTC が main bundle に漏れていない)**

確認: `cursorInterp.ts` / `cursorTransport.ts` / `cursorSignal.ts` / `useRemoteCursorsStore.ts` / `useCursorSendStore.ts` / `CursorOverlay.tsx` / `PresenceControls.tsx` は **yjs を静的 import しない**(`presence.ts` と同じ流儀)。WebRTC を使う `cursorPeer.ts` と `cursorMesh.ts` は collabProvider(遅延チャンク)からのみ import され、Timeline は store 経由(`useCursorSendStore`/`useRemoteCursorsStore`)で疎結合。

Run: `npx grep -rn "from 'yjs'" src/lib/collab/cursorInterp.ts src/lib/collab/cursorTransport.ts src/components/collab/CursorOverlay.tsx`
Expected: 一致なし(静的 yjs import が無い)

- [ ] **Step 3: requesting-code-review スキルでレビュー**

実装完了後、`superpowers:requesting-code-review` でレビューを受ける。

- [ ] **Step 4: TODO.md / memory 更新(held のまま)**

`docs/TODO.md` の collab セクションと memory `project_realtime_collab_status` に ④-b-2 完了を反映(push/deploy/UI 露出は held 継続)。

---

## Self-Review(計画作成者によるチェック・完了済み)

- **Spec coverage**: 設計書 §2(spike 確定)=Task 2/5/7、§3(プライバシー: 既定OFF/オプトイン/OFFで接続クローズ/IP非保存)=Task 4/9/11/12、§5(signaling/mesh)=Task 2/5/6/7、§6(座標)=Task 8/10(coords 流用)、§7(UI/描画)=Task 8/10/11/13、§9(モジュール構成)=全 Task、§10(i18n)=Task 14。✅ 全節に対応 Task あり。
- **Placeholder scan**: 各 step に実コードあり。`/icons/jobs/<id>.png` のみ実パス未確定 → Task 8 の注で「実装時に JobPicker で確認・不明なら矢印のみで通す」と明示(プレースホルダでなく分岐指示)。
- **Type consistency**: `SignalMsg`(cursorTransport)・`CursorPacket`/`PeerConnectionLike`(cursorMesh)・`RemoteCursor`(CursorOverlay)・`PresenceHandle`(presence)・store の `cursorEnabled/jobId/cursorFallback` は全 Task で一貫。`meshTargets`/`isInitiator`/`isForMe`/`lerp`/`isFresher` の署名は定義 Task と利用 Task で一致。✅
