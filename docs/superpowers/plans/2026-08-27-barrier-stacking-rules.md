# バリアの重なり方ルール Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** FF14 実測どおりに「重ならないバリアは1枚に絞る」「バリアは固定優先順位表の順に消費する」「複数バリアが同じ被弾を受けても二重に削れない」を軽減表のダメージ計算に実装し、あわせて展開戦術のエフェクト棒を解禁する。

**Architecture:** ダメージ計算 (`Timeline.tsx` の `damageMapResult` useMemo) のバリア吸収部分を、純関数 2 つ (`resolveBarrierConflict` / `resolveContextShields`) に切り出して置き換える。`damageMapResult` 側は「その被弾・その context で効いているバリアの一覧 (entry)」を組み立てて純関数へ渡し、返ってきた state 更新・尽きた時刻・上書きされた時刻を反映する。エフェクト棒は既存の `shieldExhaustedAt` と同じ仕組みに `barrierOverwrittenAt` を足してクリップする。

**Tech Stack:** TypeScript / React / Vitest (`pool: 'vmThreads'`, environment 既定 `node`) / Vite build (`tsc -b` 厳密)

**Spec:** `docs/superpowers/specs/2026-08-27-barrier-stacking-rules-design.md`

## Global Constraints

- 会話・コメント・ドキュメントは日本語。
- ハードコーディング禁止。優先順位・グループは data 層 (`mockData.ts` の def) に持たせる。
- i18n: 新規 UI 文字列は i18n キー経由 (本 plan では新規 UI 文字列なし)。
- `tsc -b` 厳密 (未使用変数でビルドが落ちる)。push 前ゲートは `npm run build` + `npx vitest run`。開発中は変更ファイルに絞って `npx vitest run <path>`。
- フルスイートは既知のハングあり (memory `reference_vitest_vmthreads_hang`)。フルは push 直前のみ、ハングしたら kill して変更ファイル実行で代替。
- テストは `__tests__/` ディレクトリ配下に置く (memory `reference_vitest_tests_dir_and_api_src_nodenext`)。
- コミットはタスクごと。ブランチは `main` 直コミットで可 (このリポジトリの慣習)。RTK: git コマンドは `rtk git ...`、`-F -` は使わず `-m`。
- `src/components/Timeline.tsx` は巨大ファイル。分割はしない (既存方針)。純関数は別ファイルへ切り出す。
- 触ってはいけない: % 軽減の `exclusiveWith` ロジック / リビングデッド判定 / horoscope・earthly_star・WD のエフェクト棒クリップ。
- 会心の追加バリア (カタライズ / ディファレンシャル・ダイアグノシス) は別枠に分けない (鼓舞・エウクラシアの値に混ぜ込んだまま)。

---

## File Structure

| ファイル | 役割 | 変更 |
|---|---|---|
| `src/types/index.ts` | `Mitigation` 型に `barrierStackGroup?` / `barrierConsumptionPriority?` | Modify |
| `src/data/mockData.ts` | 各バリア def に上記 2 フィールドを付与 | Modify |
| `src/utils/barrierStacking.ts` | **新規**: `resolveBarrierConflict` / `resolveContextShields` / 型 | Create |
| `src/utils/__tests__/barrierStacking.test.ts` | **新規**: 上記の単体テスト | Create |
| `src/components/Timeline.tsx` | `damageMapResult` のバリア吸収ループを純関数呼び出しへ置換 / `barrierOverwrittenAt` 追加 / 展開戦術の棒解禁 / 棒クリップに `barrierOverwrittenAt` を反映 | Modify |
| `src/components/__tests__/Timeline.shieldAbsorption.test.ts` | 既存。`stepShieldAbsorption` はそのまま流用。`resolveContextShields` 経由の統合ケースを追加 | Modify |
| `src/utils/mobileEffectBar.ts` | `computeMobileEffectBars` の引数に `barrierOverwrittenAt` を追加、`effectiveEndTime` をクランプ | Modify |
| `src/utils/__tests__/mobileEffectBar.test.ts` | 既存。上書きクリップのテストを追加 | Modify |

---

## Task 1: 展開戦術のエフェクト棒を解禁

**Files:**
- Modify: `src/components/Timeline.tsx`（`MitigationItem` 内、エフェクト棒の描画条件。現在 `mitigation.duration > 1 && !def?.copiesShield &&`）

**Interfaces:**
- Consumes: なし
- Produces: なし（見た目のみ。`deployment_tactics` の `AppliedMitigation` に対して縦バーが描画されるようになる）

**背景:** [Timeline.tsx](../../../src/components/Timeline.tsx) の `MitigationItem` で、`copiesShield` スキル (=展開戦術) はエフェクト棒を非表示にしている (2026-04 commit `fc0c1193`。瞬発スキルの棒非表示とセットで入った、強い理由なし)。展開戦術のコピー分は本 plan で「全体扱いのバリア」になるので、棒を出す。長さは `deployment_tactics.duration`（自動リンクで鼓舞の残り時間に同期済み・`useMitigationStore.ts` `resolveShieldLinks`）。全体攻撃でコピー分を使い切ったら `shieldExhaustedAt` で早期終了する (既存 `b3ee21e4` の計算側変更がそのまま効く)。

- [ ] **Step 1: 現在のバー描画条件を確認**

Read: `src/components/Timeline.tsx` で `!def?.copiesShield` を検索（2 箇所: エフェクト棒本体、リキャスト点線）。現在:
```tsx
{mitigation.duration > 1 && !def?.copiesShield && (
    <div ... > {/* エフェクト棒本体 */} </div>
)}
```
リキャスト点線側は既に廃止済み (`recastPx > durationHeight && !def?.copiesShield` の行はコメントで「廃止」明記) なので触らない。エフェクト棒本体のみが対象。

