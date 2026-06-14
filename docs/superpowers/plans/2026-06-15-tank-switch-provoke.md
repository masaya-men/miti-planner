# タンクスイッチ機能（挑発スキル）実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 挑発（Provoke）スキルをタンクに追加し、置くと同一フェーズ内・以降の攻撃の「on 対象」を MT⇄ST 反転させる（元データ非破壊・derived）。

**Architecture:** 挑発を `isTankSwap:true` の特殊軽減スキル（value:0/duration:0/recast:30）として追加。純粋関数 `getEffectiveTarget()` が「同一フェーズ内・前にある挑発数の偶奇」で実効ターゲットを算出。ダメージ計算2サイト（Timeline / CheatSheet）と表示/致死サイトすべてがこの実効ターゲットを使う。挑発0個なら元 target を返す＝既存挙動と完全一致。

**Tech Stack:** TypeScript / React / Zustand / framer-motion / Vitest。設計書: [docs/superpowers/specs/2026-06-15-tank-switch-provoke-design.md](../specs/2026-06-15-tank-switch-provoke-design.md)

---

## ファイル構成

- 新規: `src/utils/effectiveTarget.ts` — 実効ターゲット純粋関数（中核ロジック）
- 新規: `src/utils/__tests__/effectiveTarget.test.ts` — 単体テスト
- 変更: `src/types/index.ts` — `Mitigation.isTankSwap` 追加
- 変更: `src/data/mockData.ts` — 挑発スキル定義 + DISPLAY_ORDER
- 変更: `src/components/Timeline.tsx` — 計算サイト1 + PC表示/致死
- 変更: `src/components/TimelineRow.tsx` — PC表示トグル/スマホバッジ/致死 + アニメ
- 変更: `src/components/CheatSheetView.tsx` — 計算サイト2
- 変更: `src/components/MobileTimelineRow.tsx` — スマホ表示/致死
- 変更: `src/utils/autoPlanner.ts` — 挑発を自動配置候補から除外
- 運用: `scripts/seed-skills-stats.ts` 実行 / `scripts/seed-icons.ts` 実行（Provoke.png）

---

## Task 1: 型に `isTankSwap` を追加

**Files:**
- Modify: `src/types/index.ts`（`Mitigation` interface 内、`appliesAsDebuff` の近く）

- [ ] **Step 1: 型を追加**

`src/types/index.ts` の `Mitigation` interface に追加（`hidden?: boolean;` の直前あたり）:

```ts
    /** タンクスイッチ用マーカー（挑発）。軽減効果は持たず、これ以降・
     *  同一フェーズ内のイベントの on対象 MT⇄ST を反転させる。 */
    isTankSwap?: boolean;
```

- [ ] **Step 2: ビルド確認**

Run: `npx tsc --noEmit -p tsconfig.json`（または `npm run build` の型チェック部分）
Expected: エラーなし（任意フィールド追加のみ）

- [ ] **Step 3: コミット**

```bash
git add src/types/index.ts
git commit -m "feat(types): Mitigation に isTankSwap フラグを追加"
```

---

## Task 2: 実効ターゲット純粋関数（TDD・中核）

**Files:**
- Create: `src/utils/effectiveTarget.ts`
- Test: `src/utils/__tests__/effectiveTarget.test.ts`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/effectiveTarget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getEffectiveTarget, buildEffectiveTargetMap } from '../effectiveTarget';
import type { TimelineEvent, AppliedMitigation, Phase } from '../../types';

const ev = (id: string, time: number, target: TimelineEvent['target']): TimelineEvent => ({
    id, time, name: { ja: '', en: '' }, damageType: 'magical', target,
});
const swap = (id: string, time: number, ownerId = 'MT'): AppliedMitigation => ({
    id, mitigationId: 'provoke_pld', time, duration: 0, ownerId,
});
const phases: Phase[] = [
    { id: 'p1', name: { ja: '', en: '' }, startTime: 0, endTime: 100 },
    { id: 'p2', name: { ja: '', en: '' }, startTime: 100, endTime: 200 },
];

