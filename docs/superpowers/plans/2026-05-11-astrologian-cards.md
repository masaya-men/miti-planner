# 占星術師カード機構 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 占星術師 (AST) のドロー/カード関連スキル 7 個を軽減シミュレータに追加し、 ゲーム内仕様 (Patch 7.4) を正確に再現する。

**Architecture:**
- 親子関係: 既存 AST の `requires` 機構 + AST カード専用フィルタ (「最新ドローが対応種別か」)
- 戦闘前ドロー: `AppliedMitigation.autoHidden` フラグ新設 + t=-3 自動配置
- 自動配置: 学者 `scholarAutoInsert.ts` 方式の `astrologianAutoInsert.ts` を新設

**Tech Stack:** TypeScript + React + Zustand + Vitest + Firebase (Firestore + Storage)

**Spec:** `docs/superpowers/specs/2026-05-11-astrologian-cards-design.md`

---

## ファイル構造

### 新規作成
- `src/utils/astrologianAutoInsert.ts` — AST 自動配置ロジック (学者方式のコピー改)
- `src/utils/__tests__/astrologianAutoInsert.test.ts` — 自動配置の vitest
- `public/icons/Astral_Draw.png` ほか 6 個 — ユーザー提供 PNG を配置

### 修正
- `src/types/index.ts` — `AppliedMitigation.autoHidden?` 追加
- `src/data/mockData.ts` — 7 スキル定義 + `MITIGATION_DISPLAY_ORDER` 挿入
- `src/utils/calculator.ts` — `SKILL_DATA` に「ビエルゴの塔」 追加 (バリア値計算用)
- `src/components/Timeline.tsx` — 描画判定 4 箇所で autoHidden 除外
- `src/components/MitigationSelector.tsx` — AST 専用フィルタ (「最新ドローが対応種別か」)
- `src/utils/resourceTracker.ts` — AST 専用バリデーション (同上)
- `src/store/useMitigationStore.ts` — astrologianAutoInsert を 5 箇所配線

### 運用 (スクリプト実行)
- `npx tsx scripts/seed-icons.ts` — Firebase Storage アップロード
- `npx tsx scripts/seed-skills-stats.ts` — Firestore `/master/skills` 同期

---

## Task 1: アイコン 7 個を public/icons/ にコピー

**Files:**
- Create: `public/icons/Astral_Draw.png`
- Create: `public/icons/Umbral_Draw.png`
- Create: `public/icons/The_Arrow.png`
- Create: `public/icons/The_Spire.png`
- Create: `public/icons/The_Bole.png`
- Create: `public/icons/The_Ewer.png`
- Create: `public/icons/Lady_of_Crowns.png`

- [ ] **Step 1: ユーザー提供パスから 7 個コピー**

```bash
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/Astral_Draw.png" public/icons/Astral_Draw.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/Umbral_Draw.png" public/icons/Umbral_Draw.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/The_Arrow.png" public/icons/The_Arrow.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/The_Spire.png" public/icons/The_Spire.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/The_Bole.png" public/icons/The_Bole.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/The_Ewer.png" public/icons/The_Ewer.png
cp "C:/Users/masay/Downloads/FFXIV_icon/FFXIVIcons Battle(PvE)/20_AST/Lady_of_Crowns.png" public/icons/Lady_of_Crowns.png
```

- [ ] **Step 2: 配置確認**

```bash
ls public/icons/ | grep -E "Astral_Draw|Umbral_Draw|The_Arrow|The_Spire|The_Bole|The_Ewer|Lady_of_Crowns"
```

Expected: 7 個すべてリスト表示

- [ ] **Step 3: コミット**

```bash
rtk git add public/icons/Astral_Draw.png public/icons/Umbral_Draw.png public/icons/The_Arrow.png public/icons/The_Spire.png public/icons/The_Bole.png public/icons/The_Ewer.png public/icons/Lady_of_Crowns.png
rtk git commit -m "feat(icons): 占星術師カード関連アイコン 7 個追加"
```

---

## Task 2: AppliedMitigation.autoHidden フィールド追加

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: AppliedMitigation 型を見つける**

```bash
rtk grep "interface AppliedMitigation" src/types/index.ts -n
```

Expected: 該当行が表示される

- [ ] **Step 2: autoHidden フィールドを追加**

`AppliedMitigation` interface 内 (既存フィールド `id` / `mitigationId` / `ownerId` / `time` / `duration` 等と同列) に以下を追加:

```typescript
    autoHidden?: boolean; // 自動配置されたが、行展開トリガーにしない (戦闘前 Astral Draw 等)
```

