# タイムライン 種別クリックループ + デバフ軽減不可 属性 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** タイムラインの種別アイコンをPCクリックで3循環できるようにし、攻撃に「デバフ軽減不可」フラグを追加してデバフ系軽減(リプライザル/フェイント/アドル/ディスマントル)の%軽減だけを計算から除外する。

**Architecture:** デバフ判定は `Mitigation.appliesAsDebuff` データで表現(ハードコードID判定しない)。イベントの `TimelineEvent.ignoresDebuffMitigation` がONのとき、計算の%軽減ループで該当スキルをスキップ。スキップ判定と種別循環は純関数に切り出してTDDし、計算2箇所(本体/モーダルプレビュー)で共有。UIは種別アイコンを共有コンポーネント `DamageTypeIcon` 化し、PCはクリック可能ラッパ `PcTypeToggle`、モバイルは表示のみ。フラグONの印は淡い赤背景+赤リングの小箱。

**Tech Stack:** React + TypeScript, Zustand (useMitigationStore), Vitest + @testing-library/react (happy-dom), react-i18next, Tailwind v4, Yjs(collab同期)。

設計書: [docs/superpowers/specs/2026-06-14-timeline-damage-type-and-debuff-immune-design.md](../specs/2026-06-14-timeline-damage-type-and-debuff-immune-design.md)

---

## ファイル構成

- **Modify** `src/types/index.ts` — `Mitigation.appliesAsDebuff?`, `TimelineEvent.ignoresDebuffMitigation?` 追加
- **Modify** `src/data/mockData.ts` — デバフ4スキル(7定義ブロック)に `appliesAsDebuff: true`
- **Create** `src/utils/damageTypeLogic.ts` — `isMitigationBlockedByEvent` / `nextDamageType` 純関数
- **Create** `src/utils/__tests__/damageTypeLogic.test.ts` — 上記のテスト
- **Create** `src/data/__tests__/debuffMitigationFlag.test.ts` — データ整合ガード
- **Create** `src/components/DamageTypeIcon.tsx` — 種別アイコン+赤箱印(PC/モバイル共有)
- **Create** `src/components/__tests__/DamageTypeIcon.test.tsx` — 印の表示テスト
- **Modify** `src/components/Timeline.tsx` — %軽減ループにスキップ1行
- **Modify** `src/components/EventForm.tsx` — プレビュー計算スキップ + フラグ編集チェックボックス + 保存/復元
- **Modify** `src/components/__tests__/EventForm.damage.test.tsx` — フラグ復元テスト追加
- **Modify** `src/components/TimelineRow.tsx` — `PcTypeToggle` 追加 + 種別アイコン差し替え
- **Modify** `src/components/MobileTimelineRow.tsx` — 種別アイコンを `DamageTypeIcon` に差し替え
- **Modify** `src/locales/{ja,en,ko,zh}.json` — i18n キー追加

---

## Task 1: 型 + デバフスキルデータ + 整合ガード

**Files:**
- Modify: `src/types/index.ts:32-80`(Mitigation), `src/types/index.ts:95-103`(TimelineEvent)
- Modify: `src/data/mockData.ts:411`, `:749-776`
- Test: `src/data/__tests__/debuffMitigationFlag.test.ts`

- [ ] **Step 1: `Mitigation` 型にフィールド追加**

