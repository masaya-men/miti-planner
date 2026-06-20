# リビングデッド (Living Dead / DRK) 正確モデル化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リビングデッドを「窓内で最初に致死になる被弾を起点にウォーキングデッド10秒だけ生存」という二段階モデルに置き換え、タイムラインに白黒リビデアイコンでウォーキングデッドを可視化する。

**Architecture:** 致死判定の素材 (`軽減後ダメ ≥ 対象maxHp`) は既存。引き金検出のコア判定を純粋関数 `src/utils/livingDead.ts` に切り出して単体テストし、表 (CheatSheetView) とタイムライン (Timeline) の 2 本の `damageMap` から共通利用する。表示は既存の `DamageInfo.isInvincible` フラグ (条件付きで立てる) と、アーサリースター→巨星と同じ仮想アイテム方式 (白黒は CSS filter) で行う。

**Tech Stack:** React + TypeScript (Vite), Zustand, vitest。スキル正本は Firestore (デプロイ時に同期)。

## Global Constraints

- ラベル文言は変更しない。ダメージ列は既存の `timeline.invuln`「無敵 / Invuln」据え置き。i18n キー追加なし。
- 他の無敵 3 種 (`hallowed_ground` / `holmgang` / `superbolide`) の挙動は一切変えない。
- 二段階の判定は **データ駆動** (`isInvincible: true` かつ `walkingDeadDuration` が設定されているスキルのみ)。`living_dead` という id をロジックに決め打ちしない。
- リビデは既存の self スコープ無敵と同じく **タンク対象 (MT/ST) イベントのみ** に適用する (AoE 行には適用しない = 既存挙動踏襲)。
- 回復要否 (最大HP相当の回復が間に合うか) はモデル化しない。HP の経時追跡は導入しない。
- push 前に `npm run build` (tsc 厳密) + `npx vitest run` を必ず通す。
- 共有計算 (damageMap) の改修はテスト緑でも実機が壊れうる。最終タスクで実機総点検 (多エージェント) を行う。
- 仕様の正本は `docs/superpowers/specs/2026-06-20-living-dead-modeling-design.md`。

---

### Task 1: データフィールド `walkingDeadDuration` の追加

**Files:**
- Modify: `src/types/index.ts` (Mitigation interface, `isInvincible?` の直後)
- Modify: `src/data/mockData.ts` (`living_dead` 定義, 現在 316 行付近)

**Interfaces:**
- Produces: `Mitigation.walkingDeadDuration?: number` (秒。設定されている無敵スキルを「二段階無敵」とみなすマーカー兼ウォーキングデッド効果時間)。

- [ ] **Step 1: 型にフィールド追加**

`src/types/index.ts` の `isInvincible?: boolean; // Damages becomes 0` の直後に追加:

```typescript
    isInvincible?: boolean; // Damages becomes 0
    /** ウォーキングデッド型(二段階無敵)の効果時間(秒)。
     *  設定されている無敵スキルは「窓内で最初に致死になる被弾を起点に、
     *  そこから walkingDeadDuration 秒だけ生存」という二段階モデルで扱う(例: リビングデッド=10)。
     *  未設定の無敵は従来どおり効果時間中ずっと無条件無敵。 */
    walkingDeadDuration?: number;
```

- [ ] **Step 2: mockData の living_dead に値を追加**

`src/data/mockData.ts` の `living_dead` 行を次に変更 (末尾に `walkingDeadDuration: 10` を追加):

```typescript
    {
        id: "living_dead", jobId: "drk", name: { ja: "リビングデッド", en: "Living Dead", zh: "行尸走肉", ko: "산송장" }, icon: "/icons/Living_Dead.png",
        recast: 300, duration: 10, type: "all", value: 0, isShield: false, scope: "self", isInvincible: true, walkingDeadDuration: 10, minLevel: 50, family: "tank_invuln"
    },
```

- [ ] **Step 3: 型チェック**

Run: `npx tsc -p tsconfig.app.json --noEmit`
Expected: エラーなし (optional フィールド追加のみ)。

- [ ] **Step 4: Commit**

```bash
rtk git add src/types/index.ts src/data/mockData.ts
rtk git commit -m "feat(types): Mitigation に walkingDeadDuration 追加 + living_dead=10"
```

---

### Task 2: 引き金検出ユーティリティ `livingDead.ts` (TDD コア)

