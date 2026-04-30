# スキルモード切替インフラ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 8.0 拡張時のスキル仕様分岐に備えたインフラを、既存機能を一切壊さずに導入する。

**Architecture:** `Mitigation` と `PartyMember` に Optional フィールドを追加し、新規ユーティリティ `resolveMitigation(m, mode)` で差分マージする単一動線を作る。UI / admin / Firestore 一切触らない。

**Tech Stack:** TypeScript 5.9 / Vitest 4.1 (globals: true) / Zustand 5 / React 19

**Spec:** [`docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md`](../specs/2026-04-30-skill-mode-infrastructure-design.md)

**Critical Rule:** **各 Phase 末で `npm run build` と `npm run test` の両方が PASS することを必ず確認**。1 つでも落ちたらそのフェーズで停止し、次フェーズに進まない。

---

## File Structure

### 新規作成
- `src/utils/mitigationResolver.ts` — 差分マージ・モード解決ユーティリティ
- `src/utils/__tests__/mitigationResolver.test.ts` — resolveMitigation / getMode 単体テスト
- `src/utils/__tests__/skillModeCompatibility.test.ts` — 既存挙動互換性ガードテスト

### 変更（型 Optional 追加）
- `src/types/index.ts` — `Mitigation.modes?` と `PartyMember.mode?` 追加

### 変更（resolveMitigation 経由に書き換え）
- `src/utils/autoPlanner.ts` — memberSkills 生成時 + simDamage 内で mode 解決
- `src/utils/resourceTracker.ts` — resourceCost 参照箇所で mode 解決
- `src/store/useMitigationStore.ts` — resolveShieldLinks / requires チェック / updatePartyBulk 内 job 移行で mode 解決

### 変更（DEFAULT_NEW_MODE 注入）
- `src/store/useMitigationStore.ts` — `INITIAL_PARTY` 配列に `mode: DEFAULT_NEW_MODE` 追加

### 触らないファイル（明示）
- すべての UI コンポーネント (`src/components/**`)
- すべての admin 画面 (`src/components/admin/**`)
- すべての api/* サーバーサイドコード
- `src/utils/calculator.ts` — Mitigation の生フィールドを直接読まない（AppliedMitigation のスナップショット値で動く）
- `src/utils/jobMigration.ts` — `family` 属性は mode 非依存
- Firestore ドキュメント・スキーマ

---

## Phase 1: 型 Optional フィールド追加

**目的:** TypeScript 上のフック（型）を整える。実装ロジックは一切触らない。既存挙動 100% 維持。

### Task 1.1: Mitigation 型に modes フィールド追加

**Files:**
- Modify: `src/types/index.ts:32-70`

- [ ] **Step 1: `Mitigation` インターフェースの末尾に `modes?` を追加**

`src/types/index.ts` の `Mitigation` インターフェース（既存フィールド `copiesShield?: string;` の直後）に以下を追加：

```ts
    /**
     * スキルモード別の差分。Optional。
     * 未指定: 両モードで基本データを使用（互換）
     * `evolved` キーに Partial<Mitigation> を指定で上書きマージ
     * `evolved: { disabled: true }` でエヴォルヴモードでは存在しないスキル扱い
     * 詳細: docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md
     */
    modes?: {
        evolved?: Partial<Mitigation> | { disabled: true };
    };
```

- [ ] **Step 2: build 通過確認**

Run: `npm run build`
Expected: 警告ゼロで通過。型エラーなし。

- [ ] **Step 3: 既存テスト全 PASS 確認**

Run: `npm run test`
Expected: 既存 253 件全 PASS。テスト追加なし、変更なしの段階で挙動変化ゼロ。

### Task 1.2: PartyMember 型に mode フィールド追加

**Files:**
- Modify: `src/types/index.ts:138-144`

- [ ] **Step 1: `PartyMember` インターフェースの末尾に `mode?` を追加**

`src/types/index.ts` の `PartyMember` インターフェース（既存 `computedValues: Record<string, number>;` の直後）に以下を追加：

```ts
    /**
     * このメンバーのスキルモード。Optional。
     * 未指定時は 'reborn' フォールバック（既存プラン互換性のため永久に reborn 固定）。
     * 新規作成時は DEFAULT_NEW_MODE（src/utils/mitigationResolver.ts）が書き込まれる。
     */
    mode?: 'reborn' | 'evolved';
```

- [ ] **Step 2: build 通過確認**

Run: `npm run build`
Expected: 警告ゼロで通過。

- [ ] **Step 3: 既存テスト全 PASS 確認**

Run: `npm run test`
Expected: 既存 253 件全 PASS。

- [ ] **Step 4: コミット**

```bash
rtk git add src/types/index.ts
rtk git commit -m "$(cat <<'EOF'
feat(types): スキルモード切替インフラ Phase 1 - Optional 型フィールド追加

Mitigation.modes? と PartyMember.mode? を追加。両方 Optional のため
既存データ・既存コードに影響なし。実装ロジックは Phase 2 以降。

Spec: docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2: mitigationResolver.ts 新規作成 + 単体テスト

**目的:** 差分マージ・モード解決の中核ユーティリティを TDD で実装。完全独立・完全テスト網羅。