`src/types/index.ts` の `Mitigation` interface 内、`exclusiveWith?` の行([src/types/index.ts:65](../../../src/types/index.ts#L65))の直後に追加:

```ts
    /** ボスにデバフを付与してダメージを下げるタイプの軽減か(リプライザル/フェイント/アドル/ウェポンブレイク)。
     *  true の軽減は、イベントの ignoresDebuffMitigation=true のとき % 軽減計算から除外される。 */
    appliesAsDebuff?: boolean;
```

- [ ] **Step 2: `TimelineEvent` 型にフィールド追加**

`src/types/index.ts` の `TimelineEvent` interface 内、`target?` の行([src/types/index.ts:100](../../../src/types/index.ts#L100))の直後に追加:

```ts
    /** true のとき、デバフ系軽減(appliesAsDebuff)の % 軽減を無効化する(外周攻撃など)。 */
    ignoresDebuffMitigation?: boolean;
```

- [ ] **Step 3: mockData の4スキル(7ブロック)に `appliesAsDebuff: true` を付与**

`src/data/mockData.ts` の各 `family: "..."` の直前に `appliesAsDebuff: true,` を追加する。対象は以下7箇所。

dismantle ([:412](../../../src/data/mockData.ts#L412)):
```ts
        recast: 120, duration: 10, type: "all", value: 10, isShield: false, minLevel: 62, appliesAsDebuff: true, family: "ranged_target_10"
```
reprisal ([:750](../../../src/data/mockData.ts#L750)):
```ts
        recast: 60, duration: 15, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
```
reprisal_base ([:754](../../../src/data/mockData.ts#L754)):
```ts
        recast: 60, duration: 10, type: "all" as const, value: 10, isShield: false, scope: "party" as const, minLevel: 22, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
```
addle ([:759-760](../../../src/data/mockData.ts#L759)):
```ts
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
```
addle_base ([:764-765](../../../src/data/mockData.ts#L764)):
```ts
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 10, valuePhysical: 5, scope: "party" as const, minLevel: 8, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
```
feint ([:770-771](../../../src/data/mockData.ts#L770)):
```ts
        recast: 90, duration: 15, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 98, appliesAsDebuff: true, family: "role_action"
```
feint_base ([:775-776](../../../src/data/mockData.ts#L775)):
```ts
        recast: 90, duration: 10, type: "all" as const, value: 10, isShield: false,
        valueMagical: 5, valuePhysical: 10, scope: "party" as const, minLevel: 22, maxLevel: 97, appliesAsDebuff: true, family: "role_action"
```

- [ ] **Step 4: データ整合ガードのテストを書く(失敗する)**

`src/data/__tests__/debuffMitigationFlag.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { MITIGATIONS } from '../mockData';

// appliesAsDebuff が付いてよいのは、ボスデバフ系の4ファミリーのみ。
// 付け忘れ(新スキル追加時の漏れ)と、付けすぎ(バフに誤付与)の両方を防ぐ。
const DEBUFF_NAMES_EN = new Set(['Reprisal', 'Feint', 'Addle', 'Dismantle']);

describe('appliesAsDebuff フラグの整合性', () => {
  it('appliesAsDebuff=true のスキルは全てデバフ4系のいずれかである', () => {
    const flagged = MITIGATIONS.filter(m => m.appliesAsDebuff);
    expect(flagged.length).toBeGreaterThan(0);
    for (const m of flagged) {
      expect(DEBUFF_NAMES_EN.has(m.name.en as string)).toBe(true);
    }
  });

  it('デバフ4系のスキルは全て appliesAsDebuff=true を持つ', () => {
    const debuffs = MITIGATIONS.filter(m => DEBUFF_NAMES_EN.has(m.name.en as string));
    expect(debuffs.length).toBeGreaterThan(0);
    for (const m of debuffs) {
      expect(m.appliesAsDebuff).toBe(true);
    }
  });
});
```

- [ ] **Step 5: テスト実行(緑になることを確認)**

Run: `npx vitest run src/data/__tests__/debuffMitigationFlag.test.ts`
Expected: PASS(Step 3 のデータ付与が正しければ緑。落ちたら付与漏れ/付けすぎを修正)

- [ ] **Step 6: ビルド確認**

Run: `npm run build`
Expected: tsc 厳密含め EXIT=0(新規 optional フィールドなので既存に影響しない)

- [ ] **Step 7: コミット**

```bash
git add src/types/index.ts src/data/mockData.ts src/data/__tests__/debuffMitigationFlag.test.ts
git commit -m "feat(timeline): Mitigation.appliesAsDebuff と TimelineEvent.ignoresDebuffMitigation 追加 + デバフ4系にフラグ付与"
```

---

## Task 2: スキップ判定 + 種別循環 の純関数

**Files:**
- Create: `src/utils/damageTypeLogic.ts`
- Test: `src/utils/__tests__/damageTypeLogic.test.ts`

- [ ] **Step 1: テストを書く(失敗する)**

`src/utils/__tests__/damageTypeLogic.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { isMitigationBlockedByEvent, nextDamageType } from '../damageTypeLogic';
import type { TimelineEvent, Mitigation } from '../../types';

const ev = (over: Partial<TimelineEvent>): TimelineEvent => ({
  id: 'e', time: 0, name: { ja: '', en: '' }, damageType: 'magical', ...over,
});
const mit = (over: Partial<Mitigation>): Mitigation => ({
  id: 'm', jobId: 'war', name: { ja: '', en: '' }, icon: '', recast: 0, duration: 0,
  type: 'all', value: 10, ...over,
});

describe('isMitigationBlockedByEvent', () => {
  it('フラグON × デバフ軽減 → ブロックする', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: true }), mit({ appliesAsDebuff: true }))).toBe(true);
  });
  it('フラグON × 通常軽減 → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: true }), mit({ appliesAsDebuff: false }))).toBe(false);
  });
  it('フラグOFF × デバフ軽減 → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({ ignoresDebuffMitigation: false }), mit({ appliesAsDebuff: true }))).toBe(false);
  });
  it('未設定(両方undefined) → ブロックしない', () => {
    expect(isMitigationBlockedByEvent(ev({}), mit({}))).toBe(false);
  });
});

describe('nextDamageType', () => {
  it('physical → magical → unavoidable → physical で循環', () => {
    expect(nextDamageType('physical')).toBe('magical');
    expect(nextDamageType('magical')).toBe('unavoidable');
    expect(nextDamageType('unavoidable')).toBe('physical');
  });
  it('循環外(enrage 等)は physical に寄せる', () => {
    expect(nextDamageType('enrage')).toBe('physical');
  });
});
```

- [ ] **Step 2: テスト実行(失敗確認)**

Run: `npx vitest run src/utils/__tests__/damageTypeLogic.test.ts`
Expected: FAIL("Cannot find module '../damageTypeLogic'")

- [ ] **Step 3: 実装**

`src/utils/damageTypeLogic.ts`:
```ts
import type { TimelineEvent, Mitigation } from '../types';

/** イベントが「デバフ軽減不可」かつ当該軽減がデバフ系なら、% 軽減をブロックする。 */
export function isMitigationBlockedByEvent(
  event: Pick<TimelineEvent, 'ignoresDebuffMitigation'>,
  mitigation: Pick<Mitigation, 'appliesAsDebuff'>,
): boolean {
  return !!(event.ignoresDebuffMitigation && mitigation.appliesAsDebuff);
}

/** タイムラインの種別クリックループ順。循環外の値は physical に寄せる。 */
const DAMAGE_TYPE_CYCLE: Array<TimelineEvent['damageType']> = ['physical', 'magical', 'unavoidable'];

export function nextDamageType(current: TimelineEvent['damageType']): TimelineEvent['damageType'] {
  const i = DAMAGE_TYPE_CYCLE.indexOf(current);
  return DAMAGE_TYPE_CYCLE[(i + 1) % DAMAGE_TYPE_CYCLE.length]; // i=-1 のとき (i+1)=0 → physical
}
```

- [ ] **Step 4: テスト実行(緑確認)**

Run: `npx vitest run src/utils/__tests__/damageTypeLogic.test.ts`
Expected: PASS(8 アサーション)

- [ ] **Step 5: コミット**

```bash
git add src/utils/damageTypeLogic.ts src/utils/__tests__/damageTypeLogic.test.ts
git commit -m "feat(timeline): デバフ軽減スキップ判定と種別循環の純関数を追加(TDD)"
```

---

## Task 3: 計算へスキップを配線(本体 + モーダルプレビュー)

**Files:**
- Modify: `src/components/Timeline.tsx:1854-1886`
- Modify: `src/components/EventForm.tsx:412-413`

- [ ] **Step 1: Timeline.tsx の import 追加**

`src/components/Timeline.tsx` 冒頭の import 群に追加:
```ts
import { isMitigationBlockedByEvent } from '../utils/damageTypeLogic';
```

- [ ] **Step 2: %軽減ループにスキップを追加**

`src/components/Timeline.tsx` の %軽減 forEach 内、`if (!def) return;`([Timeline.tsx:1856](../../../src/components/Timeline.tsx#L1856))の直後に追加:
```ts
                // デバフ軽減不可の攻撃には、デバフ系軽減(リプライザル等)の % を適用しない
                if (isMitigationBlockedByEvent(event, def)) return;
```
※ここは%軽減ループのみ。バリアループ(1901-2053)は変更しない(デバフ4系は isShield=false でバリア対象外)。

- [ ] **Step 3: EventForm.tsx の import 追加**

`src/components/EventForm.tsx` 冒頭の import 群に追加:
```ts
import { isMitigationBlockedByEvent } from '../utils/damageTypeLogic';
```

- [ ] **Step 4: EventForm プレビュー計算にスキップを追加**

`src/components/EventForm.tsx` の `if (def.value > 0) {`([EventForm.tsx:413](../../../src/components/EventForm.tsx#L413))の**直前**に追加:
```ts
            // デバフ軽減不可フラグONなら、デバフ系軽減の % は逆算に含めない
            if (isMitigationBlockedByEvent({ ignoresDebuffMitigation }, def)) return;
```
※`ignoresDebuffMitigation` は Task 7 で追加するローカル state。Task 7 完了まで未定義参照になるため、**本ステップの Step 4 は Task 7 の後に適用してもよい**(順序入替可)。先に入れる場合は Task 7 の state 追加を先に行うこと。

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: EXIT=0(Step 4 を Task 7 後に回す場合は、ここでは Step 1-2 のみ確認)

- [ ] **Step 6: 既存テスト回帰確認**

Run: `npx vitest run src/components/__tests__/EventForm.damage.test.ts src/components/__tests__/Timeline.readonly.test.tsx`
Expected: PASS(フラグ未設定では挙動不変=既存緑維持)

- [ ] **Step 7: コミット**

```bash
git add src/components/Timeline.tsx src/components/EventForm.tsx
git commit -m "feat(timeline): デバフ軽減不可フラグを本体計算とモーダルプレビューに配線"
```

---

## Task 4: 種別アイコン共有コンポーネント `DamageTypeIcon`

**Files:**
- Create: `src/components/DamageTypeIcon.tsx`
- Test: `src/components/__tests__/DamageTypeIcon.test.tsx`

- [ ] **Step 1: テストを書く(失敗する)**

`src/components/__tests__/DamageTypeIcon.test.tsx`:
```tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }),
}));

import { DamageTypeIcon } from '../DamageTypeIcon';

describe('DamageTypeIcon', () => {
  it('種別に応じたアイコンを出す(magical)', () => {
    const { container } = render(<DamageTypeIcon damageType="magical" />);
    expect(container.querySelector('img[src="/icons/type_magic.png"]')).toBeTruthy();
  });

  it('フラグOFF時は赤リングの印を出さない', () => {
    const { container } = render(<DamageTypeIcon damageType="physical" />);
    expect(container.querySelector('.ring-red-500\\/40')).toBeNull();
  });

  it('フラグON時は赤リングの印を出す', () => {
    const { container } = render(<DamageTypeIcon damageType="physical" ignoresDebuffMitigation />);
    expect(container.querySelector('.ring-red-500\\/40')).toBeTruthy();
  });
});
```

- [ ] **Step 2: テスト実行(失敗確認)**

Run: `npx vitest run src/components/__tests__/DamageTypeIcon.test.tsx`
Expected: FAIL("Cannot find module '../DamageTypeIcon'")

- [ ] **Step 3: 実装**

`src/components/DamageTypeIcon.tsx`:
```tsx
import React from 'react';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { TimelineEvent } from '../types';
import { Tooltip } from './ui/Tooltip';

const ICON_BY_TYPE: Partial<Record<NonNullable<TimelineEvent['damageType']>, { src: string; altKey: string }>> = {
  magical: { src: '/icons/type_magic.png', altKey: 'modal.magical' },
  physical: { src: '/icons/type_phys.png', altKey: 'modal.physical' },
  unavoidable: { src: '/icons/type_dark.png', altKey: 'modal.unique' },
};

/** 種別アイコン(magical/physical/unavoidable)。ignoresDebuffMitigation=true のとき
 *  淡い赤背景+赤リングの小箱で囲み「デバフ軽減無効」を示す。PC/モバイル共有。 */
export const DamageTypeIcon: React.FC<{
  damageType: TimelineEvent['damageType'];
  ignoresDebuffMitigation?: boolean;
  size?: string;       // 例 "w-3 h-3"(PC) / "w-4 h-4"(モバイル)
  className?: string;
}> = ({ damageType, ignoresDebuffMitigation, size = 'w-3 h-3', className }) => {
  const { t } = useTranslation();
  const def = damageType ? ICON_BY_TYPE[damageType] : undefined;
  if (!def) return null;

  const img = <img src={def.src} className={clsx(size, 'object-contain opacity-90')} alt={t(def.altKey)} />;

  if (!ignoresDebuffMitigation) {
    return <span className={clsx('flex-shrink-0 inline-flex', className)}>{img}</span>;
  }

  return (
    <Tooltip content={t('timeline.debuff_immune_hint')} position="top">
      <span className={clsx('flex-shrink-0 inline-flex items-center justify-center rounded-sm p-px bg-red-500/10 ring-1 ring-red-500/40', className)}>
        {img}
      </span>
    </Tooltip>
  );
};
```

- [ ] **Step 4: テスト実行(緑確認)**

Run: `npx vitest run src/components/__tests__/DamageTypeIcon.test.tsx`
Expected: PASS(3 件)

- [ ] **Step 5: コミット**

```bash
git add src/components/DamageTypeIcon.tsx src/components/__tests__/DamageTypeIcon.test.tsx
git commit -m "feat(timeline): 種別アイコン共有コンポーネント DamageTypeIcon(赤箱印付き)"
```

---

## Task 5: `PcTypeToggle` + TimelineRow への配線(PCクリック / モバイル表示)

**Files:**
- Modify: `src/components/TimelineRow.tsx`(`PcTypeToggle` 追加・種別アイコン差し替え)

- [ ] **Step 1: import 追加**

`src/components/TimelineRow.tsx` の import 群に追加:
```ts
import { DamageTypeIcon } from './DamageTypeIcon';
import { nextDamageType } from '../utils/damageTypeLogic';
```

- [ ] **Step 2: `PcTypeToggle` コンポーネントを追加**

`src/components/TimelineRow.tsx` の `PcTargetToggle` 定義([TimelineRow.tsx:125](../../../src/components/TimelineRow.tsx#L125))の直前に追加:
```tsx
// PC用: 種別アイコン — クリックで physical→magical→unavoidable を循環(モーダルを開かず即切替)。
// updateEvent 経由なので collab 同期・Undo・ダメージ再計算はモーダル変更と完全に同一経路。
// 純粋な閲覧者は store 側ガードで no-op。md: のみ表示(モバイルは別途 DamageTypeIcon を表示)。
const PcTypeToggle: React.FC<{ event: TimelineEvent }> = ({ event }) => {
    const { t } = useTranslation();
    const updateEvent = useMitigationStore(state => state.updateEvent);
    if (!event.damageType) return null;
    return (
        <Tooltip content={t('timeline.toggle_type_hint')}>
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation(); // 行クリック(編集モーダル)を抑止して即トグル
                    updateEvent(event.id, { damageType: nextDamageType(event.damageType) });
                }}
                className="hidden md:inline-flex items-center cursor-pointer rounded-sm hover:bg-app-surface2 active:scale-95 transition-all"
            >
                <DamageTypeIcon damageType={event.damageType} ignoresDebuffMitigation={event.ignoresDebuffMitigation} size="w-3 h-3" />
            </button>
        </Tooltip>
    );
};
```

- [ ] **Step 3: 1イベント表示の種別アイコンを差し替え**

`src/components/TimelineRow.tsx` の1イベント側、種別アイコン3行([TimelineRow.tsx:392-394](../../../src/components/TimelineRow.tsx#L392))を以下に置換:
```tsx
                            {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                            <PcTypeToggle event={events[0]} />
                            <DamageTypeIcon damageType={events[0].damageType} ignoresDebuffMitigation={events[0].ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />
```

- [ ] **Step 4: 2イベント表示の種別アイコンを差し替え**

`src/components/TimelineRow.tsx` の2イベント側、種別アイコン3行([TimelineRow.tsx:449-451](../../../src/components/TimelineRow.tsx#L449))を以下に置換:
```tsx
                                    {/* 種別: PC=クリックで循環 / モバイル=表示のみ(両方とも赤箱印あり) */}
                                    <PcTypeToggle event={events[idx]} />
                                    <DamageTypeIcon damageType={events[idx].damageType} ignoresDebuffMitigation={events[idx].ignoresDebuffMitigation} size="w-3 h-3" className="md:hidden" />
```

- [ ] **Step 5: ビルド確認**

Run: `npm run build`
Expected: EXIT=0

- [ ] **Step 6: 既存 TimelineRow 関連テスト回帰**

Run: `npx vitest run src/components/__tests__/Timeline.readonly.test.tsx src/components/__tests__/Timeline.layout.test.tsx`
Expected: PASS

- [ ] **Step 7: コミット**

```bash
git add src/components/TimelineRow.tsx
git commit -m "feat(timeline): 種別アイコンをPCクリックで3循環(PcTypeToggle)+ モバイルは印付き表示"
```

---

## Task 6: MobileTimelineRow の種別アイコン差し替え

**Files:**
- Modify: `src/components/MobileTimelineRow.tsx:257-264`

- [ ] **Step 1: import 追加**

`src/components/MobileTimelineRow.tsx` の import 群に追加:
```ts
import { DamageTypeIcon } from './DamageTypeIcon';
```

- [ ] **Step 2: 種別アイコン3条件を差し替え**

`src/components/MobileTimelineRow.tsx` の種別アイコン部([MobileTimelineRow.tsx:257-264](../../../src/components/MobileTimelineRow.tsx#L257))の3つの `{event?.damageType === ... && (<img .../>)}` ブロックを、以下1行に置換:
```tsx
                    <DamageTypeIcon damageType={event?.damageType} ignoresDebuffMitigation={event?.ignoresDebuffMitigation} size="w-4 h-4" className="rounded" />
```
※ `event?` が undefined の場合、`DamageTypeIcon` は damageType=undefined → null を返すので安全(従来も3条件とも false で何も出なかったのと等価)。

- [ ] **Step 3: ビルド確認**

Run: `npm run build`
Expected: EXIT=0

- [ ] **Step 4: コミット**

```bash
git add src/components/MobileTimelineRow.tsx
git commit -m "feat(timeline): モバイル行の種別アイコンも DamageTypeIcon に統一(赤箱印対応)"
```

---

## Task 7: EventForm にフラグ編集チェックボックス

**Files:**
- Modify: `src/components/EventForm.tsx`(state / 復元 / 保存 / UI)
- Test: `src/components/__tests__/EventForm.damage.test.tsx`

- [ ] **Step 1: テスト追加(失敗する)**

`src/components/__tests__/EventForm.damage.test.tsx` の末尾(最後の `});` の後)に追加:
```tsx
describe('EventForm デバフ軽減不可フラグ', () => {
  it('initialData の ignoresDebuffMitigation=true でチェックボックスが ON で開く', () => {
    render(
      <EventForm
        initialData={{ ...damagedEvent, ignoresDebuffMitigation: true }}
        onSave={() => {}}
      />
    );
    const cb = screen.getByTestId('ignores-debuff-mit') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('保存時に ignoresDebuffMitigation が onSave に渡る', () => {
    let saved: any = null;
    render(<EventForm initialData={{ ...damagedEvent, ignoresDebuffMitigation: true }} onSave={(e) => { saved = e; }} />);
    (document.getElementById('event-modal-form') as HTMLFormElement).requestSubmit?.()
      ?? (document.getElementById('event-modal-form') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved?.ignoresDebuffMitigation).toBe(true);
  });
});
```

- [ ] **Step 2: テスト実行(失敗確認)**

Run: `npx vitest run src/components/__tests__/EventForm.damage.test.tsx`
Expected: FAIL("Unable to find ... ignores-debuff-mit")

- [ ] **Step 3: state 追加**

`src/components/EventForm.tsx` の `const [target, setTarget] = ...`([EventForm.tsx:58](../../../src/components/EventForm.tsx#L58))の直後に追加:
```ts
    const [ignoresDebuffMitigation, setIgnoresDebuffMitigation] = useState(false);
```

- [ ] **Step 4: 復元/リセットに反映**

`src/components/EventForm.tsx` の `setDamageType(initialData.damageType);`([EventForm.tsx:122](../../../src/components/EventForm.tsx#L122))の直後に追加:
```ts
            setIgnoresDebuffMitigation(!!initialData.ignoresDebuffMitigation);
```
`src/components/EventForm.tsx` の else 側 `setDamageType('magical');`([EventForm.tsx:136](../../../src/components/EventForm.tsx#L136))の直後に追加:
```ts
            setIgnoresDebuffMitigation(false);
```

- [ ] **Step 5: 保存に反映**

`src/components/EventForm.tsx` の `handleSubmit` の `onSave({ ... target })`([EventForm.tsx:586-592](../../../src/components/EventForm.tsx#L586))を以下に変更(`target` の後にカンマ+フィールド追加):
```ts
        onSave({
            name,
            time,
            damageType,
            damageAmount,
            target,
            ignoresDebuffMitigation,
        });
```

- [ ] **Step 6: 逆算useEffectの依存に追加**

`src/components/EventForm.tsx` の自動再計算 useEffect の依存配列([EventForm.tsx:484](../../../src/components/EventForm.tsx#L484))に `ignoresDebuffMitigation` を追加:
```ts
    }, [calcActualDamage, selectedMitigations, mitigationTargets, damageType, inputMode, target, ignoresDebuffMitigation]);
```

- [ ] **Step 7: チェックボックスUIを追加**

`src/components/EventForm.tsx` の「Type & Target Row」グリッドを閉じる `</div>`(Damage Type と Target の親、[EventForm.tsx:679](../../../src/components/EventForm.tsx#L679)付近の行末 `</div>`)の直後に追加:
```tsx
            {/* デバフ軽減不可(外周攻撃など) */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                    type="checkbox"
                    data-testid="ignores-debuff-mit"
                    checked={ignoresDebuffMitigation}
                    onChange={(e) => setIgnoresDebuffMitigation(e.target.checked)}
                    className="w-4 h-4 accent-red-500 cursor-pointer"
                />
                <span className="text-app-base text-app-text">{t('modal.ignores_debuff_mitigation')}</span>
                <span className="text-app-sm text-app-text-muted">{t('modal.ignores_debuff_mitigation_desc')}</span>
            </label>
```
※挿入位置は「Type & Target Row」を内包する `<div className="grid grid-cols-2 ...">` の閉じ `</div>` の直後(= 種別/対象の行の下)。

- [ ] **Step 8: Task 3 Step 4(プレビュー計算スキップ)が未適用なら今適用する**

`ignoresDebuffMitigation` state がこれで存在するので、Task 3 Step 4 のスキップ行([EventForm.tsx:413](../../../src/components/EventForm.tsx#L413) 直前)を未挿入なら挿入する。

- [ ] **Step 9: テスト実行(緑確認)**

Run: `npx vitest run src/components/__tests__/EventForm.damage.test.tsx`
Expected: PASS(既存1 + 新規2)

- [ ] **Step 10: ビルド確認**

Run: `npm run build`
Expected: EXIT=0

- [ ] **Step 11: コミット**

```bash
git add src/components/EventForm.tsx src/components/__tests__/EventForm.damage.test.tsx
git commit -m "feat(timeline): イベント編集モーダルにデバフ軽減不可チェックボックス追加"
```

---

## Task 8: i18n キー追加(4言語)

**Files:**
- Modify: `src/locales/ja.json`, `src/locales/en.json`, `src/locales/ko.json`, `src/locales/zh.json`

- [ ] **Step 1: `modal` ブロックにキー追加(全4言語)**

各 `src/locales/*.json` の `modal` ブロック、`"unavoidable"` の行([ja.json:340](../../../src/locales/ja.json#L340) 等)の直後に2キー追加:

ja.json:
```json
        "ignores_debuff_mitigation": "デバフ軽減不可",
        "ignores_debuff_mitigation_desc": "リプライザル等のデバフ系軽減が効かない攻撃",
```
en.json:
```json
        "ignores_debuff_mitigation": "Ignores debuff mitigation",
        "ignores_debuff_mitigation_desc": "Attack unaffected by debuff mitigations (Reprisal, etc.)",
```
ko.json(暫定=ja 相当の意訳。後で校正):
```json
        "ignores_debuff_mitigation": "디버프 경감 불가",
        "ignores_debuff_mitigation_desc": "리프라이절 등 디버프 경감이 통하지 않는 공격",
```
zh.json(暫定=ja 相当の意訳。後で校正):
```json
        "ignores_debuff_mitigation": "无视减益减伤",
        "ignores_debuff_mitigation_desc": "雪仇等减益类减伤无效的攻击",
```

- [ ] **Step 2: `timeline` ブロックにキー追加(全4言語)**

各 `src/locales/*.json` の `timeline` ブロック、`"toggle_target_hint"` の行([ja.json:498](../../../src/locales/ja.json#L498) 等)の直後に2キー追加:

ja.json:
```json
        "toggle_type_hint": "クリックでタイプ切替(物理→魔法→ユニーク)",
        "debuff_immune_hint": "デバフ軽減無効",
```
en.json:
```json
        "toggle_type_hint": "Click to change type (Physical → Magical → Unique)",
        "debuff_immune_hint": "Debuff mitigation has no effect",
```
ko.json:
```json
        "toggle_type_hint": "클릭하여 타입 전환 (물리→마법→특수)",
        "debuff_immune_hint": "디버프 경감 무효",
```
zh.json:
```json
        "toggle_type_hint": "点击切换类型(物理→魔法→特殊)",
        "debuff_immune_hint": "减益减伤无效",
```

- [ ] **Step 3: JSON 妥当性 + ビルド確認**

Run: `npm run build`
Expected: EXIT=0(JSON 構文エラーがあればここで失敗。末尾カンマ等に注意)

- [ ] **Step 4: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "i18n(timeline): デバフ軽減不可 / 種別トグルの文言を4言語追加(ko/zh暫定)"
```

---

## Task 9: Firestore 同期 + 全体検証 + 横断確認

**Files:** (コード変更なし。検証と同期)

- [ ] **Step 1: スキルデータを Firestore へ同期**

mockData の `appliesAsDebuff` を本番反映するため seed を流す(memory `feedback_skill_firestore_sync`)。
Run: `npx tsx scripts/seed-skills-stats.ts`
Expected: 同期成功ログ。エラー時は seed スクリプトの引数/認証を確認(`docs/ADMIN_SETUP.md`)。
※本番反映タイミングはユーザー判断。ローカル確認だけなら mockData フォールバックで動く。

- [ ] **Step 2: 軽減後ダメージ再計算箇所の横断確認**

Run: `grep -rnE "valueMagical|valuePhysical|mitigationMult|1 - .*value" src/components src/utils`
確認: Timeline.tsx と EventForm.tsx 以外に「%軽減を自前計算してダメージを出す」箇所(例 `src/components/CheatSheetView.tsx`)があれば、同じ `isMitigationBlockedByEvent` スキップが必要か判断。
- 不要(表示専用 or damages を props で受けるだけ)なら対応不要。
- 必要なら別コミットで `isMitigationBlockedByEvent` を配線。

- [ ] **Step 3: 全テスト + ビルド(push前必須)**

Run: `npx vitest run`
Expected: 既知5失敗のみ(`TopBar.test.tsx` 4 + `HousingWorkspace.test.tsx` 1)、新規退行なし
Run: `npm run build`
Expected: EXIT=0

- [ ] **Step 4: 実機確認(ユーザーと1つずつ)**

dev or 本番(デプロイ後)で:
1. 種別アイコンをPCクリック → 物理→魔法→ユニークで循環し即反映
2. モーダルで「デバフ軽減不可」ON → タイムラインの種別アイコンが赤箱で囲まれる(PC/モバイル)
3. その攻撃にリプライザル等を置いても ▼% が増えない/ダメージが減らない。タンクバフ・バリア・無敵は従来どおり効く
4. 赤の濃さ・余白を実機で微調整([DamageTypeIcon.tsx](../../../src/components/DamageTypeIcon.tsx) の `bg-red-500/10 ring-red-500/40 p-px`)
5. **collab 2ブラウザ**: 一方でフラグON/種別変更 → もう一方に伝播(公開直後ブランチのため必須)

- [ ] **Step 5: TODO.md 更新 + 完了記録**

`docs/TODO.md` の「現在の状態」に本機能の完了を追記。push/deploy は本ブランチ方針に従い直近のコピーUIとまとめて1回。

- [ ] **Step 6: 最終コミット(必要なら)**

```bash
git add docs/TODO.md
git commit -m "docs(todo): タイムライン種別クリックループ+デバフ軽減不可 実装完了を記録"
```

---

## 自己レビュー結果(計画著者による)

- **spec カバレッジ**: §4 型→Task1 / §4.1 データ+同期→Task1,9 / §5.1 本体計算→Task3 / §5.2 プレビュー→Task3,7 / §5.3 横断→Task9 / §6.1 種別ループ→Task2,5 / §6.2 モーダル編集→Task7 / §6.3 赤箱印→Task4 / §6.4 i18n→Task8 / §7 collab→Task9 検証 / §8 テスト→各Task。漏れなし。
- **placeholder**: 各ステップに実コードあり。ko/zh は「暫定訳・後で校正」と明示(プレースホルダーでなく動作する実値)。
- **型整合**: `isMitigationBlockedByEvent` / `nextDamageType`(Task2) を Task3,5 で同名参照。`DamageTypeIcon` props(damageType/ignoresDebuffMitigation/size/className)を Task4 定義・Task5,6 で同一使用。`ignoresDebuffMitigation` フィールド名を型/state/保存/同期で統一。
- **順序依存**: Task3 Step4(プレビュースキップ)は `ignoresDebuffMitigation` state(Task7)に依存 → Task3内とTask7 Step8の両方に明記し、どちらの順でも成立するようにした。