- [ ] **Step 2: `!def?.copiesShield` を外す**

エフェクト棒本体の描画条件を次に変更:
```tsx
{mitigation.duration > 1 && (
    <div ... > {/* エフェクト棒本体 */} </div>
)}
```
コメントも更新:
```tsx
{/* エフェクト棒: duration≤1秒（瞬発スキル）は非表示。展開戦術(copiesShield)は
    「全体扱いのコピーバリア」を表す棒として表示する（2026-08-27 解禁）。
    ホバーでスキルアイコンだけを浮かべるツールチップ… (以降の既存コメント維持) */}
```

- [ ] **Step 3: 型確認**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 4: 関連テスト**

Run: `npx vitest run src/components/__tests__/Timeline.shieldAbsorption.test.ts src/components/__tests__/Timeline.readonly.test.tsx src/components/__tests__/Timeline.contentId.test.tsx`
Expected: 全 PASS（このタスクはロジック変更なし・回帰確認のみ）

- [ ] **Step 5: コミット**

```bash
rtk git add src/components/Timeline.tsx && rtk git commit -m "feat(mitigation): 展開戦術のエフェクト棒を解禁（コピーバリアを全体扱いで表示）

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: データモデル — バリアのグループと消費優先順位

**Files:**
- Modify: `src/types/index.ts`（`Mitigation` interface、`reapplyOnAbsorption` の近く 73 行付近）
- Modify: `src/data/mockData.ts`（各バリア def）

**Interfaces:**
- Produces:
  - `Mitigation.barrierStackGroup?: 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis'`
  - `Mitigation.barrierConsumptionPriority?: number`（小さいほど先に消費。未設定は「一番最後」扱い）

- [ ] **Step 1: 型を追加**

`src/types/index.ts` の `Mitigation` に追記（`reapplyOnAbsorption?: boolean;` の直後）:
```ts
    /** バリアの重なりグループ。同じ context に同グループ or 上書き関係のバリアが複数あるとき、
     *  勝敗ルール(resolveBarrierConflict)で 1 枚に絞る。未設定 = 自由に加算スタック。 */
    barrierStackGroup?: 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis';
    /** バリア消費優先順位。小さいほど先に割れる（FF14 実測の固定優先順位表・パッチ7.31）。
     *  未設定のバリアは最も遅く消費される扱い。 */
    barrierConsumptionPriority?: number;
```

- [ ] **Step 2: mockData の鼓舞系に `barrierStackGroup: 'galvanize'` を付与**

`src/data/mockData.ts` の次の def に `barrierStackGroup: 'galvanize'` を追加:
- `adloquium`（鼓舞激励の策）
- `succor`（士気高揚の策）
- `concitation`（意気軒高の策）
- `deployment_tactics`（展開戦術）
- `deployment_tactics_base`（展開戦術・低レベル版）

- [ ] **Step 3: mockData のエウクラシア系に `barrierStackGroup` を付与**

- `eukrasian_prognosis` / `eukrasian_prognosis_ii` → `barrierStackGroup: 'eukrasian_prognosis'`
- `eukrasian_diagnosis` → `barrierStackGroup: 'eukrasian_diagnosis'`

- [ ] **Step 4: mockData の全バリア def に `barrierConsumptionPriority` を付与**

spec §3-5 の優先順位表に沿って、`isShield: true`（または条件付きバリア）の全 def に付ける。
軽減表に存在するスキルの対応（`grep 'isShield: true' src/data/mockData.ts` で全件確認しながら）:

| priority | 対象 def id（コメントの日本語名で確認） |
|---|---|
| 3 | ブラックナイト系（25% HP・`tank_short`・`scope:target` の def） |
| 4 | `eukrasian_diagnosis` |
| 5 | `haima` |
| 6 | `panhaima` |
| 7 | ブルータルシェル系（GNB） |
| 10 | ディヴァインカレス系（WHM） |
| 11 | マバリア系（BLM・`caster_personal_shield`）/ アルケインクレスト系（RPR、`arcane_crest`。命脈を借り受け Lv84+ は本来 1 だが、軽減表がレベル分岐を持たなければ 11 固定でよい。実装時にコメントで明記） |
| 12 | ディヴァインベニゾン系（WHM） |
| 13 | 星天交差系（AST・`celestial_intersection`） |
| 15 | `eukrasian_prognosis` / `eukrasian_prognosis_ii` |
| 16 | セラフィックヴェール系（SCH。`manifestation` / `accession` がこれに該当するか実装時に要確認。該当しなければ鼓舞系 25 のまま） |
| 17 | `holos` |
| 19 | シェイクオフ系（WAR・`shake_off`） |
| 20 | ディヴァインヴェール系（PLD・`divine_veil`） |
| 21 | `neutral_sect`（AST。バリア扱いになる条件付き。`helios_conjunction` の条件付きバリアは Nセクト由来なので 21 相当） |
| 25 | `adloquium` / `succor` / `concitation` / `deployment_tactics` / `deployment_tactics_base` |

表に無いバリア（`最大HP%` の `black_knight` 以外の tank party 系、`consolation`、`improvised_finish` 等）は、性質が近い順位に暫定配置し、`// 暫定: 表未検証` コメントを必ず付ける。判断に迷うものは「未設定のまま = 最後」でも可（既存挙動を壊さない安全側）。

**この Step の成果物 = 「どの def に priority いくつを付けたか」の一覧をコミットメッセージ or 設計書 §3-5 に追記。**

- [ ] **Step 5: 型確認**

