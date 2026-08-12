# モバイル軽減表: スクロール中エフェクト棒表示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** モバイル軽減表で、スクロール中だけ軽減アイコン専用行を隠し、PC版と同じ「アイコン+下に伸びる色の棒」を代わりに表示する。スクロールが止まったら元のアイコン表示に戻す。

**Architecture:** 軽減の開始時刻・持続時間から棒のジオメトリ(Y座標・高さ・横位置スロット)を導出する純粋関数を新規ユーティリティに切り出し、それを描画する新規プレゼンテーショナルコンポーネントを作る。`Timeline.tsx` はこの2つを配線するだけ(スクロールコンテナへの`data-mobile-scrolling`属性の付け外し + ジオメトリ計算結果を新コンポーネントに渡す)。既存の`MobileTimelineRow.tsx`のアイコン専用行はCSSクラス1つ追加のみで、レイアウト・ロジックは変更しない。

**Tech Stack:** React + TypeScript, Tailwind CSS(クラス直書き), vitest(単体テスト), 既存の`useMitigationStore`(zustand)。

## Global Constraints

- 設計書: `docs/superpowers/specs/2026-08-12-mobile-timeline-effect-bar-toggle-design.md`(以下「設計書」)の内容が正。本計画は設計書の3.2〜3.6節をそのままコード化する。
- アイコンサイズ: 15px(既存`MitiIcons`の22pxの2/3、設計書3.3)。
- 棒の太さ: 4px(アイコンサイズに依存しない固定値、設計書3.3)。
- 優先順位: `PARTY_MEMBER_IDS`順(`src/constants/party.ts`)= MT→ST→H1→H2→D1→D2→D3→D4。
- 除外ルール: `mitigation.duration <= 1` または `def.copiesShield` が真の軽減は棒を出さない(設計書3.6、PC版[Timeline.tsx:576](../../../src/components/Timeline.tsx#L576)と同じ条件)。
- 色: 既存の`getMitigationColorClasses(jobId, ownerId, 'role')`(`Timeline.tsx:120`)をそのまま使う。モバイルは常に`'role'`固定(`light_party`分岐は使わない。既存`MitiIcons`が並び順でPCの`partySortOrder`設定を無視しているのと同じ理由で統一)。
- PC版(`isMobileTimeline === false`のパス)・PC版のエフェクト棒描画・列詰めロジックには一切手を入れない。
- モバイル専用行(`MitiIcons`)のレイアウト・アイコンサイズ・余白は変更しない(クラス名を1つ追加するだけ)。
- 軽減の配置数・追加パネルの動作には一切影響しない(表示上のみの制限)。

---

## File Structure

- **Create** `src/utils/mobileEffectBar.ts` — 棒のジオメトリ計算(Y座標・高さ・横位置スロット割り当て・優先順位ドロップ)を行う純粋関数群。DOM非依存、単体テスト可能。
- **Create** `src/utils/__tests__/mobileEffectBar.test.ts` — 上記の単体テスト。
- **Create** `src/components/MobileEffectBarLayer.tsx` — 計算済みジオメトリを受け取って絶対配置で描画するだけのプレゼンテーショナルコンポーネント。
- **Modify** `src/components/Timeline.tsx` — ①スクロール検知で`data-mobile-scrolling`属性を付け外す新規`useCallback`+`useEffect`(`syncMobilePhaseLabel`と同じパターン)。②行ループ内(既存の[Timeline.tsx:3570](../../../src/components/Timeline.tsx#L3570)直後)で`computeMobileEffectBars`を呼び、`MobileEffectBarLayer`を描画。③`sheetWidth`から`maxConcurrent`を算出。
- **Modify** `src/components/MobileTimelineRow.tsx` — `MitiIcons`のルートdivに`mobile-miti-icons`クラスを追加するだけ(1行)。
- **Modify** `src/index.css` — `[data-mobile-scrolling="1"]`によるopacityクロスフェードのCSSを追加。

---

### Task 1: 棒のジオメトリ計算ユーティリティ

**Files:**
- Create: `src/utils/mobileEffectBar.ts`
- Test: `src/utils/__tests__/mobileEffectBar.test.ts`

**Interfaces:**
- Produces: `computeMobileEffectBars(args: ComputeMobileEffectBarsArgs): MobileEffectBarItem[]`、`MobileEffectBarItem { id: string; ownerId: string; iconUrl: string; top: number; height: number; slotIndex: number; colors: MobileEffectBarColors }`、`MobileEffectBarColors { bg: string; border: string; shadow: string }`、定数 `MOBILE_EFFECT_BAR_ICON_SIZE = 15`、`MOBILE_EFFECT_BAR_WIDTH = 4`、`MOBILE_EFFECT_BAR_SLOT_PITCH = 17`、`MOBILE_EFFECT_BAR_ROW_INSET = 12`、`MOBILE_EFFECT_BAR_SCROLL_IDLE_MS = 150`。Task 2・Task 4がこれらをすべて`../utils/mobileEffectBar`からimportする。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/mobileEffectBar.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, Mitigation } from '../../types';
import { computeMobileEffectBars, type MobileEffectBarColors } from '../mobileEffectBar';

const makeDef = (id: string, overrides: Partial<Mitigation> = {}): Mitigation => ({
  id, jobId: 'war', name: { ja: id, en: id }, icon: `/icons/${id}.png`,
  recast: 60, duration: 10, type: 'all', value: 10,
  ...overrides,
});

const makeMit = (id: string, mitigationId: string, ownerId: string, time: number, duration: number): AppliedMitigation => ({
  id, mitigationId, ownerId, time, duration,
});

const DUMMY_COLORS: MobileEffectBarColors = { bg: 'bg-blue-500/80', border: 'border-blue-400/30', shadow: 'shadow-x' };
const getColorClasses = () => DUMMY_COLORS;

const baseArgs = {
  timeToYMap: new Map<number, number>(),
  pixelsPerSecond: 60,
  offsetTime: 0,
  hideEmptyRows: false,
  maxTime: 9999,
  eventsByTime: new Map<number, unknown[]>(),
  mitStartsByTime: new Map<number, boolean>(),
  showPreStart: true,
  maxConcurrent: 8,
  getColorClasses,
};

describe('computeMobileEffectBars', () => {
  it('places a single mitigation with top/height derived from time and duration', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mit = makeMit('p1', 'reprisal', 'MT', 5, 10);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].ownerId).toBe('MT');
    expect(result[0].slotIndex).toBe(0);
    // top = (5 - 0) * 60 = 300
    expect(result[0].top).toBe(300);
    // effectiveEndTime = 5 + 10 - 1 = 14, endY = (14-0)*60 + 24 = 864, height = 864 - 300 = 564
    expect(result[0].height).toBe(564);
  });

  it('excludes mitigations with duration <= 1', () => {
    const def = makeDef('swiftcast', { duration: 1 });
    const mit = makeMit('p1', 'swiftcast', 'MT', 5, 1);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(0);
  });

  it('excludes mitigations whose def has copiesShield set', () => {
    const def = makeDef('deployment_tactics', { duration: 10, copiesShield: 'adloquium' });
    const mit = makeMit('p1', 'deployment_tactics', 'MT', 5, 10);
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(0);
  });

  it('reuses the same slot for non-overlapping mitigations from the same owner', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mit1 = makeMit('p1', 'reprisal', 'MT', 0, 10); // covers [0,10)
    const mit2 = makeMit('p2', 'reprisal', 'MT', 20, 10); // covers [20,30), starts after p1 ends
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit1, mit2],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(2);
    expect(result.find(r => r.id === 'p1')!.slotIndex).toBe(0);
    expect(result.find(r => r.id === 'p2')!.slotIndex).toBe(0);
  });

  it('assigns different slots to overlapping mitigations from different owners', () => {
    const def = makeDef('reprisal', { duration: 10 });
    const mtMit = makeMit('p1', 'reprisal', 'MT', 0, 10); // covers [0,10)
    const stMit = makeMit('p2', 'reprisal', 'ST', 5, 10); // covers [5,15), overlaps p1
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mtMit, stMit],
      mitigationDefs: [def],
    });
    expect(result).toHaveLength(2);
    const mtSlot = result.find(r => r.id === 'p1')!.slotIndex;
    const stSlot = result.find(r => r.id === 'p2')!.slotIndex;
    expect(mtSlot).not.toBe(stSlot);
  });

  it('drops lower-priority (later PARTY_MEMBER_IDS) mitigations first when maxConcurrent is exceeded', () => {
    const def = makeDef('reprisal', { duration: 100 });
    // 4人が同時刻(time=0)から同じ長さ重ねる。MT/ST/H1が優先、D1は4番目=はみ出し候補。
    const mits = [
      makeMit('mt', 'reprisal', 'MT', 0, 100),
      makeMit('st', 'reprisal', 'ST', 0, 100),
      makeMit('h1', 'reprisal', 'H1', 0, 100),
      makeMit('d1', 'reprisal', 'D1', 0, 100),
    ];
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: mits,
      mitigationDefs: [def],
      maxConcurrent: 3,
    });
    const ids = result.map(r => r.id).sort();
    expect(ids).toEqual(['h1', 'mt', 'st']);
  });

  it('clips effectiveEndTime to the nearest visible row when hideEmptyRows is on', () => {
    const def = makeDef('reprisal', { duration: 20 });
    const mit = makeMit('p1', 'reprisal', 'MT', 0, 20); // covers [0,20), durationEndTime = 19
    const eventsByTime = new Map<number, unknown[]>([[0, [{}]], [8, [{}]]]);
    const mitStartsByTime = new Map<number, boolean>([[0, true]]);
    const result = computeMobileEffectBars({
      ...baseArgs,
      hideEmptyRows: true,
      eventsByTime,
      mitStartsByTime,
      timelineMitigations: [mit],
      mitigationDefs: [def],
    });
    // durationEndTime=19 は可視行でないため、8(直前の可視行)に切り詰め。
    // endY = (8-0)*60 + 24 = 504, top = 0, height = 504
    expect(result[0].height).toBe(504);
  });

  it('passes the mitigation def jobId and owner id to getColorClasses', () => {
    const def = makeDef('reprisal', { jobId: 'pld' });
    const mit = makeMit('p1', 'reprisal', 'MT', 0, 10);
    const seen: { jobId: string | undefined; ownerId: string }[] = [];
    const result = computeMobileEffectBars({
      ...baseArgs,
      timelineMitigations: [mit],
      mitigationDefs: [def],
      getColorClasses: (jobId, ownerId) => {
        seen.push({ jobId, ownerId });
        return DUMMY_COLORS;
      },
    });
    expect(seen).toEqual([{ jobId: 'pld', ownerId: 'MT' }]);
    expect(result[0].colors).toBe(DUMMY_COLORS);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `npx vitest run src/utils/__tests__/mobileEffectBar.test.ts`
Expected: FAIL(`../mobileEffectBar` が存在しない)

- [ ] **Step 3: 実装を書く**

`src/utils/mobileEffectBar.ts` を新規作成:

```ts
import type { AppliedMitigation, Mitigation } from '../types';
import { PARTY_MEMBER_IDS } from '../constants/party';

export const MOBILE_EFFECT_BAR_ICON_SIZE = 15;
export const MOBILE_EFFECT_BAR_WIDTH = 4;
export const MOBILE_EFFECT_BAR_SLOT_PITCH = 17;
export const MOBILE_EFFECT_BAR_ROW_INSET = 12;
export const MOBILE_EFFECT_BAR_SCROLL_IDLE_MS = 150;

/** PC版のエフェクト棒(MitigationItem)がアイコン分の高さとして加算しているのと同じ値。[Timeline.tsx:3503] */
const ICON_BOTTOM_PADDING = 24;

export interface MobileEffectBarColors {
  bg: string;
  border: string;
  shadow: string;
}

export interface MobileEffectBarItem {
  id: string;
  ownerId: string;
  iconUrl: string;
  top: number;
  height: number;
  slotIndex: number;
  colors: MobileEffectBarColors;
}

export interface ComputeMobileEffectBarsArgs {
  timelineMitigations: AppliedMitigation[];
  mitigationDefs: Mitigation[];
  timeToYMap: Map<number, number>;
  pixelsPerSecond: number;
  offsetTime: number;
  hideEmptyRows: boolean;
  maxTime: number;
  eventsByTime: Map<number, unknown[]>;
  mitStartsByTime: Map<number, boolean>;
  showPreStart: boolean;
  /** 横に並べられる最大同時本数(画面幅から算出、呼び出し側が渡す) */
  maxConcurrent: number;
  getColorClasses: (jobId: string | undefined, ownerId: string) => MobileEffectBarColors;
}

const priorityOf = (ownerId: string): number => {
  const idx = (PARTY_MEMBER_IDS as readonly string[]).indexOf(ownerId);
  return idx === -1 ? PARTY_MEMBER_IDS.length : idx;
};

export function computeMobileEffectBars(args: ComputeMobileEffectBarsArgs): MobileEffectBarItem[] {
  const {
    timelineMitigations, mitigationDefs, timeToYMap, pixelsPerSecond, offsetTime,
    hideEmptyRows, maxTime, eventsByTime, mitStartsByTime, showPreStart,
    maxConcurrent, getColorClasses,
  } = args;

  const defById = new Map(mitigationDefs.map(d => [d.id, d]));

  const getMappedY = (t: number): number => {
    if (timeToYMap.has(t)) return timeToYMap.get(t)!;
    const gridKeys = Array.from(timeToYMap.keys());
    const maxGridTime = gridKeys.length > 0 ? Math.max(...gridKeys) : 0;
    const maxGridY = timeToYMap.get(maxGridTime) ?? 0;
    if (t > maxGridTime) return maxGridY + (t - maxGridTime) * pixelsPerSecond;
    return Math.max(0, t - offsetTime) * pixelsPerSecond;
  };

  const candidates = timelineMitigations.filter(m => {
    if (!(showPreStart || (m.time + m.duration > 0))) return false;
    if (hideEmptyRows && m.autoHidden) return false;
    const def = defById.get(m.mitigationId);
    if (!def) return false;
    if (m.duration <= 1) return false;
    if (def.copiesShield) return false;
    return true;
  });

  // 優先順位(PARTY_MEMBER_IDS順)→ 開始時刻の順に処理する。
  // 同じ優先順位内では早く始まったものから枠を確保する。
  const sorted = [...candidates].sort((a, b) => {
    const pa = priorityOf(a.ownerId);
    const pb = priorityOf(b.ownerId);
    if (pa !== pb) return pa - pb;
    return a.time - b.time;
  });

  // slotFreeAt[i] = スロットiが「何秒時点から」空くか。
  // 割り当ては必ず freeAt <= 新規アイテムの開始時刻 のときだけ許可するため、
  // 処理順によらず同一スロット内での時間重複は起きない(詳細は設計書3.3)。
  const slotFreeAt: number[] = [];
  const results: MobileEffectBarItem[] = [];

  for (const mit of sorted) {
    const def = defById.get(mit.mitigationId)!;
    const durationEndTime = mit.time + mit.duration - 1;

    let effectiveEndTime = durationEndTime;
    if (hideEmptyRows) {
      const isEndVisible = eventsByTime.has(durationEndTime) || mitStartsByTime.has(durationEndTime);
      if (!isEndVisible) {
        let prevVisible = mit.time;
        for (let t = durationEndTime; t >= mit.time; t--) {
          if (eventsByTime.has(t) || mitStartsByTime.has(t)) { prevVisible = t; break; }
        }
        effectiveEndTime = prevVisible;
      }
    }
    effectiveEndTime = Math.min(effectiveEndTime, maxTime);

    let slotIndex = slotFreeAt.findIndex(freeAt => freeAt <= mit.time);
    if (slotIndex === -1) {
      if (slotFreeAt.length >= maxConcurrent) continue; // 入りきらない → この軽減は棒を出さない
      slotIndex = slotFreeAt.length;
      slotFreeAt.push(0);
    }
    slotFreeAt[slotIndex] = mit.time + mit.duration;

    const startY = getMappedY(mit.time);
    const endY = getMappedY(effectiveEndTime) + ICON_BOTTOM_PADDING;
    const height = Math.max(0, Math.round(endY - startY));

    results.push({
      id: mit.id,
      ownerId: mit.ownerId,
      iconUrl: def.icon,
      top: Math.round(startY),
      height,
      slotIndex,
      colors: getColorClasses(def.jobId, mit.ownerId),
    });
  }

  return results;
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `npx vitest run src/utils/__tests__/mobileEffectBar.test.ts`
Expected: PASS(全8件)

- [ ] **Step 5: コミット**

```bash
git add src/utils/mobileEffectBar.ts src/utils/__tests__/mobileEffectBar.test.ts
git commit -m "feat(mobile): エフェクト棒のジオメトリ計算ユーティリティを追加"
```

---

### Task 2: 描画コンポーネント

**Files:**
- Create: `src/components/MobileEffectBarLayer.tsx`

**Interfaces:**
- Consumes: `MobileEffectBarItem`、`MOBILE_EFFECT_BAR_ICON_SIZE`、`MOBILE_EFFECT_BAR_WIDTH`、`MOBILE_EFFECT_BAR_SLOT_PITCH`、`MOBILE_EFFECT_BAR_ROW_INSET`(すべて Task 1 の `../utils/mobileEffectBar` から)。
- Produces: `MobileEffectBarLayer: React.FC<{ bars: MobileEffectBarItem[] }>`。Task 4がこのコンポーネントを`<MobileEffectBarLayer bars={...} />`としてimport・使用する。

このコンポーネントはロジックを持たない(ジオメトリはTask 1の関数がすでに計算済み)ため、TDD対象外(既存の`RecastIcon.tsx`同様、プレゼンテーショナルコンポーネントは手動確認で足りる、というこのコードベースの既存方針に合わせる)。

- [ ] **Step 1: コンポーネントを書く**

`src/components/MobileEffectBarLayer.tsx` を新規作成:

```tsx
import clsx from 'clsx';
import type { MobileEffectBarItem } from '../utils/mobileEffectBar';
import {
  MOBILE_EFFECT_BAR_ICON_SIZE,
  MOBILE_EFFECT_BAR_WIDTH,
  MOBILE_EFFECT_BAR_SLOT_PITCH,
  MOBILE_EFFECT_BAR_ROW_INSET,
} from '../utils/mobileEffectBar';

interface MobileEffectBarLayerProps {
  bars: MobileEffectBarItem[];
}

/**
 * モバイル軽減表: スクロール中だけ表示するエフェクト棒のオーバーレイ層。
 * 位置・可視性の切り替えは親(Timeline.tsx)の `data-mobile-scrolling` 属性 + CSS が担当するため、
 * このコンポーネント自身は常時マウントし続ける(表示制御はopacityのみ)。
 */
export const MobileEffectBarLayer: React.FC<MobileEffectBarLayerProps> = ({ bars }) => {
  if (bars.length === 0) return null;

  return (
    <div className="mobile-effect-bar-layer absolute inset-0 pointer-events-none md:hidden" style={{ zIndex: 5 }}>
      {bars.map(bar => (
        <div
          key={bar.id}
          className={clsx(
            'absolute rounded-b-sm border-x',
            bar.colors.bg,
            bar.colors.border,
            bar.colors.shadow,
          )}
          style={{
            top: `${bar.top}px`,
            height: `${bar.height}px`,
            width: `${MOBILE_EFFECT_BAR_WIDTH}px`,
            right: `${MOBILE_EFFECT_BAR_ROW_INSET + bar.slotIndex * MOBILE_EFFECT_BAR_SLOT_PITCH}px`,
          }}
        >
          <img
            src={bar.iconUrl}
            alt=""
            className="absolute rounded object-cover"
            style={{
              width: `${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              height: `${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              top: `-${MOBILE_EFFECT_BAR_ICON_SIZE}px`,
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          />
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: 型チェックを実行する**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/MobileEffectBarLayer.tsx
git commit -m "feat(mobile): エフェクト棒オーバーレイ描画コンポーネントを追加"
```

---

### Task 3: スクロール検知(`data-mobile-scrolling`属性)とCSSクロスフェード

**Files:**
- Modify: `src/components/Timeline.tsx:1546`(`syncMobilePhaseLabel`の登録`useEffect`の直後に新規ブロックを追加)
- Modify: `src/components/MobileTimelineRow.tsx:101`
- Modify: `src/index.css`(既存の`data-record-mode`ブロック付近、`:1410`以降に新規ブロック追加)

**Interfaces:**
- Consumes: `scrollContainerRef`(`Timeline.tsx:1320`で定義済みの`React.useRef<HTMLDivElement>(null)`)、`isMobileTimeline`(`Timeline.tsx:696`で定義済み)。
- Produces: `.timeline-scroll-container`要素に付け外しされる`data-mobile-scrolling="1"`属性。CSS側でこれを見て`.mobile-miti-icons`(専用行)と`.mobile-effect-bar-layer`(Task 2の新コンポーネント)のopacityを反転させる。Task 4は`data-mobile-scrolling`そのものは参照しない(表示切替はCSSのみで完結)。

- [ ] **Step 1: `Timeline.tsx`にスクロール検知の`useCallback`+`useEffect`を追加する**

[Timeline.tsx:1546](../../../src/components/Timeline.tsx#L1546)(`}, [syncMobilePhaseLabel, isMobileTimeline]);` の直後、`useEffect(() => { syncMobilePhaseLabel(); }, ...)` ブロックの前)に以下を挿入:

```tsx
    // エフェクト棒トグル: スクロール中だけ data-mobile-scrolling="1" を立て、
    // 専用行アイコン⇄エフェクト棒の表示切り替えをCSS側に任せる(React再レンダーなし)。
    const mobileEffectBarIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const syncMobileEffectBarVisibility = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        container.setAttribute('data-mobile-scrolling', '1');
        if (mobileEffectBarIdleTimerRef.current) clearTimeout(mobileEffectBarIdleTimerRef.current);
        mobileEffectBarIdleTimerRef.current = setTimeout(() => {
            container.removeAttribute('data-mobile-scrolling');
        }, MOBILE_EFFECT_BAR_SCROLL_IDLE_MS);
    }, []);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || !isMobileTimeline) return;
        container.addEventListener('scroll', syncMobileEffectBarVisibility, { passive: true });
        return () => {
            container.removeEventListener('scroll', syncMobileEffectBarVisibility);
            if (mobileEffectBarIdleTimerRef.current) clearTimeout(mobileEffectBarIdleTimerRef.current);
        };
    }, [syncMobileEffectBarVisibility, isMobileTimeline]);
```

`Timeline.tsx`先頭のimport群に`MOBILE_EFFECT_BAR_SCROLL_IDLE_MS`を追加:

```tsx
import { MOBILE_EFFECT_BAR_SCROLL_IDLE_MS } from '../utils/mobileEffectBar';
```

(既存の他importと同じ並びに追加。具体的な行は既存のimportブロック内、他の`../utils/*`importの近くでよい。)

- [ ] **Step 2: `MobileTimelineRow.tsx`の専用行に検知用クラスを追加する**

[MobileTimelineRow.tsx:101](../../../src/components/MobileTimelineRow.tsx#L101) を変更:

変更前:
```tsx
        <div className="flex items-center gap-1.5 flex-wrap">
```

変更後:
```tsx
        <div className="mobile-miti-icons flex items-center gap-1.5 flex-wrap transition-opacity duration-150">
```

- [ ] **Step 3: `index.css`にクロスフェードのCSSを追加する**

[index.css:1410](../../../src/index.css#L1410)付近(既存の`data-record-mode`ブロックの直後)に追加:

```css
/* ===== モバイル: スクロール中だけエフェクト棒に切り替える ===== */
/* 静止時: 専用行アイコンを表示、エフェクト棒は透明。
   スクロール中(data-mobile-scrolling="1"): 逆。両方とも同じdurationでクロスフェードする。 */
.timeline-scroll-container .mobile-effect-bar-layer {
  opacity: 0;
  transition: opacity 150ms ease;
}
.timeline-scroll-container[data-mobile-scrolling="1"] .mobile-effect-bar-layer {
  opacity: 1;
}
.timeline-scroll-container[data-mobile-scrolling="1"] .mobile-miti-icons {
  opacity: 0;
}
```

- [ ] **Step 4: 型チェックを実行する**

Run: `npx tsc -b --noEmit`
Expected: エラーなし(この時点では`MobileEffectBarLayer`はまだ`Timeline.tsx`に配線されていないため、実機での見た目確認はTask 4完了後)

- [ ] **Step 5: コミット**

```bash
git add src/components/Timeline.tsx src/components/MobileTimelineRow.tsx src/index.css
git commit -m "feat(mobile): スクロール検知とエフェクト棒表示切替のCSSを追加"
```

---

### Task 4: `Timeline.tsx`への配線(ジオメトリ計算 + 描画)

**Files:**
- Modify: `src/components/Timeline.tsx:3570`(行ループIIFE内、PC版エフェクト棒ブロックの直後)

**Interfaces:**
- Consumes: Task 1の`computeMobileEffectBars`/`MOBILE_EFFECT_BAR_SLOT_PITCH`/`MOBILE_EFFECT_BAR_ROW_INSET`、Task 2の`MobileEffectBarLayer`。`Timeline.tsx`内ですでに存在する`timeToYMap`・`mitStartsByTime`・`eventsByTime`・`maxTime`・`hideEmptyRows`・`pixelsPerSecond`・`showPreStart`・`timelineMitigations`・`MITIGATIONS`・`sheetWidth`・`isMobileTimeline`(いずれも既存、新規追加なし)。

- [ ] **Step 1: `sheetWidth`から`maxConcurrent`を算出し、ジオメトリ計算+描画をJSXに追加する**

[Timeline.tsx:3570](../../../src/components/Timeline.tsx#L3570)(`})()}`= PC版エフェクト棒ブロックの終わり)の直後、`</>`(3571行目)の前に挿入:

```tsx
                                        {isMobileTimeline && (() => {
                                            // このFragment内の他の兄弟ブロック(フェーズ/ラベルオーバーレイ)と同じく、
                                            // 各IIFEは自分のスコープなので offsetTime をローカルで再計算する。
                                            const offsetTime = showPreStart ? -10 : 0;
                                            // 画面幅から横に並べられる最大同時本数を算出。
                                            // sheetWidth 未計測時(初回フレーム)はモバイル最小幅を仮定した安全値にフォールバック。
                                            const availableWidth = sheetWidth > 0 ? sheetWidth : 350;
                                            const maxConcurrent = Math.max(
                                                1,
                                                Math.floor((availableWidth - MOBILE_EFFECT_BAR_ROW_INSET * 2) / MOBILE_EFFECT_BAR_SLOT_PITCH)
                                            );
                                            const mobileBars = computeMobileEffectBars({
                                                timelineMitigations,
                                                mitigationDefs: MITIGATIONS,
                                                timeToYMap,
                                                pixelsPerSecond,
                                                offsetTime,
                                                hideEmptyRows,
                                                maxTime,
                                                eventsByTime,
                                                mitStartsByTime,
                                                showPreStart,
                                                maxConcurrent,
                                                getColorClasses: (jobId, ownerId) => getMitigationColorClasses(jobId, ownerId, 'role'),
                                            });
                                            return <MobileEffectBarLayer bars={mobileBars} />;
                                        })()}