**Files:**
- Create: `src/utils/livingDead.ts`
- Test: `src/utils/__tests__/livingDead.test.ts`

**Interfaces:**
- Consumes: `Mitigation`, `PartyMember`, `TimelineEvent['target']` from `../types`。
- Produces:
  - `isLivingDeadStyle(def: Mitigation): boolean`
  - `maxHpForEffectiveTarget(effTarget: TimelineEvent['target'], partyMembers: PartyMember[]): number`
  - `interface LivingDeadInstance { id: string; time: number; duration: number; walkingDeadDuration: number; ownerId: string; targetId?: string }`
  - `resolveLivingDeadSurvival(eventTime: number, mitigatedWithoutLivingDead: number, maxHp: number, livingDeads: LivingDeadInstance[], triggers: Map<string, number>): boolean`

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/livingDead.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    isLivingDeadStyle,
    maxHpForEffectiveTarget,
    resolveLivingDeadSurvival,
    type LivingDeadInstance,
} from '../livingDead';
import type { Mitigation, PartyMember } from '../../types';

const baseDef = (over: Partial<Mitigation>): Mitigation => ({
    id: 'x', jobId: 'drk', name: { ja: 'x', en: 'x' }, icon: '', recast: 0, duration: 10, type: 'all', value: 0, ...over,
});

const member = (id: string, hp: number): PartyMember => ({
    id, jobId: 'drk', role: 'tank', stats: { hp, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 }, computedValues: {},
});

describe('isLivingDeadStyle', () => {
    it('isInvincible + walkingDeadDuration>0 のみ true', () => {
        expect(isLivingDeadStyle(baseDef({ isInvincible: true, walkingDeadDuration: 10 }))).toBe(true);
        expect(isLivingDeadStyle(baseDef({ isInvincible: true }))).toBe(false); // 通常無敵
        expect(isLivingDeadStyle(baseDef({ walkingDeadDuration: 10 }))).toBe(false); // 無敵でない
        expect(isLivingDeadStyle(baseDef({ isInvincible: true, walkingDeadDuration: 0 }))).toBe(false);
    });
});

describe('maxHpForEffectiveTarget', () => {
    const pm = [member('MT', 90000), member('ST', 88000), member('H1', 60000)];
    it('MT/ST は当該HP、それ以外は H1 のHP', () => {
        expect(maxHpForEffectiveTarget('MT', pm)).toBe(90000);
        expect(maxHpForEffectiveTarget('ST', pm)).toBe(88000);
        expect(maxHpForEffectiveTarget('AoE', pm)).toBe(60000);
    });
    it('見つからなければ 1 にフォールバック', () => {
        expect(maxHpForEffectiveTarget('MT', [])).toBe(1);
    });
});