Run: `npx tsc -b`
Expected: エラーなし

- [ ] **Step 6: 既存の軽減計算テストが壊れていないこと**

Run: `npx vitest run src/utils/__tests__/scholarShieldRules.test.ts src/store/__tests__/useMitigationStore.shieldLink.test.ts src/data/__tests__/debuffMitigationFlag.test.ts src/utils/__tests__/calculator.test.ts`
Expected: 全 PASS（データにフィールドを足しただけ・ロジック未変更）

- [ ] **Step 7: コミット**

```bash
rtk git add src/types/index.ts src/data/mockData.ts docs/superpowers/specs/2026-08-27-barrier-stacking-rules-design.md && rtk git commit -m "feat(mitigation): バリアに重なりグループと消費優先順位のデータを付与

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `resolveBarrierConflict`（重ならないバリアの勝敗判定・純関数）

**Files:**
- Create: `src/utils/barrierStacking.ts`
- Create: `src/utils/__tests__/barrierStacking.test.ts`

**Interfaces:**
- Produces:
```ts
export type BarrierStackGroup = 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis';

export interface BarrierConflictInput {
  group?: BarrierStackGroup;
  /** 判定時点の残バリア量（"大きい方が残る" 用）。 */
  remaining: number;
  /** 詠唱時刻（"後勝ち" 用）。 */
  castTime: number;
  /** 同時刻タイブレーク用の安定キー（AppliedMitigation.id）。 */
  id: string;
}

/** a と b が同一 context で同時に効こうとしたとき、生き残るのはどちらか。
 *  'a' = a が残る / 'b' = b が残る / 'both' = 両方有効（加算スタック） */