### Task 2.1: 失敗テストファイル作成

**Files:**
- Create: `src/utils/__tests__/mitigationResolver.test.ts`

- [ ] **Step 1: テストファイルを作成**

`src/utils/__tests__/mitigationResolver.test.ts`：

```ts
// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
// 純粋関数のため firebase / store mock 不要。
import {
    DEFAULT_NEW_MODE,
    getMode,
    resolveMitigation,
    type SkillMode,
} from '../mitigationResolver';
import type { Mitigation, PartyMember } from '../../types';

// 共通フィクスチャ
const baseMit = (over: Partial<Mitigation> = {}): Mitigation => ({
    id: 'rampart',
    jobId: 'pld',
    name: { ja: 'ランパート', en: 'Rampart' },
    icon: '/icons/rampart.png',
    recast: 90,
    duration: 20,
    type: 'all',
    value: 20,
    ...over,
});

const baseMember = (over: Partial<PartyMember> = {}): PartyMember => ({
    id: 'MT',
    jobId: 'pld',
    role: 'tank',
    stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
    computedValues: {},
    ...over,
});

describe('DEFAULT_NEW_MODE', () => {
    it("現在は 'reborn' （8.0 リリース時に 'evolved' へ切替予定）", () => {
        expect(DEFAULT_NEW_MODE).toBe('reborn');
    });
});

describe('getMode', () => {
    it("mode 未指定なら 'reborn' フォールバック", () => {
        expect(getMode(baseMember({ mode: undefined }))).toBe('reborn');
    });

    it("mode === 'reborn' ならそのまま 'reborn'", () => {
        expect(getMode(baseMember({ mode: 'reborn' }))).toBe('reborn');
    });

    it("mode === 'evolved' ならそのまま 'evolved'", () => {
        expect(getMode(baseMember({ mode: 'evolved' }))).toBe('evolved');
    });
});

describe('resolveMitigation', () => {
    describe('差分なし', () => {
        it('reborn モードで入力と完全一致', () => {
            const m = baseMit();
            expect(resolveMitigation(m, 'reborn')).toBe(m);
        });

        it('evolved モードでも入力と完全一致（modes 未定義）', () => {
            const m = baseMit();
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });

        it('modes は定義あり・evolved キーなしでも入力と完全一致', () => {
            const m = baseMit({ modes: {} });
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });
    });

    describe('差分あり', () => {
        it('reborn モードでは差分を無視', () => {
            const m = baseMit({ modes: { evolved: { value: 30 } } });
            const result = resolveMitigation(m, 'reborn');
            expect(result).toBe(m);
            expect(result?.value).toBe(20);
        });

        it('evolved モードで数値フィールドが上書きされる', () => {
            const m = baseMit({
                value: 20,
                modes: { evolved: { value: 30, recast: 60 } },
            });
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBe(m); // 別オブジェクト（spread の結果）
            expect(result?.value).toBe(30);
            expect(result?.recast).toBe(60);
            expect(result?.duration).toBe(20); // 差分なしフィールドは保持
            expect(result?.id).toBe('rampart'); // id 等他フィールドも保持
        });

        it('evolved モードで scope 等のリテラル型も上書きされる', () => {
            const m = baseMit({
                scope: 'party',
                modes: { evolved: { scope: 'target' } },
            });
            expect(resolveMitigation(m, 'evolved')?.scope).toBe('target');
        });

        it('evolved モードで isShield / shieldScale が後付けされる', () => {
            const m = baseMit({
                isShield: false,
                modes: { evolved: { isShield: true, shieldScale: '20% HP' } },
            });
            const result = resolveMitigation(m, 'evolved');
            expect(result?.isShield).toBe(true);
            expect(result?.shieldScale).toBe('20% HP');
        });
    });

    describe('disabled (エヴォルヴでスキル消滅)', () => {
        it('evolved + disabled: true なら null', () => {
            const m = baseMit({ modes: { evolved: { disabled: true } } });
            expect(resolveMitigation(m, 'evolved')).toBeNull();
        });

        it('reborn では disabled を無視して入力と完全一致', () => {
            const m = baseMit({ modes: { evolved: { disabled: true } } });
            expect(resolveMitigation(m, 'reborn')).toBe(m);
        });
    });

    describe('純粋性', () => {
        it('入力 Mitigation を破壊変更しない', () => {
            const m = baseMit({ modes: { evolved: { value: 99 } } });
            const before = JSON.stringify(m);
            resolveMitigation(m, 'evolved');
            expect(JSON.stringify(m)).toBe(before);
        });
    });

    describe('モード型網羅', () => {
        it('SkillMode リテラル型は reborn/evolved の 2 値のみ受け付ける', () => {
            const modes: SkillMode[] = ['reborn', 'evolved'];
            for (const mode of modes) {
                expect(resolveMitigation(baseMit(), mode)).toBeTruthy();
            }
        });
    });
});
```

- [ ] **Step 2: テスト実行で失敗確認**

Run: `npm run test -- mitigationResolver`
Expected: FAIL — `Cannot find module '../mitigationResolver'` （ファイル未作成のため import エラー）

### Task 2.2: mitigationResolver.ts 実装

**Files:**
- Create: `src/utils/mitigationResolver.ts`