describe('resolveLivingDeadSurvival', () => {
    const ld = (over: Partial<LivingDeadInstance> = {}): LivingDeadInstance =>
        ({ id: 'ld1', time: 10, duration: 10, walkingDeadDuration: 10, ownerId: 'MT', ...over });

    it('窓内で最初の致死被弾が引き金になり生存(triggers に記録)', () => {
        const triggers = new Map<string, number>();
        // 致死 (mitigated 100000 >= maxHp 90000), 窓 [10,20) 内の t=12
        const survived = resolveLivingDeadSurvival(12, 100000, 90000, [ld()], triggers);
        expect(survived).toBe(true);
        expect(triggers.get('ld1')).toBe(12);
    });

    it('窓内でも非致死は生存しない(引き金にならない)', () => {
        const triggers = new Map<string, number>();
        const survived = resolveLivingDeadSurvival(12, 50000, 90000, [ld()], triggers);
        expect(survived).toBe(false);
        expect(triggers.has('ld1')).toBe(false);
    });

    it('引き金後のウォーキングデッド窓[tT,tT+wd)のイベントは致死でも非致死でも生存', () => {
        const triggers = new Map<string, number>([['ld1', 12]]);
        // WD 窓 [12,22) 内の t=18、非致死でも生存
        expect(resolveLivingDeadSurvival(18, 50000, 90000, [ld()], triggers)).toBe(true);
        // WD 窓 [12,22) 内の t=21、致死でも生存
        expect(resolveLivingDeadSurvival(21, 200000, 90000, [ld()], triggers)).toBe(true);
    });

    it('ウォーキングデッド窓はリビデ窓を超えて伸びる(引き金が窓終盤)', () => {
        const triggers = new Map<string, number>();
        // 引き金 t=19 (窓[10,20)内), WD 窓 [19,29)
        expect(resolveLivingDeadSurvival(19, 100000, 90000, [ld()], triggers)).toBe(true);
        // t=28 はリビデ窓外(>=20)だが WD 窓内 → 生存
        expect(resolveLivingDeadSurvival(28, 100000, 90000, [ld()], triggers)).toBe(true);
        // t=29 は WD 窓外 → 生存しない
        expect(resolveLivingDeadSurvival(29, 100000, 90000, [ld()], triggers)).toBe(false);
    });

    it('引き金前(窓内だが致死前)の非致死は通常ダメージ(false)', () => {
        const triggers = new Map<string, number>();
        // t=11 非致死 → false かつ未記録
        expect(resolveLivingDeadSurvival(11, 50000, 90000, [ld()], triggers)).toBe(false);
        // t=13 致死 → 引き金
        expect(resolveLivingDeadSurvival(13, 100000, 90000, [ld()], triggers)).toBe(true);
        expect(triggers.get('ld1')).toBe(13);
    });

    it('窓内に致死が一度も無ければ生存ゼロ', () => {
        const triggers = new Map<string, number>();
        expect(resolveLivingDeadSurvival(11, 10000, 90000, [ld()], triggers)).toBe(false);
        expect(resolveLivingDeadSurvival(15, 20000, 90000, [ld()], triggers)).toBe(false);
        expect(triggers.size).toBe(0);
    });

    it('リビデ窓外のイベントは(未発動なら)生存しない', () => {
        const triggers = new Map<string, number>();
        // t=25 はリビデ窓[10,20)外、未発動 → 致死でも生存しない
        expect(resolveLivingDeadSurvival(25, 200000, 90000, [ld()], triggers)).toBe(false);
    });

    it('複数リビデは各自独立に引き金を持つ', () => {
        const triggers = new Map<string, number>();
        const ldA = ld({ id: 'A', time: 10 });
        const ldB = ld({ id: 'B', time: 30 });
        expect(resolveLivingDeadSurvival(12, 100000, 90000, [ldA, ldB], triggers)).toBe(true);
        expect(resolveLivingDeadSurvival(32, 100000, 90000, [ldA, ldB], triggers)).toBe(true);
        expect(triggers.get('A')).toBe(12);
        expect(triggers.get('B')).toBe(32);
    });
});
```

- [ ] **Step 2: テスト失敗を確認**

Run: `npx vitest run src/utils/__tests__/livingDead.test.ts`
Expected: FAIL (`Cannot find module '../livingDead'`)

- [ ] **Step 3: ユーティリティを実装**

`src/utils/livingDead.ts`:

```typescript
import type { Mitigation, PartyMember, TimelineEvent } from '../types';

/** 二段階無敵(ウォーキングデッド型)か。データ駆動: isInvincible かつ walkingDeadDuration>0。 */
export function isLivingDeadStyle(def: Mitigation): boolean {
    return !!def.isInvincible && typeof def.walkingDeadDuration === 'number' && def.walkingDeadDuration > 0;
}

/** 実効ターゲットの最大HP。MT/ST は当該メンバー、それ以外は H1。見つからなければ 1。
 *  既存の致死判定 (CheatSheetView/TimelineRow/MobileTimelineRow) と同一ロジック。 */
export function maxHpForEffectiveTarget(
    effTarget: TimelineEvent['target'],
    partyMembers: PartyMember[],
): number {
    if (effTarget === 'MT' || effTarget === 'ST') {
        return partyMembers.find(m => m.id === effTarget)?.stats.hp || 1;
    }
    return partyMembers.find(m => m.id === 'H1')?.stats.hp || 1;
}

export interface LivingDeadInstance {
    id: string;                  // AppliedMitigation.id (配置インスタンス)
    time: number;                // 配置時刻
    duration: number;            // リビデ窓(=10)
    walkingDeadDuration: number; // ウォーキングデッド窓(=10)
    ownerId: string;
    targetId?: string;
}