export function resolveBarrierConflict(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' | 'both';
```

**勝敗ルール（spec §1）:**
1. `a.group == null || b.group == null` → `'both'`
2. `a.group === b.group`:
   - `'galvanize'`: `remaining` が大きい方。同値なら `castTime` が新しい方。さらに同値なら `id` が大きい方（文字列比較・安定）
   - `'eukrasian_prognosis'` / `'eukrasian_diagnosis'`: `castTime` が新しい方。同時刻なら `id` が大きい方
3. `a.group !== b.group`（両方非 null）:
   - どちらかが `'eukrasian_diagnosis'` → それが勝つ
   - それ以外（`galvanize` ↔ `eukrasian_prognosis`）→ `castTime` が新しい方。同時刻なら `id` が大きい方

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/__tests__/barrierStacking.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveBarrierConflict } from '../barrierStacking';

const mk = (o: Partial<Parameters<typeof resolveBarrierConflict>[0]>) =>
  ({ group: undefined, remaining: 0, castTime: 0, id: 'x', ...o });

describe('resolveBarrierConflict', () => {
  it('片方でも group 未設定なら both（自由スタック）', () => {
    expect(resolveBarrierConflict(mk({ group: 'galvanize', remaining: 100 }), mk({ group: undefined }))).toBe('both');
    expect(resolveBarrierConflict(mk({ group: undefined }), mk({ group: undefined }))).toBe('both');
  });

  it('鼓舞系どうし: 残量が大きい方が残る', () => {
    const big = mk({ group: 'galvanize', remaining: 100, castTime: 0, id: 'a' });
    const small = mk({ group: 'galvanize', remaining: 40, castTime: 10, id: 'b' });
    expect(resolveBarrierConflict(big, small)).toBe('a');
    expect(resolveBarrierConflict(small, big)).toBe('b');
  });

  it('鼓舞系どうし同値: 後勝ち', () => {
    const older = mk({ group: 'galvanize', remaining: 50, castTime: 0, id: 'a' });
    const newer = mk({ group: 'galvanize', remaining: 50, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(older, newer)).toBe('b');
  });

  it('鼓舞系 ↔ エウクラシア・プログノシス: 後勝ち（残量無関係）', () => {
    const galBig = mk({ group: 'galvanize', remaining: 100, castTime: 0, id: 'a' });
    const progSmall = mk({ group: 'eukrasian_prognosis', remaining: 30, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(galBig, progSmall)).toBe('b'); // 後に置いた prog が勝つ
    expect(resolveBarrierConflict(progSmall, galBig)).toBe('a');
  });

  it('何か ↔ エウクラシア・ディアグノシス: ディアグノシスが必ず勝つ（後から鼓舞を置いても）', () => {
    const diagOld = mk({ group: 'eukrasian_diagnosis', remaining: 20, castTime: 0, id: 'a' });
    const galNew = mk({ group: 'galvanize', remaining: 100, castTime: 10, id: 'b' });
    expect(resolveBarrierConflict(diagOld, galNew)).toBe('a');
    expect(resolveBarrierConflict(galNew, diagOld)).toBe('b');
  });

  it('エウクラシア・プログノシス ↔ エウクラシア・ディアグノシス: ディアグノシス', () => {
    const prog = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 10, id: 'a' });
    const diag = mk({ group: 'eukrasian_diagnosis', remaining: 20, castTime: 0, id: 'b' });
    expect(resolveBarrierConflict(prog, diag)).toBe('b');
  });

  it('エウクラシア・プログノシスどうし: 後勝ち', () => {
    const a = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 0, id: 'a' });
    const b = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(a, b)).toBe('b');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/barrierStacking.test.ts`
Expected: FAIL（`resolveBarrierConflict` が存在しない）

- [ ] **Step 3: 実装**

`src/utils/barrierStacking.ts`:
```ts
export type BarrierStackGroup = 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis';

export interface BarrierConflictInput {
  group?: BarrierStackGroup;
  remaining: number;
  castTime: number;
  id: string;
}

/** 同時刻タイブレーク: id の大きい方を勝ちとする（安定・決定的）。 */
function tiebreak(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' {
  return a.id > b.id ? 'a' : 'b';
}

/** castTime が新しい方を勝ちにする（同時刻は id）。 */
function laterWins(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' {
  if (a.castTime !== b.castTime) return a.castTime > b.castTime ? 'a' : 'b';
  return tiebreak(a, b);
}

export function resolveBarrierConflict(a: BarrierConflictInput, b: BarrierConflictInput): 'a' | 'b' | 'both' {
  if (a.group == null || b.group == null) return 'both';

  // グループをまたぐ: ディアグノシスが絡めばディアグノシスが勝つ
  if (a.group !== b.group) {
    if (a.group === 'eukrasian_diagnosis') return 'a';
    if (b.group === 'eukrasian_diagnosis') return 'b';
    // galvanize ↔ eukrasian_prognosis → 後勝ち
    return laterWins(a, b);
  }

  // 同グループ
  if (a.group === 'galvanize') {
    if (a.remaining !== b.remaining) return a.remaining > b.remaining ? 'a' : 'b';
    return laterWins(a, b);
  }
  // eukrasian_prognosis / eukrasian_diagnosis 同グループ → 後勝ち
  return laterWins(a, b);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/barrierStacking.test.ts`
Expected: 全 PASS

- [ ] **Step 5: コミット**

```bash
rtk git add src/utils/barrierStacking.ts src/utils/__tests__/barrierStacking.test.ts && rtk git commit -m "feat(mitigation): resolveBarrierConflict（重ならないバリアの勝敗判定・純関数）

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `resolveContextShields`（1 context・1 被弾のバリア解決・純関数）

**Files:**
- Modify: `src/utils/barrierStacking.ts`（`resolveContextShields` を追加）
- Modify: `src/utils/__tests__/barrierStacking.test.ts`（テスト追加）

**Interfaces:**
- Consumes: `resolveBarrierConflict`（Task 3）
- Produces:
```ts
export interface ContextShieldEntry {
  appMitId: string;
  group?: BarrierStackGroup;
  /** 消費優先順位。小さいほど先。未設定バリアは呼び出し側で Number.MAX_SAFE_INTEGER を渡す。 */
  priority: number;
  castTime: number;
  /** 満タンのバリア量（この context 用）。 */
  maxVal: number;
  /** スタック制の最大スタック数。非スタックは undefined。 */
  maxStacks?: number;
  reapplyOnAbsorption?: boolean;
}

export interface ContextShieldState {
  /** appMitId → 現在の残バリア量。 */
  remaining: Map<string, number>;
  /** appMitId → 現在の残スタック。 */
  stacks: Map<string, number>;
  /** この context で既に上書き負けして無効なバリアの appMitId（ラッチ）。 */
  overwritten: Set<string>;
}

export interface ContextShieldResult {
  /** この被弾でバリアが吸収した合計量。 */
  totalAbsorbed: number;
  /** この被弾で完全に尽きた（もう肩代わりできない）バリアの appMitId。 */
  newlyExhausted: string[];
  /** この被弾で初めて上書き負けが確定したバリアの appMitId。 */
  newlyOverwritten: string[];
  /** displayContext 用: 各バリアの被弾後スタック数（UI 表示用）。 */
  stacksAfter: Map<string, number | undefined>;
}

/** entries の中で state.overwritten でないものについて:
 *  1) 非スタック解決（resolveBarrierConflict 総当たり、負けたら state.overwritten に追加）
 *  2) 生き残りを priority 昇順（同値は castTime 昇順→appMitId 昇順）に並べ、
 *     remaining（=incomingDamage から減っていく）を持ち回って順に吸収
 *  state（remaining / stacks / overwritten）を破壊的に更新する。 */
export function resolveContextShields(
  entries: ContextShieldEntry[],
  incomingDamage: number,
  state: ContextShieldState,
): ContextShieldResult;
```

**アルゴリズム詳細:**
- `remainingOf(id)`: `state.remaining.has(id) ? state.remaining.get(id)! : entry.maxVal`
- `stacksOf(id)`: `state.stacks.has(id) ? state.stacks.get(id)! : entry.maxStacks`（`maxStacks` undefined なら undefined）
- **非スタック解決**: `active = entries.filter(e => !state.overwritten.has(e.appMitId))`。
  `active` の全ペア (i<j) について、両方 `group != null` なら `resolveBarrierConflict` を
  `{ group, remaining: remainingOf(id), castTime, id }` で呼ぶ。
  結果が `'a'` → j を負け、`'b'` → i を負け、`'both'` → 何もしない。
  「一度でも負けたバリア」を集合 `losers` に集め、`active` から除外。
  `losers` の各 id を `state.overwritten` に追加し `newlyOverwritten` に積む（既に overwritten だったものは newlyOverwritten に入れない＝Task 4 では発生しないが将来のため）。
- **吸収**: `survivors = active.sort((a,b) => a.priority-b.priority || a.castTime-b.castTime || (a.appMitId<b.appMitId?-1:1))`。
  `let dmg = incomingDamage; let totalAbsorbed = 0;`
  各 survivor について:
  - `const rem = remaining Of(id); if (rem <= 0) continue;`
  - `stepShieldAbsorption` 相当をインライン or import（`src/components/Timeline.tsx` の `stepShieldAbsorption` を `src/utils/barrierStacking.ts` へ移設し、Timeline はそこから import する。移設理由: 純関数の同居）:
    - `absorbed = min(rem, dmg)`, `isBroken = absorbed >= rem`
    - `finalShield = rem - absorbed; finalStacks = stacksOf(id);`
    - `if (isBroken && finalStacks != null && finalStacks > 0 && reapplyOnAbsorption) { finalStacks -= 1; finalShield = maxVal; }`
  - `state.remaining.set(id, finalShield); if (finalStacks != null) state.stacks.set(id, finalStacks);`
  - `dmg -= absorbed; totalAbsorbed += absorbed;`
  - `stacksAfter.set(id, finalStacks);`
  - `if (finalShield <= 0) newlyExhausted.push(id);`
  - `if (dmg <= 0) break;`（以降のバリアは触らない＝残る）
- 返り値を組み立てて return。

- [ ] **Step 1: `stepShieldAbsorption` を `barrierStacking.ts` へ移設**

`src/components/Timeline.tsx` の `stepShieldAbsorption`（export 関数）を `src/utils/barrierStacking.ts` へ移動。
`Timeline.tsx` は `import { stepShieldAbsorption } from '../utils/barrierStacking';` に変更。
`src/components/__tests__/Timeline.shieldAbsorption.test.ts` の import 元も `../../utils/barrierStacking` に変更。
`shieldCoverageContext` は Timeline.tsx に残す（damageMapResult 専用のため）か、同様に移設（どちらでも可。移設するなら test の import も直す）。

Run: `npx vitest run src/components/__tests__/Timeline.shieldAbsorption.test.ts`
Expected: 全 PASS（移設のみ）

- [ ] **Step 2: 失敗するテストを書く**

`src/utils/__tests__/barrierStacking.test.ts` に追記:
```ts
import { resolveContextShields, type ContextShieldEntry, type ContextShieldState } from '../barrierStacking';

const freshState = (): ContextShieldState => ({
  remaining: new Map(), stacks: new Map(), overwritten: new Set(),
});
const entry = (o: Partial<ContextShieldEntry> & { appMitId: string }): ContextShieldEntry => ({
  group: undefined, priority: Number.MAX_SAFE_INTEGER, castTime: 0, maxVal: 0,
  ...o,
});

describe('resolveContextShields', () => {
  it('二重削りしない: 60,000 被弾 vs 別グループ 40,000 バリア2枚 → 2枚目に 20,000 残る', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'a', maxVal: 40000, priority: 13 }), // 先に消費
      entry({ appMitId: 'b', maxVal: 40000, priority: 20 }),
    ];
    const r = resolveContextShields(entries, 60000, st);
    expect(r.totalAbsorbed).toBe(60000);
    expect(st.remaining.get('a')).toBe(0);
    expect(st.remaining.get('b')).toBe(20000);
    expect(r.newlyExhausted).toEqual(['a']);
  });

  it('鼓舞系どうしは大きい方だけ残り、小さい方は上書き負け（吸収に参加しない）', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'big', group: 'galvanize', priority: 25, maxVal: 100000, castTime: 0 }),
      entry({ appMitId: 'small', group: 'galvanize', priority: 25, maxVal: 40000, castTime: 10 }),
    ];
    const r = resolveContextShields(entries, 30000, st);
    expect(r.newlyOverwritten).toEqual(['small']);
    expect(st.overwritten.has('small')).toBe(true);
    expect(st.remaining.get('big')).toBe(70000); // big だけが 30,000 吸収
    expect(st.remaining.has('small')).toBe(false); // small は触られない
    expect(r.totalAbsorbed).toBe(30000);
  });

  it('優先順位順に消費: 星天交差(30,000,p13) + 鼓舞(100,000,p25) に 150,000 → 鼓舞に 10,000 残る', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'gal', group: 'galvanize', priority: 25, maxVal: 100000 }),
      entry({ appMitId: 'inter', priority: 13, maxVal: 30000 }),
    ];
    const r = resolveContextShields(entries, 150000, st);
    expect(st.remaining.get('inter')).toBe(0);
    expect(st.remaining.get('gal')).toBe(10000);
    expect(r.newlyExhausted).toEqual(['inter']); // gal はまだ残ってる
  });

  it('スタック制(ハイマ): 1スタック割れても newlyExhausted に入らない', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'haima', priority: 5, maxVal: 10000, maxStacks: 5, reapplyOnAbsorption: true }),
    ];
    const r = resolveContextShields(entries, 99999, st);
    expect(st.stacks.get('haima')).toBe(4);
    expect(st.remaining.get('haima')).toBe(10000); // 貼り直し
    expect(r.newlyExhausted).toEqual([]);
  });

  it('overwritten にあるバリアは最初から吸収に参加しない', () => {
    const st = freshState();
    st.overwritten.add('dead');
    const entries = [
      entry({ appMitId: 'dead', group: 'galvanize', priority: 25, maxVal: 999999 }),
      entry({ appMitId: 'live', priority: 20, maxVal: 30000 }),
    ];
    const r = resolveContextShields(entries, 50000, st);
    expect(r.totalAbsorbed).toBe(30000); // live だけ
    expect(st.remaining.has('dead')).toBe(false);
  });
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/barrierStacking.test.ts`
Expected: FAIL（`resolveContextShields` 未定義）

- [ ] **Step 4: 実装**

`src/utils/barrierStacking.ts` に上記「アルゴリズム詳細」どおりに実装。`stepShieldAbsorption` は同ファイル内なので直接呼ぶ。

- [ ] **Step 5: テストが通ることを確認**

Run: `npx vitest run src/utils/__tests__/barrierStacking.test.ts`
Expected: 全 PASS

- [ ] **Step 6: コミット**

```bash
rtk git add src/utils/barrierStacking.ts src/utils/__tests__/barrierStacking.test.ts src/components/Timeline.tsx src/components/__tests__/Timeline.shieldAbsorption.test.ts && rtk git commit -m "feat(mitigation): resolveContextShields（優先順位順の吸収＋非スタック解決＋二重削り修正）

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: `damageMapResult` へ統合

