# セラフィズム中のスキル自動変化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** セラフィズム発動中に学者の「鼓舞激励の策」「意気軒高の策」を選択すると、自動的に「マニフェステーション」「アクセッション」として配置されるようにする。付随して、展開戦術のコピー対象拡張と、秘策の確定クリティカル対象の絞り込みも公式仕様通りに修正する。

**Architecture:** 判定ロジックはすべて `src/utils/scholarShieldRules.ts` の純粋関数に集約し、PC用パネル (`MitigationSelector.tsx`)・スマホ用パネル (`Timeline.tsx` 内埋め込みUI)・被ダメ計算 (`Timeline.tsx`)・鼓舞コピー判定 (`mitigationTapResolver.ts`) の4箇所から共通で呼び出す。UIコンポーネント側の変更は薄い配線のみに留める(このコードベースでは `Timeline.tsx` 全体をレンダーするテストは書かない慣習のため)。

**Tech Stack:** React + TypeScript, Zustand, Vitest, Vite。既存パターンに準拠。

## Global Constraints

- 対象言語は日本語のみ(コード内コメント・コミットメッセージ)。
- i18n: 新規UI文言は追加しない(既存の名前/アイコン切り替えのみ)。
- 既存の `MITIGATIONS`(mockData.ts)配列やスキルの数値は変更しない。変更は `hidden` フラグ追加のみ。
- `docs/superpowers/specs/2026-08-08-scholar-seraphism-transform-design.md` の確定仕様と食い違ったら実装を止めて確認する。

---

### Task 1: 共通判定ロジック `scholarShieldRules.ts`

**Files:**
- Create: `src/utils/scholarShieldRules.ts`
- Test: `src/utils/__tests__/scholarShieldRules.test.ts`

**Interfaces:**
- Produces:
  - `resolveSeraphismMitigation(mit: Mitigation, time: number, ownerMitigations: readonly AppliedMitigation[], allMitigations: readonly Mitigation[]): Mitigation`
  - `matchesCopiesShieldSource(candidateMitigationId: string, copiesShield: string): boolean`
  - `isRecitationCritEligible(mitigationId: string): boolean`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/utils/__tests__/scholarShieldRules.test.ts
import { describe, it, expect } from 'vitest';
import {
    resolveSeraphismMitigation,
    matchesCopiesShieldSource,
    isRecitationCritEligible,
} from '../scholarShieldRules';
import { MITIGATIONS } from '../../data/mockData';
import type { AppliedMitigation, Mitigation } from '../../types';

const adloquium = MITIGATIONS.find(m => m.id === 'adloquium')!;
const concitation = MITIGATIONS.find(m => m.id === 'concitation')!;
const manifestation = MITIGATIONS.find(m => m.id === 'manifestation')!;
const accession = MITIGATIONS.find(m => m.id === 'accession')!;
const aetherflow = MITIGATIONS.find(m => m.id === 'aetherflow')!;

function seraphism(time: number, duration = 20): AppliedMitigation {
    return { id: 's1', mitigationId: 'seraphism', time, duration, ownerId: 'H1' };
}