/**
 * 1イベントを評価し、有効なリビングデッドのいずれかで生存するか判定する。
 * イベントは時刻昇順で評価されること(引き金=窓内で最初の致死を保証するため)。
 * triggers は呼び出し側が保持する可変 Map (ldInstanceId -> 引き金時刻 tT)。本関数が更新する。
 *
 * @param eventTime 評価対象イベントの時刻
 * @param mitigatedWithoutLivingDead リビデの無敵を除いた軽減後ダメージ(他軽減・他無敵適用後・バリア前)
 * @param maxHp 実効ターゲットの最大HP
 * @param livingDeads このイベントの context に適用されるリビデ全インスタンス
 * @param triggers 可変状態 (ldInstanceId -> tT)
 * @returns 生存するなら true
 */
export function resolveLivingDeadSurvival(
    eventTime: number,
    mitigatedWithoutLivingDead: number,
    maxHp: number,
    livingDeads: LivingDeadInstance[],
    triggers: Map<string, number>,
): boolean {
    let survived = false;
    for (const ld of livingDeads) {
        const tT = triggers.get(ld.id);
        if (tT !== undefined) {
            // 発動済み: ウォーキングデッド窓 [tT, tT+wd) 内なら生存
            if (eventTime >= tT && eventTime < tT + ld.walkingDeadDuration) survived = true;
        } else {
            // 未発動: リビデ窓 [time, time+duration) 内かつ致死なら、ここで発動
            const inWindow = eventTime >= ld.time && eventTime < ld.time + ld.duration;
            if (inWindow && mitigatedWithoutLivingDead > 0 && mitigatedWithoutLivingDead >= maxHp) {
                triggers.set(ld.id, eventTime);
                survived = true;
            }
        }
    }
    return survived;
}
```

- [ ] **Step 4: テスト成功を確認**

Run: `npx vitest run src/utils/__tests__/livingDead.test.ts`
Expected: PASS (全ケース)

- [ ] **Step 5: Commit**

```bash
rtk git add src/utils/livingDead.ts src/utils/__tests__/livingDead.test.ts
rtk git commit -m "feat(util): リビデ引き金検出 resolveLivingDeadSurvival + テスト"
```

---

### Task 3: CheatSheetView の damageMap に二段階モデルを統合

**Files:**
- Modify: `src/components/CheatSheetView.tsx` (damageMap useMemo, 現在 50-199 行)

**Interfaces:**
- Consumes: `isLivingDeadStyle`, `maxHpForEffectiveTarget`, `resolveLivingDeadSurvival`, `LivingDeadInstance` from `../utils/livingDead`。
- Produces: 変更なし (damageMap の戻り値 shape は同一)。`DamageInfo.isInvincible` がリビデでは条件付きで立つようになる。

- [ ] **Step 1: import 追加**

`src/components/CheatSheetView.tsx` の import 群に追加:

```typescript
import { isLivingDeadStyle, maxHpForEffectiveTarget, resolveLivingDeadSurvival, type LivingDeadInstance } from '../utils/livingDead';
```

- [ ] **Step 2: damageMap useMemo の冒頭に引き金状態とリビデ一覧を用意**

`const effTargetMap = buildEffectiveTargetMap(sortedEvents, swapMarkers, phases);` の直後 (68 行付近) に追加:

```typescript
        // リビデ(二段階無敵)の引き金状態。sortedEvents を時刻順に評価する間、保持する。
        const livingDeadTriggers = new Map<string, number>();
        const allLivingDeads: LivingDeadInstance[] = [];
        timelineMitigations.forEach(m => {
            const def = MITIGATIONS.find(d => d.id === m.mitigationId);
            if (def && isLivingDeadStyle(def)) {
                allLivingDeads.push({
                    id: m.id, time: m.time, duration: m.duration,
                    walkingDeadDuration: def.walkingDeadDuration!, ownerId: m.ownerId, targetId: m.targetId,
                });
            }
        });
```

- [ ] **Step 3: % ループの無敵分岐を「二段階はスキップ」に変更**

現在の (95-99 行):

```typescript
                if (def.isInvincible) {
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }
                if (isInvincibleForEvent) return;
```

を次に変更:

```typescript
                if (def.isInvincible) {
                    if (isLivingDeadStyle(def)) return; // 二段階無敵: %ループでは無視し、後段で条件付き判定
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }
                if (isInvincibleForEvent) return;