**Files:**
- Modify: `src/components/Timeline.tsx`（`damageMapResult` useMemo、バリア吸収ループ [2442-2613]）

**Interfaces:**
- Consumes: `resolveContextShields` / `ContextShieldEntry` / `ContextShieldState`（Task 4）
- Produces: `damageMapResult` の返り値に `barrierOverwrittenAt: Map<string, number>`（appMit.id → 上書き負けが確定した時刻 = 勝った相手の詠唱時刻と自分の詠唱時刻の遅い方）を追加。`shieldExhaustedAt` は維持。

**方針:** 現在「`activeMitigations.forEach(appMit)` の中で copiesShield 分岐 / 通常分岐がそれぞれ `affectedContexts.forEach(ctx)` で吸収」している構造を、次の 2 フェーズに変える。

**フェーズ1 — entry 組み立て（context ごと）:**
`affectedContexts` の各 ctx について、`ctx` で効くバリア entry のリストを作る。
1 つの appMit について:
- shield 判定（`def.isShield || isConditionalShield`）を通過し、
- 通常バリア: 既存フィルタ（`scope:self` / `targetId` / `type` 物理魔法）を適用して ctx に効くか判定、
- copiesShield: `ctx === linkedMit.targetId` を除外、`maxVal = calculateLinkedShieldValue(...)`、
- `maxVal` は既存の crit/healing 計算をそのまま使う（1 appMit 1 回計算し、全 ctx で共通）、
- entry = `{ appMitId: appMit.id, group: def.barrierStackGroup, priority: def.barrierConsumptionPriority ?? Number.MAX_SAFE_INTEGER, castTime: appMit.time, maxVal, maxStacks: def.stacks, reapplyOnAbsorption: def.reapplyOnAbsorption }`