- [ ] **Step 1: ファイル作成**

`src/utils/mitigationResolver.ts`：

```ts
import type { Mitigation, PartyMember } from '../types';

/**
 * スキルモード（リボーン / エヴォルヴ）。
 * - reborn: 旧モード。基本データそのまま
 * - evolved: 新モード（8.0 想定）。Mitigation.modes.evolved の差分を適用
 */
export type SkillMode = 'reborn' | 'evolved';

/**
 * 新規 PartyMember 作成時に書き込むデフォルトモード。
 *
 * 8.0 リリース時にこの 1 行を 'evolved' に変更してデフォルト切替する。
 * 注意: 既存プラン（mode フィールド未指定）には影響しない。
 *      getMode() のフォールバックは互換性保証のため永久に 'reborn' 固定。
 */
export const DEFAULT_NEW_MODE: SkillMode = 'reborn';

/**
 * PartyMember のスキルモードを取得する。
 *
 * 未指定時は 'reborn' を返す。このフォールバック値は既存プラン互換性のため
 * 永久に変更しない（DEFAULT_NEW_MODE と独立）。
 */
export function getMode(member: PartyMember): SkillMode {
    return member.mode ?? 'reborn';
}

/**
 * Mitigation を指定モードで解決し、差分を適用したオブジェクトを返す。
 *
 * - reborn: 入力をそのまま返す（参照同一性維持）
 * - evolved + 差分なし: 入力をそのまま返す（参照同一性維持）
 * - evolved + Partial 差分: spread でマージした新オブジェクト
 * - evolved + { disabled: true }: null（エヴォルヴモードでは存在しないスキル）
 *
 * @returns 解決済み Mitigation、または disabled の場合 null
 */
export function resolveMitigation(
    m: Mitigation,
    mode: SkillMode,
): Mitigation | null {
    if (mode === 'reborn') return m;
    const diff = m.modes?.evolved;
    if (!diff) return m;
    if ('disabled' in diff && diff.disabled === true) return null;
    return { ...m, ...(diff as Partial<Mitigation>) };
}
```

- [ ] **Step 2: テスト実行で全 PASS 確認**

Run: `npm run test -- mitigationResolver`
Expected: 全テスト PASS（DEFAULT_NEW_MODE 1件 + getMode 3件 + resolveMitigation 各 describe 計 11件 = 15件）

- [ ] **Step 3: 全体 build + test 確認**

Run: `npm run build && npm run test`
Expected: build 通過、既存 253 + 新規 15 = 268 件全 PASS

- [ ] **Step 4: コミット**

```bash
rtk git add src/utils/mitigationResolver.ts src/utils/__tests__/mitigationResolver.test.ts
rtk git commit -m "$(cat <<'EOF'
feat(utils): スキルモード切替インフラ Phase 2 - resolveMitigation 実装

差分マージ・モード解決の中核ユーティリティを TDD で実装。
- DEFAULT_NEW_MODE: 新規 PartyMember のデフォルトモード（現状 reborn）
- getMode(member): フォールバック reborn 固定（互換保証）
- resolveMitigation(m, mode): 差分マージ、disabled なら null

完全独立、テスト 15 件、既存コードへの影響ゼロ。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3: 計算ロジックを resolveMitigation 経由に書き換え

**目的:** Mitigation の生フィールドを読んでいる箇所を `resolveMitigation` 経由に切り替える。各タスクで build + test PASS を必ず確認。1 ファイルずつコミット。

**書き換えパターン**:
- Member コンテキストがある場所: `resolveMitigation(m, getMode(member))`
- AppliedMitigation から逆引きが必要な場所: appliedMitigation.ownerId → party から member 検索 → mode 取得

### Task 3.1: autoPlanner.ts memberSkills 生成箇所を書き換え

**Files:**
- Modify: `src/utils/autoPlanner.ts:55-73`

- [ ] **Step 1: import に resolveMitigation / getMode 追加**

`src/utils/autoPlanner.ts` ファイル冒頭の import：

```ts
import { getMitigationsFromStore } from '../hooks/useSkillsData';
import { resolveMitigation, getMode } from './mitigationResolver';
```

- [ ] **Step 2: memberSkills 生成ロジックを mode 解決込みに変更**

`src/utils/autoPlanner.ts:55-73` 付近を以下に書き換え：

```ts
    // スキルキャッシュ（生 Mitigation。配置・Lookup 共通）
    const mitigations = getMitigationsFromStore();
    const mitiCache = new Map<string, Mitigation>();
    for (const m of mitigations) mitiCache.set(m.id, m);
    const getMiti = (id: string) => mitiCache.get(id);

    // パッセージ・オブ・アームズはオート配置から除外
    const EXCLUDED = new Set(['passage_of_arms']);

    // メンバーごとの所持スキル（レベル・ジョブ・モードでフィルタ）
    const memberSkills = new Map<string, Mitigation[]>();
    for (const member of party) {
        const mode = getMode(member);
        const skills = mitigations
            .filter(m => {
                if (m.minLevel !== undefined && level < m.minLevel) return false;
                if (m.maxLevel !== undefined && level > m.maxLevel) return false;
                return m.jobId === member.jobId || m.jobId === member.role || m.jobId === 'role_action';
            })
            .filter(m => !EXCLUDED.has(m.id))
            .map(m => resolveMitigation(m, mode))
            .filter((m): m is Mitigation => m !== null); // disabled スキル除外
        memberSkills.set(member.id, skills);
    }