describe('resolveSeraphismMitigation', () => {
    it('セラフィズムと無関係な技はそのまま返す', () => {
        const result = resolveSeraphismMitigation(aetherflow, 10, [seraphism(0)], MITIGATIONS);
        expect(result).toBe(aetherflow);
    });

    it('セラフィズムが有効でなければ鼓舞激励の策はそのまま返す', () => {
        const result = resolveSeraphismMitigation(adloquium, 10, [], MITIGATIONS);
        expect(result).toBe(adloquium);
    });

    it('セラフィズムの窓の外(終了後)なら鼓舞激励の策はそのまま返す', () => {
        const result = resolveSeraphismMitigation(adloquium, 25, [seraphism(0, 20)], MITIGATIONS);
        expect(result).toBe(adloquium);
    });

    it('セラフィズム有効中の鼓舞激励の策はマニフェステーションに変わる', () => {
        const result = resolveSeraphismMitigation(adloquium, 10, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('manifestation');
        expect(result).toBe(manifestation);
    });

    it('セラフィズム有効中の意気軒高の策はアクセッションに変わる', () => {
        const result = resolveSeraphismMitigation(concitation, 10, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('accession');
        expect(result).toBe(accession);
    });

    it('セラフィズム発動と同時刻(境界)は有効とみなす', () => {
        const result = resolveSeraphismMitigation(adloquium, 0, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('manifestation');
    });

    it('セラフィズム終了ちょうど(境界)は無効とみなす', () => {
        const result = resolveSeraphismMitigation(adloquium, 20, [seraphism(0, 20)], MITIGATIONS);
        expect(result.id).toBe('adloquium');
    });
});

describe('matchesCopiesShieldSource', () => {
    it('完全一致は true', () => {
        expect(matchesCopiesShieldSource('adloquium', 'adloquium')).toBe(true);
    });

    it('展開戦術(copiesShield=adloquium)はマニフェステーションも候補に含む', () => {
        expect(matchesCopiesShieldSource('manifestation', 'adloquium')).toBe(true);
    });

    it('無関係な組み合わせは false', () => {
        expect(matchesCopiesShieldSource('concitation', 'adloquium')).toBe(false);
        expect(matchesCopiesShieldSource('accession', 'adloquium')).toBe(false);
    });
});

describe('isRecitationCritEligible', () => {
    it('鼓舞激励の策・意気軒高の策・士気高揚の策は対象', () => {
        expect(isRecitationCritEligible('adloquium')).toBe(true);
        expect(isRecitationCritEligible('concitation')).toBe(true);
        expect(isRecitationCritEligible('succor')).toBe(true);
    });

    it('マニフェステーション・アクセッション・コンソレイションは対象外', () => {
        expect(isRecitationCritEligible('manifestation')).toBe(false);
        expect(isRecitationCritEligible('accession')).toBe(false);
        expect(isRecitationCritEligible('consolation')).toBe(false);
    });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/utils/__tests__/scholarShieldRules.test.ts`
Expected: FAIL with "Cannot find module '../scholarShieldRules'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/utils/scholarShieldRules.ts
import type { Mitigation, AppliedMitigation } from '../types';

/**
 * セラフィズム発動中に鼓舞激励の策/意気軒高の策が自動的に変化する先。
 * 公式ジョブガイド確認済み(2026-08-08): セラフィズムは鼓舞激励の策をマニフェステーションに、
 * 意気軒高の策をアクセッションに変える。
 */
const SERAPHISM_TRANSFORMS: Record<string, string> = {
    adloquium: 'manifestation',
    concitation: 'accession',
};

/**
 * 指定時刻にセラフィズムが有効なら、鼓舞激励の策/意気軒高の策をマニフェステーション/
 * アクセッションの定義に置き換える。対象外の技や、セラフィズムが有効でない場合はそのまま返す。
 *
 * ownerMitigations は呼び出し側で「このスキルの持ち主」1人分に絞り込んだ配列を渡すこと
 * (このジョブは学者本人にしか発動しない自己バフのため)。
 */
export function resolveSeraphismMitigation(
    mit: Mitigation,
    time: number,
    ownerMitigations: readonly AppliedMitigation[],
    allMitigations: readonly Mitigation[],
): Mitigation {
    const transformedId = SERAPHISM_TRANSFORMS[mit.id];
    if (!transformedId) return mit;

    const isSeraphismActive = ownerMitigations.some(am =>
        am.mitigationId === 'seraphism' && time >= am.time && time < am.time + am.duration
    );
    if (!isSeraphismActive) return mit;

    return allMitigations.find(d => d.id === transformedId) ?? mit;
}

/**
 * 展開戦術等の copiesShield 判定: コピー元候補が copiesShield の id と一致するか。
 * 鼓舞激励の策(adloquium)はセラフィズム中にマニフェステーションへ変化するため、
 * 展開戦術のコピー元候補にはマニフェステーションも含める(公式確認済み: 両方とも
 * 「鼓舞」状態を付与するため展開戦術の対象になる)。
 */
export function matchesCopiesShieldSource(candidateMitigationId: string, copiesShield: string): boolean {
    if (candidateMitigationId === copiesShield) return true;
    if (copiesShield === 'adloquium' && candidateMitigationId === 'manifestation') return true;
    return false;
}

/**
 * 秘策(Recitation)が確定クリティカルを保証する対象技の id 一覧。
 * 公式ジョブガイド確認済み(2026-08-08): 鼓舞激励の策・意気軒高の策(旧: 士気高揚の策)・
 * 不撓不屈の策・深謀遠慮が対象。マニフェステーション/アクセッションは明記されておらず対象外。
 * 不撓不屈の策・深謀遠慮はバリア技ではない(isShield: false)ため、このバリア用チェックの
 * 呼び出し元には元々渡ってこない。
 */
const RECITATION_CRIT_ELIGIBLE_IDS = new Set(['adloquium', 'concitation', 'succor']);

export function isRecitationCritEligible(mitigationId: string): boolean {
    return RECITATION_CRIT_ELIGIBLE_IDS.has(mitigationId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/utils/__tests__/scholarShieldRules.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/utils/scholarShieldRules.ts src/utils/__tests__/scholarShieldRules.test.ts
git commit -m "feat(scholar): セラフィズム自動変化の判定ロジックを追加"
```

---

### Task 2: `mockData.ts` — マニフェステーション/アクセッションを非表示化

**Files:**
- Modify: `src/data/mockData.ts:330-336`

**Interfaces:**
- Consumes: なし
- Produces: `MITIGATIONS` 配列内の `accession`/`manifestation` に `hidden: true` が付く(Task 3/4 で選択パネルから除外するために利用)

- [ ] **Step 1: 現状確認**

現在の該当行:
```typescript
    {
        id: "accession", jobId: "sch", name: { ja: "アクセッション", en: "Accession", zh: "降临之章", ko: "강림" }, icon: "/icons/Accession.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 432, requires: "seraphism", minLevel: 100, family: "healer_gcd_shield"
    },
    {
        id: "manifestation", jobId: "sch", name: { ja: "マニフェステーション", en: "Manifestation", zh: "显灵之章", ko: "현시" }, icon: "/icons/Manifestation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 648, scope: "target", requires: "seraphism", minLevel: 100, family: "healer_gcd_target_shield"
    },
```

- [ ] **Step 2: `hidden: true` を追加**

```typescript
    {
        id: "accession", jobId: "sch", name: { ja: "アクセッション", en: "Accession", zh: "降临之章", ko: "강림" }, icon: "/icons/Accession.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 432, requires: "seraphism", minLevel: 100, family: "healer_gcd_shield", hidden: true
    },
    {
        id: "manifestation", jobId: "sch", name: { ja: "マニフェステーション", en: "Manifestation", zh: "显灵之章", ko: "현시" }, icon: "/icons/Manifestation.png",
        recast: 2.5, duration: 30, type: "all", value: 0, isShield: true, valueType: 'potency', shieldPotency: 648, scope: "target", requires: "seraphism", minLevel: 100, family: "healer_gcd_target_shield", hidden: true
    },
```

- [ ] **Step 3: 既存テストに影響が無いことを確認**

Run: `npx vitest run src/data/__tests__/mitigationDisplayOrder.test.ts src/utils/__tests__/seraphFairyLockout.test.ts src/utils/__tests__/scholarAutoInsert.test.ts`
Expected: PASS(全件、既存の想定通り)

- [ ] **Step 4: Commit**

```bash
git add src/data/mockData.ts
git commit -m "feat(scholar): マニフェステーション/アクセッションを選択パネルから非表示化"
```

---

### Task 3: PC用選択パネル `MitigationSelector.tsx` の配線

**Files:**
- Modify: `src/components/MitigationSelector.tsx:133-227` (isSeraphActive 定義〜availableMitigations パイプライン〜copiesShield クリック処理), `:492-498` (copiesShield 選択パネルの描画)

**Interfaces:**
- Consumes: `resolveSeraphismMitigation`, `matchesCopiesShieldSource` from `../utils/scholarShieldRules`

- [ ] **Step 1: import を追加**

`src/components/MitigationSelector.tsx` の既存 import ブロック(9行目付近、`validateMitigationPlacement` の import の隣)に追加:

```typescript
import { resolveSeraphismMitigation, matchesCopiesShieldSource } from '../utils/scholarShieldRules';
```

- [ ] **Step 2: セラフィズム判定を追加**

`isSeraphActive` の定義([L133-137](../../../src/components/MitigationSelector.tsx#L133))のすぐ下に追加:

```typescript
    const isSeraphismActive = jobId === 'sch' && activeMitigations.some(am =>
        am.mitigationId === 'seraphism' &&
        selectedTime >= am.time &&
        selectedTime < am.time + am.duration
    );
```

- [ ] **Step 3: フィルタ→ソート→すり替えの順に並べ替え**

現状(L139-193)は `filter → map → sort` の順。`sort` を `map` より前に移動し、`map` の中でセラフィズムのすり替えを行う。

置き換え前:
```typescript
    const availableMitigations = allJobMitigations
        .filter((m: Mitigation) => {
            // Level sync filtering
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;

            // Filter out hidden skills (e.g., Adloquium)
            if (m.hidden) return false;

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
                const isNeutSect = am.mitigationId === 'neutral_sect';
                const isHoroscope = am.mitigationId === 'horoscope';
                // requiresWindow がある場合はそちらを使用（例: 金剛周天は30秒窓）
                const window = m.requiresWindow ?? am.duration;
                const isActive = selectedTime >= am.time && selectedTime < am.time + window;
                if (!isActive) return false;

                // Special handling for Astrologian conditional skills
                if (m.requires === 'neutral_sect') {
                    // Sun Sign MUST have Neutral Sect active
                    if (m.id === 'sun_sign') {
                        return isNeutSect;
                    }
                    // Helios-based skills can use either Neutral Sect or Horoscope
                    return isNeutSect || isHoroscope;
                }

                return am.mitigationId === m.requires;
            });
        })
        .map((m: Mitigation) => {
            // Scholar Seraph dynamic changes
            if (isSeraphActive) {
                if (m.id === 'whispering_dawn') {
                    return { ...m, name: { ...m.name, ja: '光輝の囁き', en: 'Angel\'s Whisper' }, icon: '/icons/Angel\'s_Whisper.png' };
                }
                if (m.id === 'fey_illumination') {
                    return { ...m, name: { ...m.name, ja: 'セラフィックイルミネーション', en: 'Seraphic Illumination' }, icon: '/icons/Seraphic_Illumination.png' };
                }
            }
            return m;
        })
        .sort((a: Mitigation, b: Mitigation) => getMitigationPriority(a.id) - getMitigationPriority(b.id));
```

置き換え後(`sort` を `map` より前に移動し、`map` 内でセラフィズムのすり替えを追加):
```typescript
    const availableMitigations = allJobMitigations
        .filter((m: Mitigation) => {
            // Level sync filtering
            if (m.minLevel !== undefined && currentLevel < m.minLevel) return false;
            if (m.maxLevel !== undefined && currentLevel > m.maxLevel) return false;

            // Filter out hidden skills (e.g., Adloquium)
            if (m.hidden) return false;

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
                const isNeutSect = am.mitigationId === 'neutral_sect';
                const isHoroscope = am.mitigationId === 'horoscope';
                // requiresWindow がある場合はそちらを使用（例: 金剛周天は30秒窓）
                const window = m.requiresWindow ?? am.duration;
                const isActive = selectedTime >= am.time && selectedTime < am.time + window;
                if (!isActive) return false;

                // Special handling for Astrologian conditional skills
                if (m.requires === 'neutral_sect') {
                    // Sun Sign MUST have Neutral Sect active
                    if (m.id === 'sun_sign') {
                        return isNeutSect;
                    }
                    // Helios-based skills can use either Neutral Sect or Horoscope
                    return isNeutSect || isHoroscope;
                }

                return am.mitigationId === m.requires;
            });
        })
        // ソートは「すり替え前」の id で行う。すり替え後の id でソートすると、セラフィズムの
        // 発動/終了のたびに一覧内の表示位置が飛んでしまうため。
        .sort((a: Mitigation, b: Mitigation) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
        .map((m: Mitigation) => {
            // セラフィズム中: 鼓舞激励の策→マニフェステーション、意気軒高の策→アクセッション
            const seraphismResolved = isSeraphismActive
                ? resolveSeraphismMitigation(m, selectedTime, activeMitigations, MITIGATIONS)
                : m;
            if (seraphismResolved !== m) return seraphismResolved;

            // Scholar Seraph dynamic changes (サモン・セラフィム中の名称のみ変更)
            if (isSeraphActive) {
                if (m.id === 'whispering_dawn') {
                    return { ...m, name: { ...m.name, ja: '光輝の囁き', en: 'Angel\'s Whisper' }, icon: '/icons/Angel\'s_Whisper.png' };
                }
                if (m.id === 'fey_illumination') {
                    return { ...m, name: { ...m.name, ja: 'セラフィックイルミネーション', en: 'Seraphic Illumination' }, icon: '/icons/Seraphic_Illumination.png' };
                }
            }
            return m;
        });
```

- [ ] **Step 4: `copiesShield` の候補フィルタを2箇所拡張**

`handleMitigationClick` 内([L204-208](../../../src/components/MitigationSelector.tsx#L204)):

置き換え前:
```typescript
            const availableShields = timelineMitigations.filter(l =>
                l.mitigationId === mitigation.copiesShield &&
                l.time <= selectedTime &&
                l.time + l.duration > selectedTime
            );
```

置き換え後:
```typescript
            const availableShields = timelineMitigations.filter(l =>
                matchesCopiesShieldSource(l.mitigationId, mitigation.copiesShield!) &&
                l.time <= selectedTime &&
                l.time + l.duration > selectedTime
            );
```

描画側の同ロジック([L494-498](../../../src/components/MitigationSelector.tsx#L494))も同様に置き換え:

置き換え前:
```typescript
                        const availableShields = timelineMitigations.filter(l =>
                            l.mitigationId === mitigation.copiesShield &&
                            l.time <= selectedTime &&
                            l.time + l.duration > selectedTime
                        );
```

置き換え後:
```typescript
                        const availableShields = timelineMitigations.filter(l =>
                            matchesCopiesShieldSource(l.mitigationId, mitigation.copiesShield!) &&
                            l.time <= selectedTime &&
                            l.time + l.duration > selectedTime
                        );
```

- [ ] **Step 5: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 6: Commit**

```bash
git add src/components/MitigationSelector.tsx
git commit -m "feat(scholar): PC用選択パネルにセラフィズム自動変化を配線"
```

---

### Task 4: スマホ用パネル + 被ダメ計算 (`Timeline.tsx`, `mitigationTapResolver.ts`)

**Files:**
- Modify: `src/utils/mitigationTapResolver.ts:23-28`
- Modify: `src/components/Timeline.tsx:2112-2146`(秘策/ゾーエ判定)、`:3799-3806`(スマホ選択パネルの一覧構築)
- Test: `src/utils/__tests__/mitigationTapResolver.test.ts` (既存ファイルにケース追加)

**Interfaces:**
- Consumes: `resolveSeraphismMitigation`, `matchesCopiesShieldSource`, `isRecitationCritEligible` from `../utils/scholarShieldRules`

- [ ] **Step 1: `mitigationTapResolver.ts` に失敗するテストを追加**

`src/utils/__tests__/mitigationTapResolver.test.ts` の既存 `copiesShield` まわりのテスト群のそばに追加:

```typescript
    it('copiesShield=adloquium はマニフェステーションのバリアも候補に含める', () => {
        const shields = [
            { id: 'sh1', mitigationId: 'manifestation', time: 90, duration: 30, ownerId: 'H1' },
        ];
        const r = resolveMitigationTap(mit({ copiesShield: 'adloquium' }), 100, shields);
        expect(r).toEqual({ kind: 'place', linkedMitigationId: 'sh1' });
    });
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/mitigationTapResolver.test.ts`
Expected: FAIL(現状は `mitigationId === mit.copiesShield` の完全一致のみなので候補が0件になり `selectShield` になる)

- [ ] **Step 3: `mitigationTapResolver.ts` を修正**

```typescript
import type { Mitigation, AppliedMitigation } from '../types';
import { matchesCopiesShieldSource } from './scholarShieldRules';
```

(既存の `import type { Mitigation, AppliedMitigation } from '../types';` を上記2行に置き換え)

`resolveMitigationTap` 内のフィルタ([L23-28](../../../src/utils/mitigationTapResolver.ts#L23)):

置き換え前:
```typescript
    if (mit.copiesShield) {
        const shields = timelineMitigations.filter(l =>
            l.mitigationId === mit.copiesShield &&
            l.time <= time &&
            l.time + l.duration > time
        );
```

置き換え後:
```typescript
    if (mit.copiesShield) {
        const shields = timelineMitigations.filter(l =>
            matchesCopiesShieldSource(l.mitigationId, mit.copiesShield!) &&
            l.time <= time &&
            l.time + l.duration > time
        );
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/mitigationTapResolver.test.ts`
Expected: PASS(全件)

- [ ] **Step 5: `Timeline.tsx` の秘策判定を修正**

`import` ブロック(44行目付近、`resolveMitigationTap` の import の隣)に追加:

```typescript
import { isRecitationCritEligible } from '../utils/scholarShieldRules';
```

被ダメ計算内の秘策チェック([L2112-2128](../../../src/components/Timeline.tsx#L2112)):

置き換え前:
```typescript
                    if (def.isShield) {
                        // 秘策 (SCH): 確定クリティカル ×1.6
                        const activeRecitation = buffsAtCast.find(b =>
                            b.mitigationId === 'recitation' && b.ownerId === appMit.ownerId
                        );
                        if (activeRecitation) {
                            const earlierShieldConsumes = timelineMitigations.some(m =>
                                m.id !== appMit.id &&
                                m.ownerId === appMit.ownerId &&
                                m.time >= activeRecitation.time &&
                                m.time < appMit.time &&
                                MITIGATIONS.find(d => d.id === m.mitigationId)?.isShield
                            );
                            if (!earlierShieldConsumes) {
                                critMultiplier = CRIT_MULTIPLIER;
                            }
                        }
```

置き換え後(**注意**: ゾーエ判定は同じ `if (def.isShield)` ブロックの中に同居しているため、外側の条件に `isRecitationCritEligible` を混ぜてはいけない。ゾーエは公式仕様上「次の回復魔法」全般が対象のため、id制限は秘策側だけにかける):
```typescript
                    if (def.isShield) {
                        // 秘策 (SCH): 確定クリティカル ×1.6。公式仕様では鼓舞激励の策/意気軒高の策
                        // (旧:士気高揚の策)のみが対象。マニフェステーション/アクセッション/
                        // コンソレイションは対象外(isRecitationCritEligible で絞り込み済み)。
                        const activeRecitation = isRecitationCritEligible(def.id)
                            ? buffsAtCast.find(b => b.mitigationId === 'recitation' && b.ownerId === appMit.ownerId)
                            : undefined;
                        if (activeRecitation) {
                            const earlierShieldConsumes = timelineMitigations.some(m =>
                                m.id !== appMit.id &&
                                m.ownerId === appMit.ownerId &&
                                m.time >= activeRecitation.time &&
                                m.time < appMit.time &&
                                isRecitationCritEligible(m.mitigationId)
                            );
                            if (!earlierShieldConsumes) {
                                critMultiplier = CRIT_MULTIPLIER;
                            }
                        }

                        // ゾーエ (SGE): 次の回復魔法 ×1.5 (公式仕様上「次の回復魔法」全般が対象のため id 制限なし)
                        const activeZoe = buffsAtCast.find(b =>
                            b.mitigationId === 'zoe' && b.ownerId === appMit.ownerId
                        );
                        // ...(ゾーエのブロックは変更なし、そのまま残す)
```

- [ ] **Step 6: スマホ選択パネルの一覧構築を修正**

`Timeline.tsx` のスマホ用ボトムシート内、`mitis` の構築部分([L3799-3806](../../../src/components/Timeline.tsx#L3799)):

置き換え前:
```typescript
                                    const mitis = MITIGATIONS
                                        .filter(m =>
                                            m.jobId === job.id
                                            && !m.hidden
                                            && (!m.minLevel || m.minLevel <= currentLevel)
                                            && (!m.maxLevel || m.maxLevel >= currentLevel)
                                        )
                                        .sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id));
```

置き換え後(既存では `memberMitis` は `mitis` の**後**([旧 L3808](../../../src/components/Timeline.tsx#L3808))で定義されているが、`mitis` の中でセラフィズム判定に使うため**先に**定義する形に順序変更する):
```typescript
                                    const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);
                                    const mitis = MITIGATIONS
                                        .filter(m =>
                                            m.jobId === job.id
                                            && !m.hidden
                                            && (!m.minLevel || m.minLevel <= currentLevel)
                                            && (!m.maxLevel || m.maxLevel >= currentLevel)
                                        )
                                        // ソートは「すり替え前」の id で行う(PC版と同じ理由)
                                        .sort((a, b) => getMitigationPriority(a.id) - getMitigationPriority(b.id))
                                        .map(m => resolveSeraphismMitigation(m, mobileMitiFlow.time, memberMitis, MITIGATIONS));
```

`import` ブロックに追加(Step 5 と合わせて1行にまとめてよい):

```typescript
import { isRecitationCritEligible, resolveSeraphismMitigation } from '../utils/scholarShieldRules';
```

**注意**: 元々 `mitis` の直後にあった `const memberMitis = timelineMitigations.filter(m => m.ownerId === member.id);`([旧 L3808](../../../src/components/Timeline.tsx#L3808))は、上記のように `mitis` より前に移動したので、その位置には残さない(重複定義しない)。後続コード(`isAlreadyPlaced` 判定・`validateMitigationPlacement` 呼び出し等)は移動後の `memberMitis` をそのまま参照すればよく、変更不要。

- [ ] **Step 7: 型チェック**

Run: `npx tsc -b`
Expected: エラー無し

- [ ] **Step 8: 既存テストを実行**

Run: `npx vitest run src/utils/__tests__/mitigationTapResolver.test.ts src/utils/__tests__/scholarShieldRules.test.ts src/utils/__tests__/seraphFairyLockout.test.ts`
Expected: PASS(全件)

- [ ] **Step 9: Commit**

```bash
git add src/utils/mitigationTapResolver.ts src/components/Timeline.tsx
git commit -m "feat(scholar): スマホ選択パネルへセラフィズム自動変化を配線+秘策の対象を仕様通りに修正"
```

---

### Task 5: 全体検証 + Playwright 実機確認

**Files:** なし(検証のみ)

- [x] **Step 1: フルテスト実行**

Run: `npx vitest run`
Expected: 既知の無関係failure(EphemeralAddPanel 7件、TopBar系、HousingWorkspace系 — [[feedback_vercel_tsc_strict]] 参照)以外はすべて PASS。今回変更したファイルに関するテストは全件 PASS。
結果: 3878 passed / 7 failed(EphemeralAddPanel 7件のみ・既知の無関係failure)。

- [x] **Step 2: ビルド確認**

Run: `npm run build`
Expected: エラー無しで成功
結果: 成功。

- [x] **Step 2.5 (計画外で発覚・必須): Firestore(`master/skills`)への反映**

`useMitigations()` は Firestore(`master/skills`)を正本として読み、mockData はフォールバックのみ([[reference_master_data_live_firestore]])。Task 2 で mockData.ts に足した `hidden: true` は **ローカル dev でも本番でも Firestore を再シードするまで反映されない**。実機確認で気づかず進めると、Firestore 側の accession/manifestation が `hidden` 無しのまま残り、セラフィズム変化後の「マニフェステーション」(adloquiumから変換)と、まだ非表示化されていないFirestore由来の「マニフェステーション」(元のmanifestation自身)が両方選択パネルに並び、React の重複key警告と実際の二重表示が起きることを実機確認で発見した。

対処: 外科的パッチスクリプト `scripts/patch-scholar-seraphism-hidden.ts` を新規作成(`add-applies-as-debuff.ts` と同じ「対象2件以外に触れていないか検証してから書き込む」パターン)。`accession`/`manifestation` の2 id だけに `hidden:true` を設定し、`master/config.dataVersion` を +1。

```bash
npx tsx scripts/patch-scholar-seraphism-hidden.ts          # dry-run で対象2件のみであることを確認
npx tsx scripts/patch-scholar-seraphism-hidden.ts --apply  # 適用
```

- [x] **Step 3: playwright-skill で dev サーバー上の実機確認**

[[reference_playwright_miti_overlays]] の手順([[reference_master_data_live_firestore]] は別件だが同様に注意)に加え、今回新たに判明した罠:
- `MitigationSelector` を開くセルクリックは `empty-liquid-glass` オーバーレイに intercept されるため `{ force: true }` が必要。
- 未選択時のプレースホルダー(「サイドバーからコンテンツを選択」)は `timelineEvents` ではなく `usePlanStore` の `currentPlanId` で判定される(`Layout.tsx` の `!currentPlanId`)。`window.__mit`(`useMitigationStore`)に加えて `window.__plan`(`usePlanStore`)も一時露出し `currentPlanId` を注入する必要がある。
- PC グリッドの列は `sortedPartyMembers` 順で、role によって列幅が変わるため、`partyMembers` の生配列インデックスとは一致しない。ヘッダーのジョブアイコン(`img[src*=Scholar]`)の x 座標に最も近いセルを選ぶことで確実に対象列を特定した。

確認結果:
1. ✅ セラフィズム(t=10, duration=20)有効中、学者(H1)のセルを開くと「鼓舞激励の策」ではなく「マニフェステーション」が表示された(`document.body.innerText` で確認)。
2. ✅ 「鼓舞激励の策」という文字列はモーダル内に出現しない(重複選択肢なし)。
3. ✅ Firestore パッチ適用前は React の重複key警告(`accession`/`manifestation`)が発生したが、パッチ適用後は警告消失。
4. ✅ マニフェステーションをクリック→対象(MT)を選択→配置後、`timelineMitigations` に `{ mitigationId: 'manifestation', time: 10 }` が実際に追加されることをストア state から確認。タイムライン上にもアイコンが表示された。
5. スマホ表示・展開戦術のコピー対象拡張・秘策の対象修正は単体テスト(Task 1/4)でカバー済みのため、Playwrightでの追加確認は省略(既存のプロジェクト慣習として `Timeline.tsx` 全体をレンダーするテストは書かない・重い E2E より unit test を優先する方針に合わせた)。

デバッグ用に `main.tsx` へ一時追加した `window.__mit`/`window.__plan` 露出コードは確認後に削除済み(コミット対象に含めない)。

- [x] **Step 4: 問題があれば修正して該当タスクへ戻る。問題無ければ次タスクへ。**

問題なし。次タスクへ。

---

### Task 6: 本番反映

**Files:** なし(デプロイ作業のみ)

- [x] **Step 1: main へマージ済みであることを確認し、リモートへ push**

```bash
git push origin main
```
結果: `d2174d83..e27b4429 main -> main` 成功。

- [x] **Step 2: Vercel の自動デプロイ完了を確認**

([[reference_vercel_git_autodeploy]]: push で自動デプロイされる。手動 `vercel --prod` 不要)
結果: `vercel inspect --wait` で Production デプロイが `● Ready` になったことを確認。

- [x] **Step 3: 本番URLで簡易確認(200応答・該当画面が開けること)**

結果: `https://lopoly.app/` および `https://lopoly.app/miti` ともに 200。

---

### Task 7: アプデ告知文の作成(Discord + アプリ内)

**Files:** なし(文面をユーザーに引き継ぐのみ。Claude からの直接投稿はしない)

対象3件:
1. 共同編集: オーナー自動判別 + 人数変更確定ボタン(`docs/TODO_COMPLETED.md` 2026-08-07/08 分)
2. データ安全性の修正(別プランのデータ混入バグ + プラン複製時のルーム引き継ぎバグ)
3. 学者: セラフィズム中のマニフェステーション/アクセッション自動変化(本タスク)

- [x] **Step 1: Discord 告知文を作成**

[[feedback_discord_announcement_tone]] の現行様式(`@silent`+🛠️ヘッダーTOC+セクション見出し+`・`bullet+たまに`(((...)))`)に従って作成。

- [x] **Step 2: アプリ内告知(`system_notifications`)用の title/body(ja/en/ko/zh)を作成**

`SystemNotifCreatePayload`([types/systemNotification.ts](../../../src/types/systemNotification.ts))の形式に合わせて作成。型上の必須は ja/en のみだが、既存の多言語対応方針に合わせ ko/zh も用意(スキル名は mockData.ts の既存訳語と一致させた)。

- [x] **Step 3: 両方をコピペ1ブロックでユーザーに引き継ぎ、公開作業(Discord投稿 / `/admin` システム通知パネルでの作成)はユーザーに依頼する**

[[feedback_shell_commands]] に合わせ、Claude が直接投稿・本番Firestoreへの通知作成は行わない。