**フェーズ2 — ctx ごとに解決:**
```ts
// damageMapResult スコープに用意（context 文字列 → state）
const ctxShieldState = new Map<string, ContextShieldState>();
const getCtxState = (ctx: string): ContextShieldState => {
  if (!ctxShieldState.has(ctx)) ctxShieldState.set(ctx, { remaining: new Map(), stacks: new Map(), overwritten: new Set() });
  return ctxShieldState.get(ctx)!;
};
```
被弾ごと・ctx ごとに:
```ts
const entriesForCtx: ContextShieldEntry[] = /* フェーズ1 で作ったもの */;
if (entriesForCtx.length > 0) {
  const st = getCtxState(ctx);
  const res = resolveContextShields(entriesForCtx, damageForShields, st);

  // 上書き負けの記録: 時刻 = 「その appMit と、勝った相手のうち castTime が新しい方」ではなく、
  // シンプルに「勝敗が確定したこの被弾時刻」を使う（棒のグレー開始点は Task 6 で castTime 基準に補正）。
  for (const id of res.newlyOverwritten) {
    if (!barrierOverwrittenAt.has(id)) barrierOverwrittenAt.set(id, event.time);
  }
  for (const id of res.newlyExhausted) {
    if (!shieldExhaustedAt.has(id)) shieldExhaustedAt.set(id, event.time);
  }

  if (ctx === displayContext) {
    displayShieldTotal += res.totalAbsorbed;      // ← 旧: sum(shieldRemaining)。新: 実際に吸収した量（表示の正確化）
    currentDamage = Math.max(0, currentDamage - res.totalAbsorbed);
    for (const [id, s] of res.stacksAfter) eventMitigationStates[id] = { stacks: s };
  }
}
```

**削除する既存コード:** 現在の `activeMitigations.forEach` 内の shield 吸収（copiesShield 分岐の `affectedContexts.forEach` と、通常分岐の `affectedContexts.forEach` の中の `stepShieldAbsorption` 呼び出し・`shieldExhaustedAt.set`・`displayShieldTotal +=`・`currentDamage -=` 部分）。crit/healing の `maxVal` 計算・フィルタ判定は entry 組み立てで再利用するため残す（関数化 or ループ構造の組み替え）。

**注意:**
- `getShieldState` / `updateShieldState` / `getStackState` / `updateStackState` は不要になる（`ContextShieldState` に置き換わる）。削除するか、他で使っていないか grep 確認してから消す。
- リビングデッド判定（`if (!isInvincibleForEvent)` の後段）はそのまま。`currentDamage` はフェーズ2 の後の値を使う。
- `damageMapResult` の deps 配列は変更なし（`timelineMitigations` に `barrierStackGroup` 由来の変化はないが、def は `MITIGATIONS` 経由なので問題なし。ただし `MITIGATIONS` が hook 由来で毎回新参照なら既存どおり）。

- [ ] **Step 1: 失敗する統合テストを書く**

`src/components/__tests__/Timeline.shieldAbsorption.test.ts` に、`damageMapResult` から切り出した「entry 組み立て + resolveContextShields」を検証する薄いテストを追加。
※ `damageMapResult` 全体は重いので、**entry 組み立てを純関数 `buildContextShieldEntries(activeShields, ctx, ...)` として切り出し**、それをテストする。
テスト内容:
- 鼓舞激励の策(MT対象) + 意気軒高の策(全体) を配置し、MT context の entry が 2 つ、Party context の entry が 1 つ（意気軒高のみ）
- copiesShield(展開戦術) の entry は `linkedMit.targetId` の ctx に出ない

（具体的なテストコードは実装時に `buildContextShieldEntries` のシグネチャ確定後に書く。シグネチャ案: `buildContextShieldEntries(params: { activeMitigations, mitigationDefs, ctx, displayContext, event, timelineMitigations, partyMembers, computeMaxVal }): ContextShieldEntry[]`）