```

- [ ] **Step 4: % ループ後・バリア計算前にリビデ生存判定を挿入**

現在の (119-122 行):

```typescript
            currentDamage = Math.floor(currentDamage);
            const damageForShields = currentDamage;

            if (!isInvincibleForEvent) {
```

の `currentDamage = Math.floor(currentDamage);` と `const damageForShields` の間に挿入:

```typescript
            currentDamage = Math.floor(currentDamage);

            // リビングデッド(二段階無敵): 「リビデを除いた軽減後ダメ」が致死なら、窓内最初の被弾を起点に生存
            if (!isInvincibleForEvent) {
                const livingDeads = allLivingDeads.filter(ld => ld.ownerId === displayContext || ld.targetId === displayContext);
                if (livingDeads.length > 0) {
                    const maxHp = maxHpForEffectiveTarget(target, partyMembers);
                    if (resolveLivingDeadSurvival(event.time, currentDamage, maxHp, livingDeads, livingDeadTriggers)) {
                        currentDamage = 0;
                        isInvincibleForEvent = true;
                    }
                }
            }

            const damageForShields = currentDamage;
```

> 注: `target` は 76 行で算出済み (`effTargetMap.get(event.id) ?? event.target`)。`displayContext` は 77 行で算出済み。生存時 `isInvincibleForEvent=true` になるので、続くバリア計算 (`if (!isInvincibleForEvent)`) は従来どおりスキップされる。

- [ ] **Step 5: build とテスト**

Run: `npm run build`
Expected: 成功 (tsc 緑)。

Run: `npx vitest run src/utils/__tests__/livingDead.test.ts`
Expected: PASS (既存 util テストは不変で緑)。

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/CheatSheetView.tsx
rtk git commit -m "feat(cheatsheet): リビデ二段階モデルを damageMap に統合"
```

---

### Task 4: Timeline の damageMap に二段階モデルを統合 + 引き金を描画へ公開

**Files:**
- Modify: `src/components/Timeline.tsx` (damageMap useMemo 1879-2168, 戻り値の取り回し)

**Interfaces:**
- Consumes: `isLivingDeadStyle`, `maxHpForEffectiveTarget`, `resolveLivingDeadSurvival`, `LivingDeadInstance` from `../utils/livingDead`。
- Produces: コンポーネント内ローカル変数 `livingDeadTriggers: Map<string, number>` (ldInstanceId -> tT)。Task 5 の仮想アイテム描画が参照する。`damageMap` 変数名と `.get()` 利用箇所 (2841 行) は不変に保つ。

- [ ] **Step 1: import 追加**

`src/components/Timeline.tsx` の import 群に追加:

```typescript
import { isLivingDeadStyle, maxHpForEffectiveTarget, resolveLivingDeadSurvival, type LivingDeadInstance } from '../utils/livingDead';
```

- [ ] **Step 2: damageMap 冒頭に引き金状態とリビデ一覧を用意**

`const effTargetMap = buildEffectiveTargetMap(sortedEvents, swapMarkers, phases);` の直後 (1927 行付近) に追加:

```typescript
        const livingDeadTriggers = new Map<string, number>();
        const allLivingDeads: LivingDeadInstance[] = [];
        timelineMitigations.forEach(m => {
            const def = MITIGATIONS.find(d => d.id === m.mitigationId);
            if (def && isLivingDeadStyle(def)) {
                allLivingDeads.push({
                    id: m.id, time: m.time, duration: m.duration,
                    walkingDeadDuration: def.walkingDeadDuration!, ownerId: m.ownerId, targetId: m.targetId,
                });
            }
        });
```

- [ ] **Step 3: % ループの無敵分岐を「二段階はスキップ」に変更**

現在の (1959-1964 行):

```typescript
                if (def.isInvincible) {
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }

                if (isInvincibleForEvent) return;
```

を次に変更:

```typescript
                if (def.isInvincible) {
                    if (isLivingDeadStyle(def)) return; // 二段階無敵: %ループでは無視し、後段で条件付き判定
                    currentDamage = 0;
                    isInvincibleForEvent = true;
                }

                if (isInvincibleForEvent) return;
```

- [ ] **Step 4: % ループ後・バリア計算前にリビデ生存判定を挿入**

現在の (1996-1999 行):

```typescript
            currentDamage = Math.floor(currentDamage);
            const damageForShields = currentDamage;

            if (!isInvincibleForEvent) {
```

の間に挿入 (Task 3 Step 4 と同一ロジック):

```typescript
            currentDamage = Math.floor(currentDamage);

            // リビングデッド(二段階無敵): 「リビデを除いた軽減後ダメ」が致死なら、窓内最初の被弾を起点に生存
            if (!isInvincibleForEvent) {
                const livingDeads = allLivingDeads.filter(ld => ld.ownerId === displayContext || ld.targetId === displayContext);
                if (livingDeads.length > 0) {
                    const maxHp = maxHpForEffectiveTarget(target, partyMembers);
                    if (resolveLivingDeadSurvival(event.time, currentDamage, maxHp, livingDeads, livingDeadTriggers)) {
                        currentDamage = 0;
                        isInvincibleForEvent = true;
                    }
                }
            }

            const damageForShields = currentDamage;
```

> 注: `target`(1935) / `displayContext`(1936) は算出済み。

- [ ] **Step 5: useMemo の戻り値に引き金を含め、変数で取り回す**

現在の (2167-2168 行):

```typescript
        return map;
    }, [eventsByTime, timelineMitigations, partyMembers, phases]);
```

を次に変更:

```typescript
        return { map, livingDeadTriggers };
    }, [eventsByTime, timelineMitigations, partyMembers, phases]);

    const damageMap = damageMapResult.map;
    const livingDeadTriggers = damageMapResult.livingDeadTriggers;
```

さらに useMemo の宣言 `const damageMap = useMemo(() => {` (1879 行) を次に変更:

```typescript
    const damageMapResult = useMemo(() => {
```

> これで `damageMap.get(event.id)` を使う 2841 行は無改修で動く。`livingDeadTriggers` が Task 5 で参照可能になる。

- [ ] **Step 6: build とテスト**

Run: `npm run build`
Expected: 成功。

Run: `npx vitest run`
Expected: 既存テスト緑 (`RecastRow.test.tsx` / `skillModeCompatibility.test.ts` 等、無敵の回帰含む)。既知の既存 failure (`TopBar.test.tsx` 4件 / `HousingWorkspace.test.tsx` 1件) は本変更と無関係なので不問。

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(timeline): リビデ二段階モデルを damageMap に統合 + 引き金を描画へ公開"
```

---

### Task 5: タイムラインに白黒ウォーキングデッド仮想アイコンを描画

**Files:**
- Modify: `src/components/Timeline.tsx` (MitigationItemProps 86-110 / destructure 200-206 / img 529-540 / displayItems 生成 3152-3192 / 親バー切り詰め 3320-3334 / MitigationItem 描画 3338-3360)

**Interfaces:**
- Consumes: `livingDeadTriggers` (Task 4)、`isLivingDeadStyle` (Task 2)。
- Produces: 表示のみ。永続化なし。

- [ ] **Step 1: MitigationItemProps に grayscale 追加**

`iconOverride?: string;` (103 行) の直後に追加:

```typescript
    iconOverride?: string;
    /** 仮想アイテムを白黒表示する(ウォーキングデッド用)。 */
    grayscale?: boolean;
```

- [ ] **Step 2: destructure に追加**

`isVirtual = false, iconOverride, layoutReady = true` (205 行) を次に変更:

```typescript
        isVirtual = false, iconOverride, layoutReady = true, grayscale = false
```

- [ ] **Step 3: img に白黒フィルタを適用**

現在の img (529-540 行) を次に変更 (`style` を追加。Tailwind ではなく inline filter で Lightning CSS の影響を回避):

```typescript
                            <img
                                src={iconUrl}
                                alt=""
                                style={grayscale ? { filter: 'grayscale(1)' } : undefined}
                                className={clsx(
                                    "object-contain",
                                    isVirtual ? (
                                        (iconUrl.includes('Giant_Dominance.png') || iconUrl.includes('horoscope_helios.png'))
                                            ? "w-3 h-auto"
                                            : "w-5 h-5"
                                    ) : "w-full h-full rounded"
                                )}
                            />
```

- [ ] **Step 4: displayItems 生成にウォーキングデッド仮想アイテムを追加**

`earthly_star` 分岐 (3178-3191 行) の閉じ `}` の直後 (3191 行付近、`});` で displayItems.push の forEach が閉じる前) に追加:

```typescript
                                    if (def && isLivingDeadStyle(def)) {
                                        const tT = livingDeadTriggers.get(m.id);
                                        if (tT !== undefined) {
                                            displayItems.push({
                                                ...m,
                                                id: `virtual-wd-${m.id}`,
                                                time: tT,
                                                duration: def.walkingDeadDuration!,
                                                isVirtual: true,
                                                iconOverride: def.icon,
                                                grayscale: true,
                                                parentId: m.id,
                                            });
                                        }
                                    }