describe('getEffectiveTarget', () => {
    it('挑発0個なら元 target を返す（恒等）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [], phases)).toBe('MT');
        expect(getEffectiveTarget(ev('e', 50, 'ST'), [], phases)).toBe('ST');
    });

    it('AoE は常に不変', () => {
        expect(getEffectiveTarget(ev('e', 50, 'AoE'), [swap('s', 10)], phases)).toBe('AoE');
    });

    it('同一フェーズ内・前に挑発1個 → 反転', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10)], phases)).toBe('ST');
    });

    it('同一フェーズ内・前に挑発2個 → 元に戻る', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('a', 10), swap('b', 20)], phases)).toBe('MT');
    });

    it('挑発がイベントより後 → 影響なし', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 60)], phases)).toBe('MT');
    });

    it('同時刻の挑発は効かない（厳密 <）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 50)], phases)).toBe('MT');
    });

    it('別フェーズの挑発は影響しない', () => {
        // 挑発は p1(time10)、イベントは p2(time150)
        expect(getEffectiveTarget(ev('e', 150, 'MT'), [swap('s', 10)], phases)).toBe('MT');
    });

    it('ownerId に依らず一律カウント（ST が挑発でも反転）', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10, 'ST')], phases)).toBe('ST');
    });

    it('フェーズ未定義（phases 空）でも全体を1フェーズ扱いで動く', () => {
        expect(getEffectiveTarget(ev('e', 50, 'MT'), [swap('s', 10)], [])).toBe('ST');
    });
});