- [ ] **Step 3: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: 既存テスト全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/types/index.ts
rtk git commit -m "feat(types): AppliedMitigation に autoHidden フラグを追加"
```

---

## Task 3: mockData.ts に 7 スキル定義を追加

**Files:**
- Modify: `src/data/mockData.ts`

- [ ] **Step 1: AST スキル群の末尾を確認**

```bash
rtk grep "id: \"celestial_intersection\"" src/data/mockData.ts -n
```

Expected: L551 周辺の AST スキル定義の最後の行が見つかる

- [ ] **Step 2: 7 スキル定義を AST 群の末尾 (`celestial_intersection` の直後) に追加**

```typescript
    {
        id: "astral_draw", jobId: "ast",
        name: { ja: "アストラルドロー", en: "Astral Draw", zh: "星极抽卡", ko: "별빛 점지" },
        icon: "/icons/Astral_Draw.png",
        recast: 55, duration: 1, type: "all", value: 0, isShield: false,
        minLevel: 30, family: "ast_draw_astral",
        note: "アストラル4枚を獲得 (Balance/Arrow/Spire/Lord)。次のドローまで保持。"
    },
    {
        id: "umbral_draw", jobId: "ast",
        name: { ja: "アンブラルドロー", en: "Umbral Draw", zh: "灵极抽卡", ko: "그림자 점지" },
        icon: "/icons/Umbral_Draw.png",
        recast: 55, duration: 1, type: "all", value: 0, isShield: false,
        minLevel: 30, family: "ast_draw_umbral",
        note: "アンブラル4枚を獲得 (Spear/Bole/Ewer/Lady)。次のドローまで保持。"
    },
    {
        id: "the_arrow", jobId: "ast",
        name: { ja: "オシュオンの矢", en: "The Arrow", zh: "放浪神之箭", ko: "오쉬온의 화살" },
        icon: "/icons/The_Arrow.png",
        recast: 1, duration: 15, type: "all", value: 0, isShield: false,
        scope: "target", healingIncrease: 10,
        requires: "astral_draw",
        note: "対象の被回復+10%",
        minLevel: 30, family: "healer_ogcd_target_buff"
    },
    {
        id: "the_spire", jobId: "ast",
        name: { ja: "ビエルゴの塔", en: "The Spire", zh: "建筑神之塔", ko: "비레고의 탑" },
        icon: "/icons/The_Spire.png",
        recast: 1, duration: 30, type: "all", value: 0, isShield: true,
        valueType: 'potency', shieldPotency: 400, scope: "target",
        requires: "astral_draw",
        note: "バリア (回復力400相当) / 30秒",
        minLevel: 30, family: "ph_target_shield"
    },
    {
        id: "the_bole", jobId: "ast",
        name: { ja: "世界樹の幹", en: "The Bole", zh: "世界树之干", ko: "세계수의 줄기" },
        icon: "/icons/The_Bole.png",
        recast: 1, duration: 15, type: "all", value: 10, isShield: false,
        scope: "target",
        requires: "umbral_draw",
        note: "対象の被ダメージ-10%",
        minLevel: 30, family: "ph_target_miti"
    },
    {
        id: "the_ewer", jobId: "ast",
        name: { ja: "サリャクの水瓶", en: "The Ewer", zh: "河流神之瓶", ko: "살리아크의 물병" },
        icon: "/icons/The_Ewer.png",
        recast: 1, duration: 15, type: "all", value: 0, isShield: false,
        scope: "target",
        requires: "umbral_draw",
        note: "対象に HoT (威力200/tick × 5)",
        minLevel: 30, family: "healer_ogcd_target_buff"
    },
    {
        id: "lady_of_crowns", jobId: "ast",
        name: { ja: "クラウンレディ", en: "Lady of Crowns", zh: "王冠之贵妇", ko: "여왕의 날개" },
        icon: "/icons/Lady_of_Crowns.png",
        recast: 1, duration: 1, type: "all", value: 0, isShield: false,
        requires: "umbral_draw",
        note: "範囲回復 (回復力400 / 即時)",
        minLevel: 30, family: "healer_ogcd_aoe_heal"
    },
```

- [ ] **Step 3: `MITIGATION_DISPLAY_ORDER` の AST 既存スキル直後に新スキル ID を挿入**

`'celestial_intersection',` の直後に以下 7 行を追加:

```typescript
    'astral_draw',
    'umbral_draw',
    'the_arrow',
    'the_spire',
    'the_bole',
    'the_ewer',
    'lady_of_crowns',