```

`Timeline.tsx`先頭のimport群に以下を追加(既存の他コンポーネント/utils importと同じ並びでよい):

```tsx
import { MobileEffectBarLayer } from './MobileEffectBarLayer';
import {
    computeMobileEffectBars,
    MOBILE_EFFECT_BAR_ROW_INSET,
    MOBILE_EFFECT_BAR_SLOT_PITCH,
} from '../utils/mobileEffectBar';
```

(`MOBILE_EFFECT_BAR_SCROLL_IDLE_MS`はTask 3で既に追加済みなので、実際には1つの`import { ... } from '../utils/mobileEffectBar';`にまとめてよい。)

- [ ] **Step 2: 型チェックを実行する**

Run: `npx tsc -b --noEmit`
Expected: エラーなし

- [ ] **Step 3: 変更ファイルに絞ってvitestを実行する**

Run: `npx vitest run src/components/__tests__/Timeline.layout.test.tsx src/components/__tests__/Timeline.readonly.test.tsx src/components/__tests__/Timeline.contentId.test.tsx src/utils/__tests__/mobileEffectBar.test.ts`
Expected: 既存テストを含め全件PASS(回帰なし)

- [ ] **Step 4: コミット**

```bash
git add src/components/Timeline.tsx
git commit -m "feat(mobile): エフェクト棒オーバーレイをTimelineに配線"
```

---

### Task 5: 実機確認とビルド検証

**Files:** なし(検証のみ)

- [ ] **Step 1: ビルドを通す**

Run: `npm run build`
Expected: 成功(exit code 0)。`erasableSyntaxOnly`等の既存制約に抵触しないか確認([[reference_erasable_syntax_test_mocks]]は今回テストにclassモックを使っていないため対象外のはず)。

- [ ] **Step 2: 開発サーバーを起動し、実機(iPhone)で確認する**

Run: `npm run dev -- --host`(既に起動中なら再利用)。表示されたLAN URLをiPhoneで開く。

確認項目(すべて目視、ユーザー確認):
1. 静止時: 今まで通り軽減アイコン専用行が見える。
2. スクロールし始めた瞬間: アイコンがふわっと消え、エフェクト棒(アイコン+下に伸びる色の棒)が現れる。棒はメンバー優先順位順に右詰めで並ぶ。
3. スクロールを止めると: 棒が消えて、専用行アイコン表示に戻る。
4. `hideEmptyRows`(表の展開/圧縮)トグルをON/OFF両方試し、棒の縦位置がPC版と矛盾しない(効果の開始位置から伸びている)ことを確認。
5. 軽減が同時に多数重なる場面(意図的に密集させて配置)で、画面幅からはみ出さず、優先順位の低い(DPS)ものから表示が省かれることを確認。
6. PC版(ブラウザ幅を広げる、またはPCで直接確認)でエフェクト棒・列詰めの見た目に変化がないことを確認(回帰なし)。

- [ ] **Step 3: 実機確認の結果をユーザーに報告し、必要な微調整(色・太さ・デバウンス時間等)があれば反映する**

このステップは対話的。Task 1〜4のコード変更後、ユーザーが実機で見てフィードバックした内容に応じて、`MOBILE_EFFECT_BAR_*`定数(`src/utils/mobileEffectBar.ts`)やCSSのdurationを調整する。

---

## Self-Review

**1. 仕様網羅性:**
- 設計書3.2(縦位置計算)→ Task 1の`getMappedY`/`effectiveEndTime`ロジックで実装。✅
- 設計書3.3(詰めて並べる・優先順位ドロップ)→ Task 1の`slotFreeAt`割り当て+`maxConcurrent`ドロップで実装。✅
- 設計書3.4(配置数に影響なし)→ 新規ロジックは表示専用の`computeMobileEffectBars`のみに閉じており、`timelineMitigations`ストア自体には触れない。追加パネル・配置ロジックは変更対象ファイルに含まれない。✅
- 設計書3.5(スクロール検知・表示切替)→ Task 3で実装。✅
- 設計書3.6(色・除外ルール)→ Task 1の`getColorClasses`呼び出し+`duration<=1`/`copiesShield`フィルタで実装。✅
- 設計書2(体験全体: 静止時は変更なし/スクロール中だけ切り替え/1行目は変更なし)→ Task 3のCSSクロスフェードが専用行(2行目相当)のみを対象にし、1行目のJSXには一切触れていないことを確認済み。✅

**2. プレースホルダー確認:** 各タスクのコードブロックはすべて実際に書ける内容(TBD/TODO等の記載なし)。目視確認項目(Task 5)は「実機で見る」性質上具体的な数値アサーションを書けないが、これは既存の`feedback_no_screenshots_local_verify`(スクショではなくユーザー実機確認)方針に沿った意図的なもの。

**3. 型・シグネチャ一貫性:** `computeMobileEffectBars`の引数名(`timelineMitigations`/`mitigationDefs`/`timeToYMap`/`pixelsPerSecond`/`offsetTime`/`hideEmptyRows`/`maxTime`/`eventsByTime`/`mitStartsByTime`/`showPreStart`/`maxConcurrent`/`getColorClasses`)は、Task 1のテスト・実装・Task 4の呼び出し箇所すべてで一致していることを確認済み。`MobileEffectBarItem`のフィールド名(`id`/`ownerId`/`iconUrl`/`top`/`height`/`slotIndex`/`colors`)もTask 1・Task 2で一致。

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-12-mobile-effect-bar-toggle.md`. Two execution options:**

**1. Subagent-Driven(推奨)** — タスクごとに新しいサブエージェントを立て、間でレビューしながら進める

**2. Inline Execution** — このセッション内でタスクをバッチ実行し、チェックポイントでレビュー

どちらにしますか?