- [ ] **Step 2: テストが失敗することを確認**

Run: `npx vitest run src/components/__tests__/Timeline.shieldAbsorption.test.ts`
Expected: FAIL

- [ ] **Step 3: `buildContextShieldEntries` を切り出して実装**

- [ ] **Step 4: `damageMapResult` のループを差し替え**

上記「フェーズ1/2」どおり。

- [ ] **Step 5: 型・ビルド確認**

Run: `npx tsc -b`
Expected: エラーなし（未使用になった `getShieldState` 等を消す）

- [ ] **Step 6: 回帰テスト**

Run: `npx vitest run src/utils src/components/__tests__/Timeline.shieldAbsorption.test.ts src/components/__tests__/MobileTimelineRow.groupAndCapMitigations.test.ts src/utils/__tests__/scholarShieldRules.test.ts src/store/__tests__/useMitigationStore.shieldLink.test.ts`
Expected: 全 PASS。落ちたら「非スタック解決 or 優先順位 or 二重削り修正」で数値が正当に変わったのか、バグかを 1 件ずつ切り分け（memory `feedback_test_run_cost_discipline`）。既存テストの期待値が「加算スタック前提の古い数値」なら、正しい数値に更新しコミットメッセージで理由を明記。

- [ ] **Step 7: build**

Run: `npm run build`
Expected: 成功（tsc api + vite build 含む）

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Timeline.tsx src/components/__tests__/Timeline.shieldAbsorption.test.ts && rtk git commit -m "feat(mitigation): damageMapResult をバリア優先順位＋非スタック解決に対応

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 6: エフェクト棒 — 上書き負けバリアのクリップ（方式a）

**Files:**
- Modify: `src/components/Timeline.tsx`（PC バー高さ計算。`shieldExhaustedAt` を使っている箇所の隣）
- Modify: `src/utils/mobileEffectBar.ts`（`ComputeMobileEffectBarsArgs` に `barrierOverwrittenAt` 追加、`effectiveEndTime` クランプ）
- Modify: `src/utils/__tests__/mobileEffectBar.test.ts`

**Interfaces:**
- Consumes: `damageMapResult.barrierOverwrittenAt`（Task 5）
- Produces: なし（棒の見た目のみ）

**方針（方式a = spec §3-4 の a）:** 上書き負けしたバリアの棒を、負けた時刻でクリップして終了させる。`shieldExhaustedAt` と同じ `Math.min` クリップにもう 1 つ時刻を足すだけ。

**負けた時刻の補正:** Task 5 では `barrierOverwrittenAt` に「勝敗が確定した被弾時刻」を入れている。より正確には「自分の詠唱時刻と、勝った相手の詠唱時刻の遅い方」= 両方が同時に存在し始めた時刻。ここで補正する:
- `damageMapResult` 側で、`newlyOverwritten` の id について、その appMit と衝突相手（同 ctx・同/上書き関係グループでアクティブなバリア）の中で最も遅い castTime を求め、`max(自分のcastTime, その値)` を記録する。
- 実装が重ければ「被弾時刻そのまま」でも可（棒が少し長めに残るだけ・実害小）。実装時に判断しコメントで明記。

- [ ] **Step 1: `damageMapResult` 側で `barrierOverwrittenAt` の時刻を castTime 基準に補正**

`resolveContextShields` を呼ぶ前の entry リストが手元にあるので、`newlyOverwritten` の各 id について
`entriesForCtx` の中の他 entry の castTime の最大値と自分の castTime の `max` を取る。
```ts
for (const id of res.newlyOverwritten) {
  if (barrierOverwrittenAt.has(id)) continue;
  const me = entriesForCtx.find(e => e.appMitId === id)!;
  const rivalLatestCast = Math.max(
    me.castTime,
    ...entriesForCtx.filter(e => e.appMitId !== id && e.group != null).map(e => e.castTime),
  );
  barrierOverwrittenAt.set(id, rivalLatestCast);
}
```

- [ ] **Step 2: PC バーのクリップに `barrierOverwrittenAt` を追加**

Timeline.tsx の PC バー高さ計算、`shieldExhaustedAt` を参照している箇所（`def?.isShield && shieldExhaustedAt.has(mitigation.id)` の直後）に追記:
```tsx
// 上書き負けしたバリア: 負けた時刻で棒を止める（方式a）。
if (barrierOverwrittenAt.has(mitigation.id)) {
    const cutY = getMappedY(barrierOverwrittenAt.get(mitigation.id)!);
    height = Math.min(height, Math.max(0, Math.round(cutY + 24 - startY)));
}
```
（`shieldExhaustedAt` と同じ式。`def?.isShield` 判定は不要 — overwritten に入るのはバリアのみ）
`shieldExhaustedAt` を `damageMapResult` から取り出している行の隣で `barrierOverwrittenAt` も取り出す:
```ts
const barrierOverwrittenAt = damageMapResult.barrierOverwrittenAt;
```

- [ ] **Step 3: 失敗するテストを書く（mobile）**

`src/utils/__tests__/mobileEffectBar.test.ts` に追記:
```ts
it('barrierOverwrittenAt: 上書き負けした時刻で棒を止める', () => {
  const def = makeDef('adloquium', { duration: 30, isShield: true });
  const mit = makeMit('p1', 'adloquium', 'MT', 0, 30);
  const result = computeMobileEffectBars({
    ...baseArgs,
    timelineMitigations: [mit],
    mitigationDefs: [def],
    barrierOverwrittenAt: new Map([['p1', 8]]),
  });
  // effectiveEndTime = min(29, 8) = 8 → endY = 8*60 + 24 = 504
  expect(result[0].height).toBe(504);
});
```