```

- [ ] **Step 3: build + test 確認**

Run: `npm run build && npm run test`
Expected: build 通過、既存 + 新規テスト全 PASS（mode 未指定の既存テストは reborn fallback で挙動変化ゼロ）

- [ ] **Step 4: simDamage 内の getMiti 呼び出しを mode 解決対応に変更**

`src/utils/autoPlanner.ts:91-117` 付近の `simDamage` を以下に書き換え：

```ts
    // ダメージシミュレーション（軽減・シールド・無敵を考慮）
    const simDamage = (
        eventTime: number,
        rawDmg: number,
        target: 'MT' | 'ST' | 'AoE',
        state: AppliedMitigation[]
    ): number => {
        let mult = 1;
        let shield = 0;
        for (const a of state) {
            const rawMiti = getMiti(a.mitigationId);
            if (!rawMiti) continue;
            // owner のモードで解決
            const owner = party.find(p => p.id === a.ownerId);
            const mode = owner ? getMode(owner) : 'reborn';
            const m = resolveMitigation(rawMiti, mode);
            if (!m) continue; // disabled
            if (eventTime < a.time || eventTime > a.time + a.duration) continue;

            // 無敵スキル判定
            if (m.isInvincible && (a.ownerId === target || a.targetId === target)) return 0;

            if ((m.value > 0 || m.isShield) &&
                (m.scope === 'party' || m.scope === undefined || a.ownerId === target || a.targetId === target)) {
                if (m.isShield) {
                    shield += (target === 'AoE' ? hpBase.dps : hpBase.tank) * (m.value / 100);
                } else if (m.value > 0) {
                    mult *= (1 - m.value / 100);
                }
            }
        }
        return Math.max(0, rawDmg * mult - shield);
    };
```

- [ ] **Step 5: build + test 確認**

Run: `npm run build && npm run test`
Expected: 全 PASS。既存 autoPlanner テストが reborn fallback で挙動一致を維持。

- [ ] **Step 6: コミット**

```bash
rtk git add src/utils/autoPlanner.ts
rtk git commit -m "$(cat <<'EOF'
feat(autoPlanner): スキルモード切替インフラ Phase 3.1 - autoPlanner mode 対応

memberSkills 生成と simDamage で resolveMitigation を経由。
mode 未指定のメンバーは reborn fallback で既存挙動完全維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: resourceTracker.ts を mode 解決対応に変更

**Files:**
- Modify: `src/utils/resourceTracker.ts`

**注意:** resourceTracker の関数群は `(time, placedMitigations)` シグネチャで member 情報を持たない。AppliedMitigation の ownerId から party を辿る必要がある。party は外部から渡してもらう必要があり、シグネチャ変更は影響範囲が広いため、本タスクでは **保守的アプローチ** を採用：

- **方針**: `def?.resourceCost?.type` 等のチェックは mode 解決前後で結果が変わらないと仮定（resourceCost 構造の変化は事前洗い出し時に出ていない）
- **フックポイントだけ用意**: コメントで「将来 mode 解決が必要になったら resolveMitigation を通す」と明記
- **8.0 でリソース構造が変わった時点で改修**：このプランの範囲外

- [ ] **Step 1: コメントで将来拡張ポイントを明示**

`src/utils/resourceTracker.ts` の冒頭コメント直後（10 行目あたり）に以下を追加：

```ts
/**
 * MODE 解決について:
 * 現在 resourceCost 構造（type / amount）はモード差分対象外と判断し、
 * 生 Mitigation の resourceCost を直接読んでいる。
 * 8.0 で resourceCost 構造が分岐する場合、関数シグネチャに party を追加し
 * resolveMitigation(def, getMode(owner)) 経由に切り替える。
 * Spec: docs/superpowers/specs/2026-04-30-skill-mode-infrastructure-design.md
 */
```

- [ ] **Step 2: build + test 確認**

Run: `npm run build && npm run test`
Expected: コメント追加のみのため挙動変化ゼロ、全 PASS。

- [ ] **Step 3: コミット**

```bash
rtk git add src/utils/resourceTracker.ts
rtk git commit -m "$(cat <<'EOF'
docs(resourceTracker): スキルモード切替インフラ Phase 3.2 - 将来 mode 解決ポイントを明記

resourceCost は現状モード差分対象外。8.0 でリソース構造が分岐した時点で
party 引数追加 + resolveMitigation 経由に改修する旨をコメントで残す。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: useMitigationStore.ts の Mitigation 参照箇所を確認

**Files:**
- Modify: `src/store/useMitigationStore.ts:815`, `:1010-1023`

**方針:** `useMitigationStore.ts` の Mitigation 参照は以下 2 箇所：

1. **`requires` 前提スキル削除依存チェック**（line 815）: `d.requires === removed.mitigationId` という ID 比較のみ。値（数値・scope）を読まないため mode 解決不要。
2. **updatePartyBulk 内 job 移行**（line 1010-1023）: `def?.jobId === jobId` という ID/jobId 比較のみ。値を読まない。

両方 mode 非依存。**書き換えなし**。ただしコメントで根拠を残す。

- [ ] **Step 1: line 815 付近にコメント追加**

`src/store/useMitigationStore.ts:815` の直前（既存コメント `// Find skills that depend on the removed skill` の上）に追加：