describe('buildEffectiveTargetMap', () => {
    it('eventId → 実効ターゲットの Map を返す', () => {
        const events = [ev('e1', 50, 'MT'), ev('e2', 60, 'ST')];
        const map = buildEffectiveTargetMap(events, [swap('s', 10)], phases);
        expect(map.get('e1')).toBe('ST');
        expect(map.get('e2')).toBe('MT');
    });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

Run: `npx vitest run src/utils/__tests__/effectiveTarget.test.ts`
Expected: FAIL（モジュール未作成）

- [ ] **Step 3: 実装を書く**

`src/utils/effectiveTarget.ts`:

```ts
import type { TimelineEvent, AppliedMitigation, Phase } from '../types';

type Tank = 'MT' | 'ST';

/** time が属するフェーズの id を返す（startTime <= time < endTime）。無ければ null。 */
function phaseIdOfTime(time: number, phases: Phase[]): string | null {
    for (const p of phases) {
        if (time >= p.startTime && time < p.endTime) return p.id;
    }
    return null;
}

/**
 * 挑発（isTankSwap マーカー）を考慮した「実効ターゲット」を返す純粋関数。
 * - target が MT/ST 以外（AoE/undefined）はそのまま返す。
 * - 同一フェーズ内・当該イベントより前（time 厳密に小さい）の挑発数が
 *   奇数なら MT⇄ST 反転、偶数なら元のまま。
 * - swapMarkers が空なら必ず元 target を返す = 既存挙動と完全一致。
 *
 * @param swapMarkers isTankSwap のスキルだけを事前フィルタした配置
 */
export function getEffectiveTarget(
    event: TimelineEvent,
    swapMarkers: AppliedMitigation[],
    phases: Phase[],
): TimelineEvent['target'] {
    const target = event.target;
    if (target !== 'MT' && target !== 'ST') return target;
    if (swapMarkers.length === 0) return target;

    const eventPhase = phaseIdOfTime(event.time, phases);
    let count = 0;
    for (const m of swapMarkers) {
        if (m.time >= event.time) continue; // 厳密に前のみ
        if (phaseIdOfTime(m.time, phases) !== eventPhase) continue; // 同一フェーズのみ
        count++;
    }
    if (count % 2 === 0) return target;
    return target === 'MT' ? 'ST' : ('MT' as Tank);
}

/** events 全件の eventId → 実効ターゲット の Map を作る（呼び出し側でメモ化前提）。 */
export function buildEffectiveTargetMap(
    events: TimelineEvent[],
    swapMarkers: AppliedMitigation[],
    phases: Phase[],
): Map<string, TimelineEvent['target']> {
    const map = new Map<string, TimelineEvent['target']>();
    for (const e of events) {
        map.set(e.id, getEffectiveTarget(e, swapMarkers, phases));
    }
    return map;
}
```

- [ ] **Step 4: テストを実行して成功を確認**

Run: `npx vitest run src/utils/__tests__/effectiveTarget.test.ts`
Expected: PASS（全 10 ケース）

- [ ] **Step 5: コミット**

```bash
git add src/utils/effectiveTarget.ts src/utils/__tests__/effectiveTarget.test.ts
git commit -m "feat(timeline): 実効ターゲット純粋関数 getEffectiveTarget を追加(TDD)"
```

---

## Task 3: 挑発スキルをデータに追加

**Files:**
- Modify: `src/data/mockData.ts`（ロールアクション節 + `MITIGATION_DISPLAY_ORDER`）

- [ ] **Step 1: DISPLAY_ORDER に provoke を追加**

`src/data/mockData.ts` の `MITIGATION_DISPLAY_ORDER` 配列、`'reprisal_base',` の直前に追加:

```ts
    'provoke',
```

- [ ] **Step 2: 挑発スキル定義を追加**

`src/data/mockData.ts` のロールアクション節、Reprisal の `.map(...)` 群の直後（[mockData.ts:755](../../../src/data/mockData.ts#L755) 付近）に追加:

```ts
    // Provoke (Tanks) — タンクスイッチ用マーカー（軽減効果なし・対象を MT⇄ST 反転）
    ...['pld', 'war', 'drk', 'gnb'].map(job => ({
        id: `provoke_${job}`, jobId: job,
        name: { ja: "挑発", en: "Provoke", zh: "挑衅", ko: "도발" },
        icon: "/icons/Provoke.png",
        recast: 30, duration: 0, type: "all" as const, value: 0,
        isShield: false, scope: "self" as const, minLevel: 15,
        isTankSwap: true, family: "role_action"
    })),
```

- [ ] **Step 3: 多言語名の最終確認**

中/韓の公式表記を確認（memory `reference_ff14_jobguide_urls`）。挑衅 / 도발 が公式と一致するか確認し、違えば修正。

- [ ] **Step 4: ビルド確認**

Run: `npm run build`
Expected: 型エラーなし（`isTankSwap` は Task 1 で追加済み）

- [ ] **Step 5: コミット**

```bash
git add src/data/mockData.ts
git commit -m "feat(data): 挑発(provoke)スキルを全タンク分追加(recast30/value0/isTankSwap)"
```

---

## Task 4: Timeline.tsx のダメージ計算に実効ターゲットを適用（計算サイト1）

**Files:**
- Modify: `src/components/Timeline.tsx`（damageMap を作る useMemo 内、[Timeline.tsx:1835-1843](../../../src/components/Timeline.tsx#L1835)）

- [ ] **Step 1: import を追加**

`src/components/Timeline.tsx` の import 群に追加:

```ts
import { buildEffectiveTargetMap } from '../utils/effectiveTarget';
```

- [ ] **Step 2: damageMap useMemo の冒頭で実効ターゲット Map を作る**

`sortedEvents.forEach(event => {` の**直前**に追加（`MITIGATIONS` は同コンポーネントで取得済みの定義配列。`timelineMitigations`・`phases` も同スコープにある）:

```ts
        const swapMarkers = timelineMitigations.filter(m => {
            const d = MITIGATIONS.find(def => def.id === m.mitigationId);
            return d?.isTankSwap === true;
        });
        const effTargetMap = buildEffectiveTargetMap(sortedEvents, swapMarkers, phases);
```

- [ ] **Step 3: target 取得行を実効ターゲットに差し替え**

[Timeline.tsx:1841](../../../src/components/Timeline.tsx#L1841) を変更:

```ts
            // 変更前: const target = event.target;
            const target = effTargetMap.get(event.id) ?? event.target;
```

> `displayContext` / `affectedContexts`（1842-1843行）は `target` から導出されるため、これだけで計算全体が実効ターゲットに従う。

- [ ] **Step 4: useMemo の依存配列に phases が含まれるか確認**

damageMap useMemo の deps に `timelineMitigations` と `phases` が入っていること（無ければ追加）。`sortedEvents` 経由で events は反映される。

- [ ] **Step 5: ビルド + 既存テスト確認**

Run: `npm run build` → `npx vitest run`
Expected: ビルド成功 / 既存テスト緑（既知5失敗のみ）

- [ ] **Step 6: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(timeline): PCダメージ計算に実効ターゲット(挑発スイッチ)を適用"
```

---

## Task 5: CheatSheetView.tsx のダメージ計算に適用（計算サイト2）

**Files:**
- Modify: `src/components/CheatSheetView.tsx`（damageMap useMemo、[CheatSheetView.tsx:39-64](../../../src/components/CheatSheetView.tsx#L39)）

- [ ] **Step 1: import を追加**

```ts
import { buildEffectiveTargetMap } from '../utils/effectiveTarget';
```

- [ ] **Step 2: damageMap useMemo 内で実効ターゲット Map を作る**

`sortedEvents.forEach(event => {`（[CheatSheetView.tsx:56](../../../src/components/CheatSheetView.tsx#L56)）の直前に追加（`MITIGATIONS` は `useMitigations()` 取得済み、`timelineMitigations`・`phases` 同スコープ。スコープ名が異なる場合は同コンポーネントの該当変数に合わせる）:

```ts
        const swapMarkers = timelineMitigations.filter(m => {
            const d = MITIGATIONS.find(def => def.id === m.mitigationId);
            return d?.isTankSwap === true;
        });
        const effTargetMap = buildEffectiveTargetMap(sortedEvents, swapMarkers, phases);
```

- [ ] **Step 3: target 取得を差し替え**

[CheatSheetView.tsx:62](../../../src/components/CheatSheetView.tsx#L62) 付近の `const target = event.target;`（damageMap 内）を:

```ts
            const target = effTargetMap.get(event.id) ?? event.target;
```

- [ ] **Step 4: useMemo deps 確認**

`timelineMitigations` / `phases` が deps にあること。

- [ ] **Step 5: ビルド + テスト**

Run: `npm run build` → `npx vitest run`
Expected: 成功 / 既存緑

- [ ] **Step 6: コミット**

```bash
git add src/components/CheatSheetView.tsx
git commit -m "feat(cheatsheet): チートシートのダメージ計算に実効ターゲットを適用"
```

---

## Task 6: PC表示・致死判定に実効ターゲットを適用（TimelineRow）

**Files:**
- Modify: `src/components/TimelineRow.tsx`（`PcTargetToggle` / `MobileTargetBadge` / 致死判定 576・615 行）

> 方針: 各コンポーネントに実効ターゲット `effTarget` を渡し、**表示は effTarget**、**クリックトグルは従来どおり元 `event.target` を編集**（base+overlay）。`effTarget` は親（行コンポーネント）が store から算出して props で渡す。

- [ ] **Step 1: 行コンポーネントで実効ターゲットを算出**

`TimelineRow` 本体（events を描画する箇所）で、store から `timelineMitigations` と `phases` を取得し、表示用の実効ターゲットを計算するヘルパーを用意:

```ts
import { getEffectiveTarget } from '../utils/effectiveTarget';
// ...行レンダリング内、event ごとに:
const swapMarkers = timelineMitigations.filter(m => {
    const d = MITIGATIONS.find(def => def.id === m.mitigationId);
    return d?.isTankSwap === true;
});
const effTarget = getEffectiveTarget(event, swapMarkers, phases);
```

> 既に `MITIGATIONS`（[TimelineRow.tsx:102](../../../src/components/TimelineRow.tsx#L102)）は取得済み。`timelineMitigations`・`phases` は `useMitigationStore` から取得（同ファイル内の既存取得パターンに合わせる）。多数の行で再計算しないよう、可能なら親で `swapMarkers` を1回作って渡す。

- [ ] **Step 2: `PcTargetToggle` を effTarget 表示・元target編集に変更**

`PcTargetToggle` に `effTarget` prop を追加し、表示判定とアイコン選択を effTarget に変更。クリックは従来どおり `event.target` を反転:

```tsx
const PcTargetToggle: React.FC<{ event: TimelineEvent; partyMembers: PartyMember[]; effTarget: TimelineEvent['target']; badgeTextClass?: string }>
  = ({ event, partyMembers, effTarget, badgeTextClass = 'text-app-base' }) => {
    const JOBS = useJobs();
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    if (effTarget !== 'MT' && effTarget !== 'ST') return null;
    const member = partyMembers.find(m => m.id === effTarget);
    const job = member ? JOBS.find(j => j.id === member.jobId) : null;
    return (
        <Tooltip content={t('timeline.toggle_target_hint')}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    // base(元target)を反転。表示=effTarget も連動して反転する（base+overlay）
                    updateEvent(event.id, { target: event.target === 'MT' ? 'ST' : 'MT' });
                }}
                className="flex items-center gap-1.5 cursor-pointer rounded px-1 -mx-1 hover:bg-app-surface2 active:scale-95 transition-all"
            >
                <span className="text-app-base text-app-text-muted font-mono">on</span>
                {job ? (
                    <img src={job.icon} className="w-6 h-6 rounded-sm" alt={effTarget} />
                ) : (
                    <span className={clsx("font-bold px-1 rounded", badgeTextClass,
                        effTarget === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10")}>
                        {effTarget}
                    </span>
                )}
            </button>
        </Tooltip>
    );
};
```

> 呼び出し箇所（同ファイル内 `<PcTargetToggle event={...} partyMembers={...} />`）に `effTarget={effTarget}` を追加。

- [ ] **Step 3: `MobileTargetBadge` も effTarget 表示に変更**

`MobileTargetBadge`（[TimelineRow.tsx:76](../../../src/components/TimelineRow.tsx#L76)）に `effTarget` prop を追加し、`event.target` 参照を `effTarget` に置換（`AoE` 早期 return・member 検索・バッジ色すべて）。呼び出し箇所に `effTarget` を渡す。

- [ ] **Step 4: 致死判定を effTarget に変更**

[TimelineRow.tsx:576-577](../../../src/components/TimelineRow.tsx#L576) と [TimelineRow.tsx:615-617](../../../src/components/TimelineRow.tsx#L615) の `evt.target === 'MT' || evt.target === 'ST'` と `m.id === evt.target` を、その行の実効ターゲット（`getEffectiveTarget(evt, swapMarkers, phases)`）に置換:

```ts
const evtEff = getEffectiveTarget(evt, swapMarkers, phases);
let maxHp = partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
if (evtEff === 'MT' || evtEff === 'ST') {
    maxHp = partyMembers.find(m => m.id === evtEff)?.stats.hp || 1;
}
```

- [ ] **Step 5: ビルド + テスト**

Run: `npm run build` → `npx vitest run`
Expected: 成功 / 既存緑

- [ ] **Step 6: コミット**

```bash
git add src/components/TimelineRow.tsx
git commit -m "feat(timeline): PC対象表示/致死判定を実効ターゲットに(クリックは元target編集維持)"
```

---

## Task 7: スマホ表示・致死判定に適用（MobileTimelineRow）

**Files:**
- Modify: `src/components/MobileTimelineRow.tsx`（`TargetBadge` 54-72 / 致死 149-153）

- [ ] **Step 1: 実効ターゲット算出を追加**

`MobileTimelineRow` 内で `getEffectiveTarget` を import し、event ごとに `effTarget` を算出（store から `timelineMitigations`・`phases`、`MITIGATIONS` は [MobileTimelineRow.tsx:83](../../../src/components/MobileTimelineRow.tsx#L83) で取得済み）:

```ts
import { getEffectiveTarget } from '../utils/effectiveTarget';
const swapMarkers = timelineMitigations.filter(m => {
    const d = MITIGATIONS.find(def => def.id === m.mitigationId);
    return d?.isTankSwap === true;
});
const effTarget = getEffectiveTarget(event, swapMarkers, phases);
```

- [ ] **Step 2: `TargetBadge` を effTarget に変更**

`TargetBadge`（[MobileTimelineRow.tsx:54](../../../src/components/MobileTimelineRow.tsx#L54)）に `effTarget` prop を追加し、`event.target` 参照（56・57・62・69・71行）を `effTarget` に置換。

- [ ] **Step 3: 致死判定を effTarget に変更**

[MobileTimelineRow.tsx:151-152](../../../src/components/MobileTimelineRow.tsx#L151) の `event.target` を `effTarget` に置換。

- [ ] **Step 4: ビルド + テスト**

Run: `npm run build` → `npx vitest run`
Expected: 成功 / 既存緑

- [ ] **Step 5: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat(timeline): スマホ対象バッジ/致死判定を実効ターゲットに"
```

---

## Task 8: 対象アイコン切替アニメーション

**Files:**
- Modify: `src/components/TimelineRow.tsx`（`PcTargetToggle` の対象アイコン）

> 挑発で対象が切り替わる/戻る瞬間に framer-motion で軽くアニメ。`prefers-reduced-motion` 尊重。マウス追従ではない離散変化なので規約 OK。

- [ ] **Step 1: framer-motion import**

`src/components/TimelineRow.tsx`:

```ts
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
```

- [ ] **Step 2: 対象アイコンを AnimatePresence でラップ**

`PcTargetToggle` のアイコン/バッジ部分を、`effTarget` を key にした motion 要素に変更:

```tsx
const reduce = useReducedMotion();
// ...
<AnimatePresence mode="wait" initial={false}>
    <motion.span
        key={String(effTarget)}
        initial={reduce ? false : { opacity: 0, scale: 0.6, rotateY: -90 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotateY: 90 }}
        transition={{ duration: 0.18 }}
        className="inline-flex"
    >
        {job ? (
            <img src={job.icon} className="w-6 h-6 rounded-sm" alt={effTarget} />
        ) : (
            <span className={clsx("font-bold px-1 rounded", badgeTextClass,
                effTarget === 'MT' ? "text-cyan-400 bg-cyan-400/10" : "text-amber-400 bg-amber-400/10")}>
                {effTarget}
            </span>
        )}
    </motion.span>
</AnimatePresence>
```

> `key={String(effTarget)}` により MT⇄ST が変わると exit→enter が走る。挑発を外して戻る時も同様に発火。

- [ ] **Step 3: 手動確認（実機）**

開発サーバで、タンクバスター行の手前に挑発を置く → 対象アイコンが ST にアニメ付きで切替。挑発を消す → MT に戻るアニメ。`prefers-reduced-motion: reduce` で即切替になること。

- [ ] **Step 4: ビルド + テスト**

Run: `npm run build` → `npx vitest run`
Expected: 成功 / 既存緑

- [ ] **Step 5: コミット**

```bash
git add src/components/TimelineRow.tsx
git commit -m "feat(timeline): 対象アイコン切替に framer-motion アニメ(reduced-motion尊重)"
```

---

## Task 9: オートプランナーから挑発を除外

**Files:**
- Modify: `src/utils/autoPlanner.ts`（候補スキルフィルタ [autoPlanner.ts:70-77](../../../src/utils/autoPlanner.ts#L70)）

- [ ] **Step 1: フィルタに isTankSwap 除外を追加**

[autoPlanner.ts:70](../../../src/utils/autoPlanner.ts#L70) の `.filter(m => {` ブロック先頭に追加:

```ts
            .filter(m => {
                if (m.isTankSwap) return false; // 挑発は手動専用・自動配置しない
                if (m.minLevel !== undefined && level < m.minLevel) return false;
                if (m.maxLevel !== undefined && level > m.maxLevel) return false;
                return m.jobId === member.jobId || m.jobId === member.role || m.jobId === 'role_action';
            })
```

- [ ] **Step 2: テスト確認（オートプラン）**

Run: `npx vitest run src/utils/__tests__` （autoPlanner 関連テストが緑であること）
Expected: 緑。挑発が自動配置されないこと。

- [ ] **Step 3: コミット**

```bash
git add src/utils/autoPlanner.ts
git commit -m "feat(autoplan): 挑発(isTankSwap)を自動配置候補から除外"
```

---

## Task 10: Firestore 同期 + アイコンアップロード（ずれ防止・運用）

**Filesः**
- 実行: `scripts/seed-skills-stats.ts` / `scripts/seed-icons.ts`
- 配置: `Provoke.png` を icons ソースディレクトリへ

- [ ] **Step 1: Provoke.png を配置**

ユーザー提供の `Provoke.png` を、他アイコンと同じソースディレクトリに配置（`seed-icons.ts` が読む場所。`/icons/*.png` の実体）。`seed-icons.ts` 冒頭でソースパスを確認すること。

- [ ] **Step 2: dry-run で Firestore 差分確認**

Run: `npx tsx scripts/seed-skills-stats.ts --dry-run`
Expected: `provoke_pld/war/drk/gnb` の 4 件が「追加」予定として表示・既存は変更なし

- [ ] **Step 3: Firestore に追加（ADDITIVE）**

Run: `npx tsx scripts/seed-skills-stats.ts`
Expected: 4 件追加・既存上書きなし

- [ ] **Step 4: アイコンを Firebase Storage にアップロード**

Run: `npx tsx scripts/seed-icons.ts`（Provoke.png を含む）
Expected: アップロード成功（本番 `/icons/Provoke.png` が解決）

- [ ] **Step 5: コミット（Provoke.png）**

```bash
git add <Provoke.png のパス>
git commit -m "feat(assets): 挑発アイコン Provoke.png を追加"
```

---

## Task 11: 統合検証（ビルド・テスト・実機）

- [ ] **Step 1: フルビルド + 全テスト**

Run: `npm run build` → `npx vitest run`
Expected: build EXIT=0 / テスト緑（既知5失敗のみ）

- [ ] **Step 2: 実機シナリオ検証**

開発サーバ（push が要る API 変更は無いので localhost で可）で:
1. タンクメンバー（PLD等）の軽減セレクターに「挑発」が出る（ヒーラー/DPSには出ない）。
2. 連続タンクバスター（両方 on MT）の間に挑発を置く → 1発目=MT軽減、2発目=ST軽減で計算され、2発目の表示が「on ST」に切替（アニメ付き）。
3. 挑発を消す → 2発目が「on MT」に戻る（計算も戻る）。
4. フェーズをまたいだ次フェーズの攻撃は影響を受けない。
5. リキャスト行に挑発の30秒クールダウンが出る。
6. collab: 2ブラウザで挑発の配置が同期する（duration:0 が round-trip で壊れない）。
7. スマホ表示でも対象バッジ・致死判定が実効ターゲットで正しい。

- [ ] **Step 3: 既存機能の非破壊確認**

挑発を1個も置いていない既存プランで、ダメージ計算・対象表示・致死判定・手動クリックトグルが従来どおりであること。

- [ ] **Step 4: ジョブ変更マイグレ確認（設計書 §13）**

挑発を置いたタンクのジョブを変更（例 PLD→WAR）したとき、`provoke_pld → provoke_war` が family='role_action' 経由で正しく写るか確認。問題があれば別途修正（reprisal/rampart と同 family のため要確認）。

- [ ] **Step 5: 記録**

`docs/TODO.md` に本機能の完了/状態を1行追記。push 前に build+vitest 必須（memory `feedback_vercel_tsc_strict`）。

---

## 自己レビュー結果

- **Spec カバレッジ**: §3方針(動的/反転/タンク専用/案1+アニメ/recast/特殊軽減) → Task1-9 で網羅。§5実効ターゲット → Task2。§6全計算/表示サイト → Task4-7（PiPは対象外と確認済）。§7アニメ → Task8。§9 autoPlan/collab → Task9/Task11。§10ずれ防止 → Task10。§11テスト → Task2/Task11。§13未確定 → Task11 Step4。
- **プレースホルダ**: なし（全コード実体を記載）。
- **型整合**: `getEffectiveTarget(event, swapMarkers, phases)` / `buildEffectiveTargetMap(events, swapMarkers, phases)` / prop名 `effTarget` を全タスクで統一。`isTankSwap` を Task1 で定義し Task3/6/7/9 で使用。