```

- [ ] **Step 4: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 5: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS

- [ ] **Step 6: コミット**

```bash
rtk git add src/data/mockData.ts
rtk git commit -m "feat(skills): 占星術師カード 7 スキル定義を mockData に追加"
```

---

## Task 4: calculator.ts SKILL_DATA にビエルゴの塔を追加 (バリア値計算)

**Files:**
- Modify: `src/utils/calculator.ts`

- [ ] **Step 1: 既存「星天交差」 (`Celestial Intersection`) の SKILL_DATA エントリを確認**

```bash
rtk grep "星天交差" src/utils/calculator.ts -n
```

Expected: L177 に既存エントリが表示される

- [ ] **Step 2: 「星天交差」 の直後に「ビエルゴの塔」 エントリを追加**

L177 の `"星天交差": { ... },` の直後の行に以下を追加:

```typescript
    "ビエルゴの塔": { "potency": 400, "type": "potency", "multiplier": 1, "jobs": ["ast"], "icon": "The_Spire.png", "nameEn": "The Spire", "minLevel": 30 },
```

- [ ] **Step 3: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/calculator.ts
rtk git commit -m "feat(calc): ビエルゴの塔のバリア値計算用 SKILL_DATA エントリ追加"
```

---

## Task 5: Timeline.tsx の描画判定 4 箇所で autoHidden 除外

**Files:**
- Modify: `src/components/Timeline.tsx`

- [ ] **Step 1: 該当箇所 4 つの位置を確認**

```bash
rtk grep "hasMitigationStart|visibleMitigations|mitStartsByTime.set" src/components/Timeline.tsx -n
```

Expected: L2234 / L2278 / L2562 / L2265 周辺に該当行が表示される

- [ ] **Step 2: L2234 修正 (高さ計算の hasMitigationStart)**

変更前:
```typescript
const hasMitigationStart = timelineMitigations.some(m => m.time === time);
```

変更後:
```typescript
const hasMitigationStart = timelineMitigations.some(m => m.time === time && !m.autoHidden);
```

- [ ] **Step 3: L2278 修正 (描画の hasMitigationStart)**

L2234 と同じ変更を L2278 でも実施。`mitStartsByTime` 経由の場合は `mitStartsByTime.has(time)` を使っているのでそちらは Step 4 で対処。

- [ ] **Step 4: L2562 修正 (visibleMitigations フィルタ)**

変更前:
```typescript
const visibleMitigations = timelineMitigations.filter(m =>
    showPreStart || (m.time + m.duration > 0)
);
```

変更後:
```typescript
const visibleMitigations = timelineMitigations.filter(m =>
    (showPreStart || (m.time + m.duration > 0)) && !m.autoHidden
);
```

- [ ] **Step 5: L2264-2270 修正 (mitigationsByTime / mitStartsByTime 構築)**

変更前:
```typescript
timelineMitigations.forEach(mit => {
    mitStartsByTime.set(mit.time, true);
    for (let t = mit.time; t < mit.time + mit.duration; t++) {
        if (!mitigationsByTime.has(t)) mitigationsByTime.set(t, []);
        mitigationsByTime.get(t)!.push(mit);
    }
});
```

変更後:
```typescript
timelineMitigations.forEach(mit => {
    if (!mit.autoHidden) {
        mitStartsByTime.set(mit.time, true);
    }
    for (let t = mit.time; t < mit.time + mit.duration; t++) {
        if (!mitigationsByTime.has(t)) mitigationsByTime.set(t, []);
        if (!mit.autoHidden) {
            mitigationsByTime.get(t)!.push(mit);
        }
    }
});
```