```ts
                        // requires チェックは ID 比較のみで Mitigation の値（value/recast 等）を読まないため、
                        // モード解決不要。詳細は spec 参照。
```

- [ ] **Step 2: line 1010 付近にコメント追加**

`src/store/useMitigationStore.ts:1010` の直前（`const def = getMitigationsFromStore().find(...)` の上）に追加：

```ts
                                    // job 移行は jobId / id の比較のみで、Mitigation の値を読まないためモード解決不要。
```

- [ ] **Step 3: build + test 確認**

Run: `npm run build && npm run test`
Expected: コメント追加のみのため全 PASS。

- [ ] **Step 4: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "$(cat <<'EOF'
docs(store): スキルモード切替インフラ Phase 3.3 - mode 非依存箇所を明記

requires 依存チェック（line 815）と updatePartyBulk job 移行（line 1010）は
ID/jobId 比較のみで Mitigation の値を読まない。書き換え不要の根拠を
コメントで明記。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.4: calculator.ts の確認（書き換えなし）

**Files:**
- (Read-only verification): `src/utils/calculator.ts`

**方針:** 依存調査結果から、`calculator.ts` は `Mitigation` 型を import しておらず、`AppliedMitigation` のスナップショット値（`isShield`, `duration`, `time` 等）で動く。Mitigation の生フィールドを読まないため mode 解決不要。

- [ ] **Step 1: 確認のみ。書き換えなし**

Run: `grep -n "Mitigation\|mitigation\." src/utils/calculator.ts`
Expected: `Mitigation` 型 import なし。`mitigation.value` 等の生フィールド参照なし。`AppliedMitigation` の `mitigationId` / `time` / `duration` のみ。

スキップしてコミットなし、Phase 3 完了。

---

## Phase 4: INITIAL_PARTY に DEFAULT_NEW_MODE 注入

**目的:** 新規 PartyMember 作成時にデフォルトモードを明示的に書き込む。既存メンバーの更新は spread で自動継承されるため対象外。

**重要:** `setMemberJob` / `changeMemberJobWithMitigations` / `updatePartyBulk` は **既存メンバーの更新** であり、`{ ...m, ... }` パターンで mode フィールドが自動継承される。新規追加・書き込みは行わない（古いプランを編集しただけで mode が勝手に書き込まれるのを防ぐ）。

### Task 4.1: INITIAL_PARTY に mode 追加

**Files:**
- Modify: `src/store/useMitigationStore.ts:167-176`

- [ ] **Step 1: import に DEFAULT_NEW_MODE 追加**

`src/store/useMitigationStore.ts` の既存 import 群（`useSkillsData` import 付近）に追加：

```ts
import { DEFAULT_NEW_MODE } from '../utils/mitigationResolver';
```

- [ ] **Step 2: INITIAL_PARTY 全 8 メンバーに mode 追加**

`src/store/useMitigationStore.ts:167-176` を以下に書き換え：

```ts
// Initial Party Slots
const INITIAL_PARTY: PartyMember[] = [
    { id: 'MT', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'ST', jobId: null, role: 'tank',   stats: { ...getDefaultTankStats() },   computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H1', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'H2', jobId: null, role: 'healer', stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D1', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D2', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D3', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
    { id: 'D4', jobId: null, role: 'dps',    stats: { ...getDefaultHealerStats() }, computedValues: {}, mode: DEFAULT_NEW_MODE },
];
```

- [ ] **Step 3: build + test 確認**

Run: `npm run build && npm run test`
Expected: 全 PASS。新規プラン作成時のみ mode が書き込まれ、既存プランは影響なし（persist middleware が localStorage から既存メンバーを復元するため、`mode` 未指定のままになる → fallback で reborn 扱い）。

- [ ] **Step 4: コミット**

```bash
rtk git add src/store/useMitigationStore.ts
rtk git commit -m "$(cat <<'EOF'
feat(store): スキルモード切替インフラ Phase 4 - INITIAL_PARTY に mode 注入

新規 PartyMember 作成時に DEFAULT_NEW_MODE（現状 'reborn'）を書き込む。
既存メンバーの更新は spread で自動継承されるため touch しない。
古いプラン（mode 未指定）はロード時の fallback で reborn 扱いを維持。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5: 互換性ガードテスト + 網羅テスト + 最終確認

**目的:** 「既存挙動が破損していないこと」を構造的に保証するテスト群を追加。想定外ケースを徹底的に洗い出して潰す。

### Task 5.1: 互換性ガードテスト作成

**Files:**
- Create: `src/utils/__tests__/skillModeCompatibility.test.ts`

- [ ] **Step 1: 互換性ガードテストファイル作成**

`src/utils/__tests__/skillModeCompatibility.test.ts`：

```ts
// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
// 既存挙動互換性ガード: スキルモード切替インフラ追加によって既存プランの計算結果が
// 変わっていないことを構造的に保証する。
import { resolveMitigation, getMode, DEFAULT_NEW_MODE } from '../mitigationResolver';
import type { Mitigation, PartyMember } from '../../types';