```

> `def` は 3154 行で取得済み (`MITIGATIONS.find(d => d.id === m.mitigationId)`)。`m` はオーナーの配置済みリビデ。引き金が無ければ仮想アイテムを作らない (= 白黒も出ない)。

- [ ] **Step 5: 親リビデバーを引き金で切り詰める**

`earthly_star` の高さ切り詰め (3330-3333 行) の直後に追加:

```typescript
                                                        if (def && isLivingDeadStyle(def)) {
                                                            const tT = livingDeadTriggers.get(mitigation.id);
                                                            if (tT !== undefined) {
                                                                const cutY = getMappedY(tT);
                                                                height = Math.max(0, Math.round(cutY - startY) - 8);
                                                            }
                                                        }
```

> この `if (!mitigation.isVirtual) {` ブロック内 (3320 行) なので、親リビデ本体のバーだけが対象。`getMappedY` / `startY` / `height` は同スコープで定義済み。

- [ ] **Step 6: MitigationItem に grayscale を渡す**

`isVirtual={mitigation.isVirtual}` (3356 行) の直後に追加:

```typescript
                                                            isVirtual={mitigation.isVirtual}
                                                            grayscale={mitigation.grayscale}
```

- [ ] **Step 7: build**

Run: `npm run build`
Expected: 成功 (tsc 緑)。`mitigation.grayscale` は displayItems が any[] のため型エラーにならない (既存 iconOverride と同じ扱い)。

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(timeline): ウォーキングデッドを白黒リビデアイコンの仮想アイテムで表示"
```

---

### Task 6: 実機総点検 (多エージェント) + 回帰確認

**Files:** なし (検証タスク)

このタスクは「共有 damageMap を触ったことによる広域の実機破壊」を洗い出すための総点検 (ユーザー指示「ここだけに限らず総点検」)。`feedback_structural_refactor_runtime_audit` に従う。

- [ ] **Step 1: フルビルド + フルテスト**

Run: `npm run build`
Expected: 成功。

Run: `npx vitest run`
Expected: 既存 failure (`TopBar`/`HousingWorkspace`) 以外すべて緑。新規 `livingDead.test.ts` 緑。

- [ ] **Step 2: リビデ本体の手動シナリオ確認 (PC 表 + タイムライン)**

`npm run dev` で起動し、DRK にリビデを配置して次を目視:
- 致死イベントが窓内 → 引き金イベント以降 WD 窓のイベントが Invuln 表示、引き金前の非致死は通常ダメージ。
- タイムラインに白黒リビデアイコンが引き金時刻から WD バー付きで出る。親リビデバーが引き金で切れている。
- 致死イベントが窓に無い → どのイベントも Invuln にならず、白黒アイコンも出ない。
- 引き金が窓終盤 → WD バーがリビデ窓を超えて伸びる (最大約20秒)。

- [ ] **Step 3: 共有計算依存の広域回帰を多エージェントで点検**

`superpowers:dispatching-parallel-agents` で、damageMap / タイムライン描画に依存する挙動を分担点検する。各エージェントは実コード追跡 + 必要なら Playwright で実機確認し、リビデ改修による回帰がないか報告する:
- 他の無敵3種 (インビンシブル/ホルムギャング/ボーライド): 効果時間中ずっと一律 Invuln のまま (回帰なし)。
- バリア/スタック (鼓舞/秘策/ハイマ/パンハイマ/展開戦術 copiesShield): 値が変わっていない。
- 軽減%・burst・exclusiveWith・デバフ軽減 (リプライザル): 値が変わっていない。
- タンクスワップ (挑発) 後の致死判定/対象HP。
- `hideEmptyRows` ON/OFF でのバー・仮想アイコンの描画安定性。
- モバイル (`MobileTimelineRow`) のダメージ/Invuln 表示。
- 共同編集 (collab) でのリビデ配置同期 (仮想WDは派生で非保存) — 2タブ実機は両方最新版で ([[reference_collab_two_client_version_skew]])。
- FFLogs インポート済みプランでの表示。

- [ ] **Step 4: 指摘があれば修正 → Step 1 から再点検。なければ完了コミット (あれば)**

```bash
rtk git add -A
rtk git commit -m "test: リビデ実機総点検の修正反映"   # 修正があった場合のみ
```

---

### Task 7: 本番反映 (Firestore 同期) — デプロイ時に Claude が実行

**Files:** なし (デプロイ作業)

スキル正本は Firestore。`walkingDeadDuration` を本番 `living_dead` ドキュメントへ反映しないと、本番では `isLivingDeadStyle` が false になり二段階モデルが有効化されない (= 旧挙動のまま・壊れはしない)。`feedback_skill_firestore_sync` / `reference_skill_add_rollout` に従う。

- [ ] **Step 1: ブランチをマージ → 本番デプロイ**

`feat/living-dead-modeling` を main にマージ → push (Vercel 自動デプロイ [[reference_vercel_git_autodeploy]])。

- [ ] **Step 2: Firestore の living_dead に walkingDeadDuration=10 を反映**

ADDITIVE seed は既存スキルのフィールドを更新しないため、次のいずれかで反映する (安全な方を選択):
- (推奨) 管理画面 `/admin` のスキル編集で Living Dead に `walkingDeadDuration` を保存 (Step 0 として SkillFormModal に数値入力欄を足す必要があれば別タスク化)。
- または `walkingDeadDuration` の 1 フィールドだけ更新する targeted スクリプト。
- `seed-skills-stats.ts --force-overwrite` は mockData が Firestore 正本ミラーである前提でのみ (全スキル上書き・影響大)。

反映後、`dataVersion` がインクリメントされクライアントキャッシュが無効化されることを確認。

- [ ] **Step 3: 本番実機でエンドユーザー視点の最終確認**

`feedback_endpoint_user_verification` に従い、本番で DRK リビデ二段階が効くことを 1 回通す (表 + タイムライン白黒アイコン)。

- [ ] **Step 4: TODO 更新 → 完了タスクを TODO_COMPLETED.md へ移動**

---

## Self-Review

**Spec coverage (spec §ごとに対応タスク):**
- §3 計算モデル (案A/案1) → Task 2 (引き金純粋関数) + Task 3/4 (両 damageMap 統合)。判定順序 (致死先行)・最初の致死=tT・非致死は通常ダメ・引き金なしは無効、すべてカバー。
- §3 maxHp 解決 (getEffectiveTarget) → `maxHpForEffectiveTarget` + 既存 effTargetMap 流用。
- §3 tT を 1 箇所で計算し共有 → `livingDeadTriggers` を damageMap で算出し描画へ公開 (Task 4 Step 5)。
- §4 表示 (Invuln 据え置き) → 既存 `DamageInfo.isInvincible` を条件付きで立てるのみ。表示コード無改修 (Task 3/4)。
- §4 白黒仮想アイコン + 親バー切り詰め → Task 5。
- §5 データフィールド方式 → Task 1。データ駆動判定 (`isLivingDeadStyle`) → Task 2。
- §5 Firestore 同期 → Task 7。
- §6 永続化 (派生は非保存) → AppliedMitigation 無改修 (どのタスクでも追加しない)。
- §7 エッジケース (複数リビデ/他無敵重複/showPreStart/hideEmptyRows/FFLogs/maxHp未設定) → Task 2 テスト + Task 6 点検。
- §8 テスト → Task 2 (単体) + Task 6 (実機/回帰)。
- §9 autoPlanner 対象外 → 本計画では触らない (Global Constraints/spec の任意フォロー)。

**Placeholder scan:** プレースホルダなし。全 Step に実コード/実コマンド/期待結果を記載。Task 7 Step 2 の「同期手段の選択」はデプロイ時の安全判断であり実装の TODO ではない (3 案を具体提示済み)。

**Type consistency:** `isLivingDeadStyle` / `maxHpForEffectiveTarget` / `resolveLivingDeadSurvival` / `LivingDeadInstance` / `livingDeadTriggers` / `walkingDeadDuration` / `grayscale` の名称は Task 1-5 で一貫。`damageMapResult` への改名と `damageMap`/`livingDeadTriggers` 変数の導出を Task 4 Step 5 で明示し、2841 行の `damageMap.get` 利用と整合。