- [ ] **Step 6: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 7: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS (autoHidden を持つインスタンスが既存テストに存在しないので影響なし)

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Timeline.tsx
rtk git commit -m "feat(Timeline): autoHidden 付き mitigation を描画と行展開判定から除外"
```

---

## Task 6: MitigationSelector.tsx に AST 専用フィルタ追加

**Files:**
- Modify: `src/components/MitigationSelector.tsx`

- [ ] **Step 1: 既存の AST 特例 (sun_sign) の位置を確認**

```bash
rtk grep "m.id === 'sun_sign'" src/components/MitigationSelector.tsx -n
```

Expected: L151 周辺が表示される

- [ ] **Step 2: L139-159 のフィルタ全体を確認**

```bash
rtk read src/components/MitigationSelector.tsx --start 138 --end 162
```

該当ロジックの位置と前後を把握する。

- [ ] **Step 3: L139 直後に AST カード専用ロジックを追加**

変更前 (L139):
```typescript
            if (!m.requires) return true;
            return activeMitigations.some(am => {
```

変更後:
```typescript
            if (!m.requires) return true;

            // AST カード専用: 最新のドローが対応する種別か (手札は次のドローまで保持される仕様)
            if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
                const drawsBeforeNow = activeMitigations
                    .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
                    .filter(am => am.time <= selectedTime)
                    .sort((a, b) => b.time - a.time);
                if (drawsBeforeNow.length === 0) return false;
                return drawsBeforeNow[0].mitigationId === m.requires;
            }

            return activeMitigations.some(am => {
```

- [ ] **Step 4: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 5: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS (既存スキルは requires === 'astral_draw' / 'umbral_draw' を持たないため影響なし)

- [ ] **Step 6: コミット**

```bash
rtk git add src/components/MitigationSelector.tsx
rtk git commit -m "feat(Selector): AST カード専用フィルタを追加 (最新ドロー種別判定)"
```

---

## Task 7: resourceTracker.ts に AST 専用バリデーション追加

**Files:**
- Modify: `src/utils/resourceTracker.ts`

- [ ] **Step 1: 既存の AST 特例 (aspected_helios) の位置を確認**

```bash
rtk grep "m.requires === 'neutral_sect'" src/utils/resourceTracker.ts -n
```

Expected: L311 周辺が表示される

- [ ] **Step 2: L297-332 の requires チェック全体を確認**

```bash
rtk read src/utils/resourceTracker.ts --start 295 --end 335
```

- [ ] **Step 3: L297 直後に AST カード専用ロジックを追加**

変更前 (L297):
```typescript
    if (m.requires) {
        // 配置済みの軽減の中から、前提スキル（例：ニュートラルセクト）を探す
        const parentInstances = relevantMitigations.filter(am => am.mitigationId === m.requires);
```

変更後:
```typescript
    if (m.requires) {
        // AST カード専用: 最新のドローが対応する種別か (手札は次のドローまで保持される仕様)
        if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
            const drawsBeforeNow = relevantMitigations
                .filter(am => am.mitigationId === 'astral_draw' || am.mitigationId === 'umbral_draw')
                .filter(am => am.time <= selectedTime)
                .sort((a, b) => b.time - a.time);
            if (drawsBeforeNow.length === 0 || drawsBeforeNow[0].mitigationId !== m.requires) {
                const parentDef = getMitigationsFromStore().find(d => d.id === m.requires);
                const parentNameObj = parentDef ? parentDef.name : { ja: '前提スキル', en: 'Prerequisite' };
                const lang = t('lang_info', 'ja');
                const parentNameStr = (lang === 'en' || lang === 'en-US' || !parentNameObj.ja) ? parentNameObj.en : parentNameObj.ja;
                return {
                    available: false,
                    message: t('mitigation.requires_parent', { parent: parentNameStr, defaultValue: `${parentNameStr}の効果中のみ使用可能` })
                };
            }
            // AST カードは既存の parentInstances ベースの判定をスキップ
        } else {
            // 配置済みの軽減の中から、前提スキル（例：ニュートラルセクト）を探す
            const parentInstances = relevantMitigations.filter(am => am.mitigationId === m.requires);
```

直後の既存ロジック (`const requiresWindow = m.requiresWindow;` から `}` で `if (m.requires)` ブロックを閉じるまで) を `} else {` ブロック内にインデント。 既存の `if (!isActiveParent)` ブロックや AST aspected_helios 特例も `else` ブロック内に残す。

最終的に `if (m.requires) { ... }` の構造:
```typescript
    if (m.requires) {
        if (m.requires === 'astral_draw' || m.requires === 'umbral_draw') {
            // AST カード専用ロジック (上記)
        } else {
            // 既存ロジック (parentInstances ベース + sun_sign / aspected_helios 特例)
        }
    }
```

- [ ] **Step 4: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 5: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 608/608 PASS

- [ ] **Step 6: コミット**

```bash
rtk git add src/utils/resourceTracker.ts
rtk git commit -m "feat(resourceTracker): AST カード専用バリデーション追加 (最新ドロー種別判定)"
```

---

## Task 8: astrologianAutoInsert.test.ts (テストファイル先行 TDD)

**Files:**
- Test: `src/utils/__tests__/astrologianAutoInsert.test.ts`

- [ ] **Step 1: 学者テストファイルを参考に新規テストファイルを作成**

```bash
rtk read src/utils/__tests__/scholarAutoInsert.test.ts
```

学者テストの構造を把握 (describe / test / 入力出力パターン)。

- [ ] **Step 2: テストファイル作成**

```typescript
// src/utils/__tests__/astrologianAutoInsert.test.ts
import { describe, it, expect } from 'vitest';
import type { AppliedMitigation, TimelineEvent } from '../../types';
import { hasAnyAstrologianDraw, buildAstrologianAutoInserts } from '../astrologianAutoInsert';

const member = 'H1';

function mkEvent(time: number): TimelineEvent {
    return {
        id: `e_${time}`,
        time,
        name: { ja: 'ダメ', en: 'Dmg' },
        damageType: 'physical',
        damageAmount: 1000,
        target: 'MT',
    } as TimelineEvent;
}

describe('hasAnyAstrologianDraw', () => {
    it('astral_draw が 1 つでもあれば true', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(true);
    });

    it('umbral_draw が 1 つでもあれば true', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'umbral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(true);
    });

    it('他メンバーのドローはカウントしない', () => {
        const mits: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: 'H2', time: 0, duration: 1 } as AppliedMitigation,
        ];
        expect(hasAnyAstrologianDraw(member, mits)).toBe(false);
    });

    it('ドローが無ければ false', () => {
        expect(hasAnyAstrologianDraw(member, [])).toBe(false);
    });
});