describe('既存プラン互換性ガード', () => {
    describe('mode 未指定 PartyMember は reborn 扱い', () => {
        it('mode フィールド完全欠落 → reborn', () => {
            const member: PartyMember = {
                id: 'MT',
                jobId: 'pld',
                role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
                // mode 未定義
            };
            expect(getMode(member)).toBe('reborn');
        });

        it('mode = undefined（明示） → reborn', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {}, mode: undefined,
            };
            expect(getMode(member)).toBe('reborn');
        });
    });

    describe('modes 未指定 Mitigation は両モードで入力一致', () => {
        const baseMit: Mitigation = {
            id: 'rampart', jobId: 'pld',
            name: { ja: 'ランパート', en: 'Rampart' },
            icon: '/icons/rampart.png',
            recast: 90, duration: 20, type: 'all', value: 20,
        };

        it('reborn で入力と参照同一性維持', () => {
            expect(resolveMitigation(baseMit, 'reborn')).toBe(baseMit);
        });

        it('evolved で入力と参照同一性維持（modes 無し）', () => {
            expect(resolveMitigation(baseMit, 'evolved')).toBe(baseMit);
        });
    });

    describe('DEFAULT_NEW_MODE 値固定（8.0 リリースまで変更禁止）', () => {
        it("リリース前は 'reborn' であること（誤って 'evolved' に変更されると既存プラン破損）", () => {
            expect(DEFAULT_NEW_MODE).toBe('reborn');
        });
    });

    describe('localStorage 旧データシミュレーション', () => {
        it('mode フィールド無しの partyMembers JSON をロードしても getMode が reborn を返す', () => {
            // 旧プラン JSON（実際の localStorage シリアライズ形式）
            const oldPlanJson = JSON.stringify({
                partyMembers: [
                    { id: 'MT', jobId: 'pld', role: 'tank',
                      stats: { hp: 299000, mainStat: 5000, det: 2000, crt: 2500, ten: 1500, ss: 400, wd: 130 },
                      computedValues: { hp: 299000 } },
                ],
            });
            const restored = JSON.parse(oldPlanJson) as { partyMembers: PartyMember[] };
            expect(getMode(restored.partyMembers[0])).toBe('reborn');
        });
    });

    describe('全 Mitigation フィールドの差分上書き網羅', () => {
        const fullMit: Mitigation = {
            id: 'sample', jobId: 'pld',
            name: { ja: 'サンプル', en: 'Sample' },
            icon: '/icons/sample.png',
            recast: 60, duration: 15, type: 'magical', value: 10,
            valuePhysical: 5, valueMagical: 15, isShield: false,
            valueType: 'hp', minLevel: 50, maxLevel: 100,
            scope: 'party', isInvincible: false, healingIncrease: 20,
            healingIncreaseDuration: 10, healingIncreaseSelfOnly: false,
            requires: 'parent', requiresWindow: 5,
            resourceCost: { type: 'aetherflow', amount: 1 },
            maxCharges: 2, family: 'samples', stacks: 3,
            reapplyOnAbsorption: true, onExpiryHealingPotency: 100,
            burstValue: 5, burstDuration: 4,
            exclusiveWith: 'other_sample', hidden: false,
            requiresFairy: false, targetCannotBeSelf: false,
            copiesShield: 'parent_shield',
        };

        const allFieldOverrides: Partial<Mitigation> = {
            recast: 120, duration: 30, type: 'all', value: 25,
            valuePhysical: 15, valueMagical: 30, isShield: true,
            scope: 'self', isInvincible: true, healingIncrease: 50,
            maxCharges: 3, stacks: 5,
        };

        it('すべての主要フィールドが evolved で上書き可能', () => {
            const m: Mitigation = { ...fullMit, modes: { evolved: allFieldOverrides } };
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
            for (const [key, value] of Object.entries(allFieldOverrides)) {
                expect(result![key as keyof Mitigation]).toEqual(value);
            }
        });

        it('reborn では差分が 1 つも適用されない', () => {
            const m: Mitigation = { ...fullMit, modes: { evolved: allFieldOverrides } };
            const result = resolveMitigation(m, 'reborn');
            expect(result).toBe(m);
            for (const [key, originalValue] of Object.entries(fullMit)) {
                if (key === 'modes') continue;
                expect(result![key as keyof Mitigation]).toEqual(originalValue);
            }
        });
    });

    describe('disabled スキルの伝播', () => {
        it('evolved で disabled → resolveMitigation が null → filter で除外される', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: '消えるスキル', en: 'Disappearing Skill' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { disabled: true } },
            };
            const all = [m];
            const filtered = all
                .map(x => resolveMitigation(x, 'evolved'))
                .filter((x): x is Mitigation => x !== null);
            expect(filtered).toHaveLength(0);
        });

        it('reborn では disabled が無視されてスキルが残る', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: '消えるスキル', en: 'Disappearing Skill' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { disabled: true } },
            };
            const all = [m];
            const filtered = all
                .map(x => resolveMitigation(x, 'reborn'))
                .filter((x): x is Mitigation => x !== null);
            expect(filtered).toHaveLength(1);
        });
    });

    describe('Mitigation 純粋性（破壊変更なし）', () => {
        it('resolveMitigation を 100 回呼んでも入力 Mitigation のフィールドが変わらない', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: 'サンプル', en: 'Sample' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { value: 99 } },
            };
            const before = JSON.stringify(m);
            for (let i = 0; i < 100; i++) {
                resolveMitigation(m, 'evolved');
                resolveMitigation(m, 'reborn');
            }
            expect(JSON.stringify(m)).toBe(before);
        });
    });

    describe('PartyMember 純粋性（getMode は破壊変更しない）', () => {
        it('getMode を呼んでも mode フィールドが書き込まれない', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect('mode' in member).toBe(false);
            getMode(member);
            expect('mode' in member).toBe(false); // フィールド注入されていない
        });
    });
});
```

- [ ] **Step 2: テスト実行で全 PASS 確認**

Run: `npm run test -- skillModeCompatibility`
Expected: 全テスト PASS（13 件程度）

- [ ] **Step 3: 全体 build + test 確認**

Run: `npm run build && npm run test`
Expected: build 通過、既存 + Phase 2 + Phase 5 のテスト全 PASS

### Task 5.2: 想定外ケース潰し — シナリオベース統合テスト

**Files:**
- Modify: `src/utils/__tests__/skillModeCompatibility.test.ts`

- [ ] **Step 1: シナリオテスト追加**

ファイル末尾の最後の `});` の前（最後の describe 終了直前）に以下を追加：

```ts
    describe('想定外ケース統合テスト', () => {
        it('パーティ内 mode 混在: MT=reborn / ST=evolved / H1=未指定（→ reborn）', () => {
            const party: PartyMember[] = [
                { id: 'MT', jobId: 'pld', role: 'tank',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {}, mode: 'reborn' },
                { id: 'ST', jobId: 'war', role: 'tank',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {}, mode: 'evolved' },
                { id: 'H1', jobId: 'whm', role: 'healer',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {} }, // mode 未指定
            ];
            expect(getMode(party[0])).toBe('reborn');
            expect(getMode(party[1])).toBe('evolved');
            expect(getMode(party[2])).toBe('reborn');
        });

        it('差分なしの空 modes オブジェクトでも reborn 扱い', () => {
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                modes: {}, // evolved キーなし
            };
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });

        it('差分が空オブジェクト {} でも入力と参照同一性維持はせず spread のみ', () => {
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                modes: { evolved: {} }, // 空 Partial
            };
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
            expect(result!.value).toBe(20); // 値変化なし
            expect(result!.recast).toBe(90);
        });

        it('disabled: false（明示）は無効化扱いではない（型エラーにならず通常スキル）', () => {
            // 注: { disabled: true } のみ無効化判定。false は無視される
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                // @ts-expect-error: disabled: false は型上 { disabled: true } と矛盾するため
                modes: { evolved: { disabled: false } },
            };
            // ランタイムでは disabled === true のみチェック → null にならない
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
        });

        it('persist middleware merge シミュレーション: 旧 partyMembers + 新 INITIAL_PARTY マージ', () => {
            // localStorage 復元: mode 無しの旧データ
            const persistedMember: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: { hp: 299000 },
            };
            // store の merge ロジックは partyMembers をそのまま採用（mode 無し）
            // → getMode で reborn fallback
            expect(getMode(persistedMember)).toBe('reborn');
            // → 新規メンバー作成パスに乗らないため mode は書き込まれない（互換維持）
            expect('mode' in persistedMember).toBe(false);
        });

        it('共有リンク経由で受け取った旧プランのメンバー（mode 無し）も reborn 扱い', () => {
            // api/share GET レスポンスで mode フィールドが落ちている想定
            const sharedMember: PartyMember = {
                id: 'D1', jobId: 'rdm', role: 'dps',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect(getMode(sharedMember)).toBe('reborn');
        });

        it('Firestore 復元時の mode 欠落: undefined を許容する', () => {
            // Firestore 旧ドキュメント: mode フィールドが存在しない
            const firestoreDoc = {
                id: 'H2', jobId: 'sch', role: 'healer' as const,
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect(getMode(firestoreDoc as PartyMember)).toBe('reborn');
        });

        it('JSON.stringify ラウンドトリップで mode が保持される（明示指定時）', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {}, mode: 'evolved',
            };
            const restored: PartyMember = JSON.parse(JSON.stringify(member));
            expect(getMode(restored)).toBe('evolved');
        });

        it('複数 mitigations を mode フィルタ通すパフォーマンス検証（線形時間）', () => {
            const mitigations: Mitigation[] = Array.from({ length: 100 }, (_, i) => ({
                id: `skill_${i}`, jobId: 'pld',
                name: { ja: `スキル${i}`, en: `Skill${i}` },
                icon: '/icons/x.png',
                recast: 60 + i, duration: 15, type: 'all', value: 10 + (i % 20),
            }));
            const start = performance.now();
            const filtered = mitigations
                .map(m => resolveMitigation(m, 'evolved'))
                .filter((m): m is Mitigation => m !== null);
            const elapsed = performance.now() - start;
            expect(filtered).toHaveLength(100); // 全 mitigation modes 無し → 全通過
            expect(elapsed).toBeLessThan(50); // 100 件で 50ms 以下
        });
    });