- [ ] **Step 4: テストが失敗することを確認**

Run: `npx vitest run src/utils/__tests__/mobileEffectBar.test.ts`
Expected: FAIL（`barrierOverwrittenAt` が引数に無い）

- [ ] **Step 5: `computeMobileEffectBars` に対応**

`ComputeMobileEffectBarsArgs` に `barrierOverwrittenAt?: Map<string, number>;` を追加、destructure に足し、`effectiveEndTime = Math.min(effectiveEndTime, maxTime)` の直後に:
```ts
if (barrierOverwrittenAt?.has(mit.id)) {
  effectiveEndTime = Math.min(effectiveEndTime, barrierOverwrittenAt.get(mit.id)!);
}
```

- [ ] **Step 6: 呼び出し元（Timeline.tsx）で `barrierOverwrittenAt` を渡す**

`computeMobileEffectBars({...})` 呼び出しに `barrierOverwrittenAt,` を追加。

- [ ] **Step 7: テスト・ビルド**

Run: `npx vitest run src/utils/__tests__/mobileEffectBar.test.ts src/components/__tests__/Timeline.shieldAbsorption.test.ts && npx tsc -b`
Expected: 全 PASS / エラーなし

- [ ] **Step 8: コミット**

```bash
rtk git add src/components/Timeline.tsx src/utils/mobileEffectBar.ts src/utils/__tests__/mobileEffectBar.test.ts && rtk git commit -m "feat(mitigation): 上書き負けしたバリアのエフェクト棒を負けた時刻で終了

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 7（任意・ゲート付き）: 上書き負けバリアのグレー棒（方式c）

**実装前に必ずコスト見積もりを masaya さんに出す。重ければこのタスクはスキップ（方式a で確定）。**

**Files:**
- Modify: `src/components/Timeline.tsx`（`MitigationItem` のバー描画を 2 分割）
- Modify: `src/utils/mobileEffectBar.ts` / `MobileEffectBarLayer.tsx`（同上）

**方針:** バーを「通常色（開始〜負けた時刻）」＋「グレー（負けた時刻〜自然な効果時間終端）」の 2 セグメントで描画。`barrierOverwrittenAt` があるバリアのみ 2 分割。色は `--app-text-muted` 系トークン、不透明度を下げる。

- [ ] **Step 1: コスト見積もりを出して承認を得る**（PC の `MitigationItem` バー / モバイルの `MobileEffectBarLayer` それぞれの改修量）
- [ ] **Step 2〜: 承認されたら TDD で実装**（詳細は承認後に確定）

---

## Task 8: push 前ゲート & 実機確認依頼

- [ ] **Step 1: フルビルド**

Run: `npm run build`
Expected: 成功

- [ ] **Step 2: フルテスト（ハング注意）**

Run: `npx vitest run`（バックグラウンド推奨。~3分で結果が出なければ既知ハング → kill して変更ファイル実行で代替）
Expected: 新規追加分 PASS、既存の legacy 失敗（EphemeralAddPanel 7件 / TopBar 等）は既知。

- [ ] **Step 3: コミット済みを push**

```bash
rtk git push origin main
```

- [ ] **Step 4: masaya さんへ実機確認を依頼**

デプロイ後、SCH+SGE 構成で:
- 鼓舞激励の策 → 意気軒高の策 の順に置き、意気軒高が小さければ棒がすぐ終わる／大きければ鼓舞の棒が終わる
- 鼓舞系 → エウクラシア・プログノシス後出し → 鼓舞系の棒がプログノシス詠唱時刻で終わる
- ディヴァインヴェール + 鼓舞 + 星天交差 に大ダメージ → 星天交差・ディヴァインヴェールが先に消費、鼓舞に残量
- 展開戦術の棒が出ていて、全体攻撃でコピー分を使い切ったら終わる
- 🛡️ の数値が「実際に吸収した量」になっている

---

## Self-Review

**Spec coverage:**
- §1 ルール → Task 3（resolveBarrierConflict）
- §3-1 データモデル → Task 2
- §3-2 勝敗純関数 → Task 3
- §3-3 適用フロー（非スタック解決＋二重削り） → Task 4 + Task 5
- §3-5 優先順位表 → Task 2 Step 4 + Task 4（priority ソート）
- §3-4 エフェクト棒 → Task 6（方式a）/ Task 7（方式c・ゲート付き）
- 点2 展開戦術の棒 → Task 1
- §4 検証 → 各 Task のテスト + Task 8

**Placeholder scan:** Task 5 Step 1 と Task 7 に「実装時に確定」が残るが、これは (a) `buildContextShieldEntries` のシグネチャが damageMapResult の内部構造依存で事前に固定できない、(b) Task 7 はゲート付き任意タスク、という理由付きの明示的な保留。他タスクは具体コードあり。

**Type consistency:** `ContextShieldEntry` / `ContextShieldState` / `ContextShieldResult` は Task 4 で定義し Task 5 で consume。`barrierOverwrittenAt` は Task 5 で produce し Task 6 で consume。`resolveBarrierConflict` の戻り値 `'a'|'b'|'both'` は Task 3 定義・Task 4 consume。整合。

**未確定で実装者が判断する点（コメント必須）:**
- Task 2 Step 4: 優先順位表に無いバリアの暫定配置
- Task 5: `buildContextShieldEntries` の正確なシグネチャ
- Task 6 Step 1: `barrierOverwrittenAt` 時刻の castTime 補正を入れるか（重ければ被弾時刻のまま）