describe('buildAstrologianAutoInserts', () => {
    it('空状態から戦闘前 Astral + 9s Umbral + 65s Astral + 60s 毎交互を配置', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);

        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: -3 },
            { id: 'umbral_draw', time: 9 },
            { id: 'astral_draw', time: 65 },
            { id: 'umbral_draw', time: 125 },
        ]);
    });

    it('戦闘前 Astral Draw のみ autoHidden が立つ', () => {
        const events: TimelineEvent[] = [mkEvent(120)];
        const inserts = buildAstrologianAutoInserts(member, [], events);

        const prepull = inserts.find(i => i.time === -3);
        expect(prepull?.autoHidden).toBe(true);

        const others = inserts.filter(i => i.time !== -3);
        for (const o of others) {
            expect(o.autoHidden).toBeUndefined();
        }
    });

    it('既に astral_draw がある場合は配置をスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: member, time: 0, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts).toEqual([]);
    });

    it('既に umbral_draw がある場合も配置をスキップ', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'umbral_draw', ownerId: member, time: 9, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts).toEqual([]);
    });

    it('他メンバーのドローは無視して配置する', () => {
        const existing: AppliedMitigation[] = [
            { id: '1', mitigationId: 'astral_draw', ownerId: 'H2', time: 0, duration: 1 } as AppliedMitigation,
        ];
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, existing, events);
        expect(inserts.length).toBeGreaterThan(0);
    });

    it('イベントが無いとき、 戦闘前 Astral のみ配置 (もしくは空)', () => {
        const inserts = buildAstrologianAutoInserts(member, [], []);
        // 戦闘前 Astral だけは置く (= maxTime 0 でも -3 < 0 で挿入)、 t=9 以降は maxTime=0 だと挿入されない
        const prepull = inserts.find(i => i.time === -3 && i.mitigationId === 'astral_draw');
        expect(prepull).toBeDefined();
        // t=9 以降 (maxTime > 9) のときだけ挿入されるはずなので、 イベント無しでは無い
        expect(inserts.filter(i => i.time >= 9)).toEqual([]);
    });

    it('全インサートに ownerId と genId 由来の id が入る', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        for (const i of inserts) {
            expect(i.ownerId).toBe(member);
            expect(i.id).toBeDefined();
            expect(i.id.length).toBeGreaterThan(0);
        }
    });

    it('全インサートに duration が指定されている', () => {
        const events: TimelineEvent[] = [mkEvent(180)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        for (const i of inserts) {
            expect(i.duration).toBe(1);
        }
    });

    it('長尺コンテンツ (10 分) で 60 秒毎に Astral / Umbral 交互配置', () => {
        const events: TimelineEvent[] = [mkEvent(600)];
        const inserts = buildAstrologianAutoInserts(member, [], events);
        const drawTimes = inserts.map(i => ({ id: i.mitigationId, time: i.time }));
        expect(drawTimes).toEqual([
            { id: 'astral_draw', time: -3 },
            { id: 'umbral_draw', time: 9 },
            { id: 'astral_draw', time: 65 },
            { id: 'umbral_draw', time: 125 },
            { id: 'astral_draw', time: 185 },
            { id: 'umbral_draw', time: 245 },
            { id: 'astral_draw', time: 305 },
            { id: 'umbral_draw', time: 365 },
            { id: 'astral_draw', time: 425 },
            { id: 'umbral_draw', time: 485 },
            { id: 'astral_draw', time: 545 },
        ]);
    });
});
```

- [ ] **Step 3: テスト実行して失敗を確認**

```bash
rtk vitest run src/utils/__tests__/astrologianAutoInsert.test.ts
```

Expected: FAIL with "Cannot find module '../astrologianAutoInsert'"

(まだ実装ファイルが無いため失敗するのが正常)

- [ ] **Step 4: コミット**

```bash
rtk git add src/utils/__tests__/astrologianAutoInsert.test.ts
rtk git commit -m "test(astrologianAutoInsert): failing test を先に追加 (TDD)"
```

---

## Task 9: astrologianAutoInsert.ts 実装

**Files:**
- Create: `src/utils/astrologianAutoInsert.ts`

- [ ] **Step 1: ファイル新規作成**

```typescript
// src/utils/astrologianAutoInsert.ts
import type { AppliedMitigation, TimelineEvent } from '../types';