```

- [ ] **Step 2: テスト実行で全 PASS 確認**

Run: `npm run test -- skillModeCompatibility`
Expected: 既存 13 件 + 新規 9 件 = 22 件全 PASS

- [ ] **Step 3: 全体 build + test 確認**

Run: `npm run build && npm run test`
Expected: build 通過、全テスト PASS（既存 253 + Phase 2 の 15 + Phase 5 の 22 = 約 290 件）

- [ ] **Step 4: コミット**

```bash
rtk git add src/utils/__tests__/skillModeCompatibility.test.ts
rtk git commit -m "$(cat <<'EOF'
test(compat): スキルモード切替インフラ Phase 5 - 互換性ガード + 想定外ケーステスト

既存プラン破損ゼロを構造的に保証する 22 件のテストを追加。
- mode 未指定の reborn フォールバック網羅
- modes 未指定の参照同一性維持
- 全 Mitigation フィールドの差分上書き網羅
- disabled スキル伝播
- 純粋性検証（破壊変更ゼロ）
- パーティ内 mode 混在
- localStorage / Firestore / 共有リンク復元シナリオ
- JSON ラウンドトリップ
- パフォーマンス線形時間検証

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5.3: 既存テスト分布の総点検

**Files:**
- (Read-only verification)

- [ ] **Step 1: 全テストを mode 関連で再実行**

Run: `npm run test`
Expected: 全 PASS。既存 253 件は完全に変化なし。新規 37 件（Phase 2: 15, Phase 5: 22）が追加されて緑。

- [ ] **Step 2: snapshot ファイル変化なしを確認**

Run: `rtk git status`
Expected: スナップショットファイル (`__snapshots__/`) に diff が無いこと。あれば既存テストが影響を受けた証拠 → 原因調査して修正してから次へ。

- [ ] **Step 3: TypeScript の型エラーがゼロを最終確認**

Run: `npx tsc --noEmit`
Expected: エラー出力なし。

### Task 5.4: 動作確認チェックリスト（手動）

**Files:**
- (Manual verification, no code change)

- [ ] **Step 1: dev サーバー起動して目視確認**

Run: `npm run dev`

確認項目（チェックリスト）：

- [ ] アプリが正常に起動する
- [ ] 既存プラン（localStorage に保存済み）を開いてエラー無し
- [ ] 軽減配置・削除・移動が従来通り動作
- [ ] パーティメンバーのジョブ変更が従来通り動作
- [ ] タイムライン上のシールド表示が従来と一致
- [ ] オートプラン実行が従来通り動作
- [ ] 学者エーテルフロー自動配置が従来通り動作
- [ ] 共有リンク作成・閲覧が従来通り動作
- [ ] チームロゴ設定・OGP プレビューが従来通り動作

UI 上の見た目変化が **一切ない** ことを目視確認。

- [ ] **Step 2: dev サーバー停止**

確認完了後 `Ctrl+C`。

### Task 5.5: 最終 push

- [ ] **Step 1: ローカル状態確認**

Run: `rtk git status`
Expected: clean、未コミット差分なし

- [ ] **Step 2: コミット履歴確認**

Run: `rtk git log --oneline -10`
Expected: Phase 1 / 2 / 3.1 / 3.2 / 3.3 / 4 / 5.1 / 5.2 のコミットが順に並ぶ（計 8 コミット）

- [ ] **Step 3: push**

Run: `rtk git push`
Expected: origin/main に反映、Vercel デプロイトリガー

- [ ] **Step 4: Vercel デプロイ完了確認**

Vercel Dashboard で本番デプロイ成功を確認。実機で旧プランをロードして UI に変化がないことを目視確認。

---

## 完了条件

すべての Phase が PASS した状態：

1. ✅ `npm run build` 警告ゼロ
2. ✅ `npm run test` 全 PASS（既存 253 + 新規 37 = 約 290 件）
3. ✅ TypeScript 型エラーゼロ（`tsc --noEmit`）
4. ✅ 既存スナップショットテスト変化なし
5. ✅ UI に新規要素ゼロ（手動確認）
6. ✅ 既存プランの計算結果が実装前と完全一致（互換性ガードテスト + 手動確認）
7. ✅ Vercel 本番デプロイ成功
8. ✅ 8 コミットが論理的に分割されている（Phase 1 / 2 / 3.1 / 3.2 / 3.3 / 4 / 5.1 / 5.2）

## 次セッション以降のフォローアップ

このプランの範囲外。8.0 アナウンス時に対応：

- admin 画面の差分入力 UI 追加（既存 `SkillFormModal` 拡張）
- パーティメンバーカードへのモード切替 UI 追加
- `DEFAULT_NEW_MODE` を `'evolved'` に切替（1 行変更）
- 必要なら自動配置ロジック（学者エーテルフロー / オートプラン）の mode 分岐対応
- `resourceTracker.ts` を party 引数追加 + resolveMitigation 経由に改修（リソース構造分岐時のみ）