/**
 * 占星術師のドロー自動挿入ロジック。
 *
 * 仕様:
 * - 戦闘前 Astral Draw (t=-3): autoHidden:true で配置 (タイムライン表示から除外、 計算には含める)
 * - t=9 で Umbral Draw、 t=65 で Astral Draw、 以降 60 秒毎に交互に最終イベント時刻まで
 * - 既に astral_draw or umbral_draw が 1 つでもあれば「初回投入済み」 とみなしスキップ
 *   (ユーザーが削除/移動した結果を尊重するため)
 */

const PREPULL_ASTRAL_TIME = -3;
const FIRST_UMBRAL_TIME = 9;
const SECOND_ASTRAL_TIME = 65;
const DRAW_INTERVAL = 60;

function genId(): string {
    return (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ast_' + Math.random().toString(36).substring(2, 9);
}

/**
 * 該当 AST メンバーが既にドロー (astral_draw or umbral_draw) を 1 つでも持っているか。
 * true なら「初回投入済み」 とみなし、 自動配置はスキップする。
 */
export function hasAnyAstrologianDraw(
    memberId: string,
    mitigations: AppliedMitigation[]
): boolean {
    return mitigations.some(
        m => m.ownerId === memberId &&
            (m.mitigationId === 'astral_draw' || m.mitigationId === 'umbral_draw')
    );
}

/**
 * memberId の占星術師向けに必要な自動配置分を返す。
 * 既存配置に追加する形で新規挿入分だけ返すので、 呼び出し側は配列を結合すればよい。
 */
export function buildAstrologianAutoInserts(
    memberId: string,
    existingMitigations: AppliedMitigation[],
    timelineEvents: TimelineEvent[]
): AppliedMitigation[] {
    // 既にドローを持っていればユーザー編集尊重でスキップ
    if (hasAnyAstrologianDraw(memberId, existingMitigations)) {
        return [];
    }

    const inserts: AppliedMitigation[] = [];

    // 1. 戦闘前 Astral Draw (t=-3、 autoHidden で行展開トリガーにしない)
    inserts.push({
        id: genId(),
        mitigationId: 'astral_draw',
        ownerId: memberId,
        time: PREPULL_ASTRAL_TIME,
        duration: 1,
        autoHidden: true,
    });

    // 最大時刻 (戦闘終了想定)
    const maxTime = timelineEvents.length > 0
        ? timelineEvents.reduce((max, e) => Math.max(max, e.time), 0)
        : 0;

    // 2. t=9 Umbral Draw
    if (FIRST_UMBRAL_TIME <= maxTime) {
        inserts.push({
            id: genId(),
            mitigationId: 'umbral_draw',
            ownerId: memberId,
            time: FIRST_UMBRAL_TIME,
            duration: 1,
        });
    }

    // 3. t=65 Astral Draw + 以降 60 秒毎に交互
    for (let t = SECOND_ASTRAL_TIME, isAstral = true; t <= maxTime; t += DRAW_INTERVAL, isAstral = !isAstral) {
        inserts.push({
            id: genId(),
            mitigationId: isAstral ? 'astral_draw' : 'umbral_draw',
            ownerId: memberId,
            time: t,
            duration: 1,
        });
    }

    return inserts;
}
```

- [ ] **Step 2: テスト実行して通ることを確認**

```bash
rtk vitest run src/utils/__tests__/astrologianAutoInsert.test.ts
```

Expected: All tests PASS (Task 8 で書いた 10 件すべて)

- [ ] **Step 3: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 4: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 618/618 PASS (既存 608 + 新規 10)

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/astrologianAutoInsert.ts
rtk git commit -m "feat(astrologianAutoInsert): 戦闘前 Astral + 60s 毎交互配置を実装"
```

---

## Task 10: useMitigationStore.ts に astrologianAutoInsert を 5 箇所配線

**Files:**
- Modify: `src/store/useMitigationStore.ts`

- [ ] **Step 1: import 文を追加**

ファイル冒頭の import 群に追加 (L8 既存 `import { buildScholarAutoInserts ... }` の直後):

```typescript
import { buildAstrologianAutoInserts, hasAnyAstrologianDraw } from '../utils/astrologianAutoInsert';
```

- [ ] **Step 2: 配線 5 箇所のうち、 L327-336 (マイグレーション時)**

既存:
```typescript
                    let migratedMitigations = [...snapshot.timelineMitigations];
                    for (const member of membersWithComputed) {
                        if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, migratedMitigations)) {
                            const inserts = buildScholarAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                            migratedMitigations.push(...inserts);
                        }
                    }
```

変更後 (学者ブロックの直後に AST ブロックを追加):
```typescript
                    let migratedMitigations = [...snapshot.timelineMitigations];
                    for (const member of membersWithComputed) {
                        if (member.jobId === 'sch' && !hasAnyAetherflow(member.id, migratedMitigations)) {
                            const inserts = buildScholarAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                            migratedMitigations.push(...inserts);
                        }
                        if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, migratedMitigations)) {
                            const inserts = buildAstrologianAutoInserts(member.id, migratedMitigations, snapshot.timelineEvents);
                            migratedMitigations.push(...inserts);
                        }
                    }
```

- [ ] **Step 3: 配線 5 箇所のうち、 L420-431 (オートプラン後)**

`if (member.jobId === 'sch' && !hasAnyAetherflow(...))` のブロック直後に同様の AST ブロックを追加:

```typescript
                            if (member.jobId === 'ast' && !hasAnyAstrologianDraw(member.id, finalMitigations)) {
                                const inserts = buildAstrologianAutoInserts(member.id, finalMitigations, state.timelineEvents);
                                finalMitigations.push(...inserts);
                            }
```

- [ ] **Step 4: 配線 5 箇所のうち、 L920-929 (メンバー追加時)**

同様に学者ブロックの直後に追加:

```typescript
                        if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, filteredMitigations)) {
                            const inserts = buildAstrologianAutoInserts(memberId, filteredMitigations, state.timelineEvents);
                            filteredMitigations.push(...inserts);
                        }
```

- [ ] **Step 5: 配線 5 箇所のうち、 L956-971 (ジョブ変更時)**

同様に学者ブロックの直後に追加:

```typescript
                        if (jobId === 'ast') {
                            const ownedMitis = finalMitis.map(m => ({ ...m, ownerId: memberId }));
                            if (!hasAnyAstrologianDraw(memberId, ownedMitis)) {
                                const inserts = buildAstrologianAutoInserts(memberId, ownedMitis, state.timelineEvents);
                                finalMitis.push(...inserts);
                            }
                        }
```

- [ ] **Step 6: 配線 5 箇所のうち、 L1030-1038 (ジョブ別復元時)**

同様に学者ブロックの直後に追加:

```typescript
                            if (jobId === 'ast' && !hasAnyAstrologianDraw(memberId, currentMitigations)) {
                                const inserts = buildAstrologianAutoInserts(memberId, currentMitigations, state.timelineEvents);
                                currentMitigations.push(...inserts);
                            }
```

- [ ] **Step 7: TypeScript ビルドエラーなしを確認**

```bash
rtk tsc --noEmit
```

Expected: エラーなし

- [ ] **Step 8: vitest 全件パス確認**

```bash
rtk vitest run
```

Expected: 618/618 PASS

- [ ] **Step 9: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "feat(useMitigationStore): AST メンバーに astrologianAutoInsert を 5 箇所配線"
```

---

## Task 11: Firebase Storage にアイコンアップロード

**Files:**
- 運用 (実行のみ、 リポジトリへのコミットなし)

- [ ] **Step 1: 環境変数の確認**

```bash
ls .env.local 2>&1 | head -1
```

Expected: `.env.local` が存在 (Firebase 認証情報あり)

- [ ] **Step 2: seed-icons.ts 実行**

```bash
npx tsx scripts/seed-icons.ts
```

Expected: 7 個の新規 PNG が「uploaded」 と表示される

(既存アイコンは「already exists, skipped」 と表示される)

- [ ] **Step 3: Firebase Console で目視確認 (オプション)**

`https://console.firebase.google.com/project/lopo-app/storage/lopo-app.appspot.com/files/icons/` を開いて 7 個の新規ファイル名 (Astral_Draw.png 等) を確認する。

---

## Task 12: Firestore /master/skills 同期

**Files:**
- 運用 (実行のみ、 リポジトリへのコミットなし)

- [ ] **Step 1: seed-skills-stats.ts 実行**

```bash
npx tsx scripts/seed-skills-stats.ts
```

Expected:
- `/master/skills` に 7 スキル追加 (logs に「added astral_draw / umbral_draw / the_arrow / the_spire / the_bole / the_ewer / lady_of_crowns」 と表示)
- `/master/config` の `dataVersion` がインクリメント

- [ ] **Step 2: Firestore Console で目視確認 (オプション)**

`https://console.firebase.google.com/project/lopo-app/firestore/data/~2Fmaster~2Fskills` を開いて mitigations 配列に 7 スキルが含まれることを確認する。

---

## Task 13: 実機動作確認

**Files:**
- (動作確認のみ、 コード変更なし)

- [ ] **Step 1: 開発サーバー起動**

```bash
rtk npm run dev
```

ブラウザで `http://localhost:5173` を開く。

- [ ] **Step 2: AST メンバーをパーティに追加**

任意のコンテンツを開いて、 パーティ編成で H1 (or H2) のジョブを「占星術師」 に変更する。

期待挙動:
- タイムラインに `astral_draw @ t=-3` は**表示されない** (autoHidden 効果)
- `umbral_draw @ t=9` が表示される
- `astral_draw @ t=65` が表示される
- 以降 60 秒毎に交互配置

- [ ] **Step 3: hideEmptyRows トグル (展開ボタン) を OFF**

タイムライン上部の展開ボタンを押して `hideEmptyRows: false` に切り替える。

期待挙動:
- -10 秒〜全行が表示され、 -3 秒の行に Astral Draw アイコンが見える

- [ ] **Step 4: AST 区間でのカードセレクタ確認**

t=0 周辺のイベント (or 任意の時刻) でセレクタを開く。

期待挙動:
- Astral 系のみ (The Arrow / The Spire) が表示される
- Umbral 系 (The Bole / The Ewer / Lady of Crowns) は**表示されない**

- [ ] **Step 5: Umbral 区間でのカードセレクタ確認**

t=20 周辺 (Umbral Draw 後) でセレクタを開く。

期待挙動:
- Umbral 系のみ (The Bole / The Ewer / Lady of Crowns) が表示される
- Astral 系 (The Arrow / The Spire) は**表示されない**

- [ ] **Step 6: The Spire のバリア値確認**

The Spire を任意の対象に配置 → ダメージイベントが効くか確認。

期待挙動:
- バリア値が**0 ではなく**、 回復力 400 相当 (キャラの能力値次第で数千) の値が表示される
- ダメージイベントでこのバリアが正しく消費される

- [ ] **Step 7: The Arrow の被回復+10% 確認**

A さんに The Arrow を配置 + A さんに The Spire を配置 → バリア値を確認。

期待挙動:
- The Arrow なしの場合より +10% のバリア値が表示される

- [ ] **Step 8: 既存 AST スキルが壊れていないか確認**

Neutral Sect → Sun Sign / Aspected Helios の挙動が変わっていないことを確認。

- [ ] **Step 9: 既存学者・賢者・白魔の挙動確認**

学者のエーテルフロー自動配置・賢者の Addersgall・白魔の Lily の挙動が変わっていないことを確認。

- [ ] **Step 10: ハードロード後の挙動確認**

ブラウザでハードリロード (Ctrl+Shift+R) → AST メンバーの自動配置が永続化されていることを確認。

---

## Task 14: ビルド確認 + push + Vercel デプロイ

**Files:**
- (運用のみ)

- [ ] **Step 1: ビルド確認**

```bash
rtk npm run build
```

Expected: エラーなし、 vite build 成功

- [ ] **Step 2: vitest 最終確認**

```bash
rtk vitest run
```

Expected: 618/618 PASS

- [ ] **Step 3: docs/TODO.md 更新**

「完了済み」 セクションに「2026-05-11 占星術師カード機構実装」 を追記。

- [ ] **Step 4: docs/TODO.md コミット**

```bash
rtk git add docs/TODO.md
rtk git commit -m "docs(todo): 占星術師カード機構実装の完了記録"
```

- [ ] **Step 5: push**

```bash
rtk git push origin main
```

Expected: Vercel が自動デプロイを開始

- [ ] **Step 6: Vercel デプロイ確認**

`https://vercel.com/<account>/lopo-app/deployments` でデプロイが成功していることを確認。

- [ ] **Step 7: 本番動作確認**

`https://lopoly.app` で AST メンバーを選んだときの自動配置・カード表示が動作することを確認。

---

## 完了基準

すべてのチェックボックスが完了し、 以下を満たしていること:

1. ✅ vitest 618/618 PASS (既存 608 + 新規 10)
2. ✅ `rtk tsc --noEmit` でエラーなし
3. ✅ `rtk npm run build` で vite build 成功
4. ✅ 実機で AST メンバー選択時に自動配置される
5. ✅ Astral 区間中は Astral 系のみ、 Umbral 区間中は Umbral 系のみセレクタに表示される
6. ✅ The Spire のバリア値が 0 ではない (`SKILL_DATA` 追加忘れ防止チェック)
7. ✅ The Arrow の被回復+10% が同対象シールドに反映される
8. ✅ 既存 AST スキル (Neutral Sect → Sun Sign 等) の挙動が変わっていない
9. ✅ 既存学者・賢者・白魔の挙動が変わっていない
10. ✅ Vercel デプロイ成功
