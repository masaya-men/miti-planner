# スキルモード切替インフラ設計（リボーン / エヴォルヴ）

> 作成日: 2026-04-30
> ステータス: 設計確定（実装プラン待ち）
> スコープ: インフラのみ（UI 変更ゼロ、admin 改修なし）

---

## 1. 背景・目的

8.0 拡張で全ジョブのスキル仕様が大幅調整される可能性がある（仮称：旧モード=リボーン、新モード=エヴォルヴ）。さらにパーティ内に両モードのプレイヤーが混在し得る。

公式情報が出る前に「**スキル数値・スキル有無・プレイスタイル**」のいずれが分岐しても吸収できるインフラを準備しておき、8.0 アナウンス時の追加工数を最小化する。

ステータス（patchStats）の分岐は当面スコープ外。将来拡張余地のみ残す。

## 2. 確定した方針

| 項目 | 決定 |
|----|----|
| 実装範囲 | インフラのみ。UI 追加なし、admin 画面改修なし、現状の見た目・操作完全維持 |
| 分岐方式 | 方式1（差分シート）：基本データはリボーン、エヴォルヴで変わる箇所だけ上書き |
| モードの単位 | `PartyMember` 単位（パーティ内混在対応） |
| ステータス分岐 | スコープ外（将来拡張余地のみ） |
| 既存プラン | 完全無傷。`mode` 未指定 → `'reborn'` フォールバック |
| 新規プラン | `DEFAULT_NEW_MODE` 定数（今は `'reborn'`、8.0 時に `'evolved'` へ） |
| Firestore マイグレーション | 不要（Optional フィールドのみ追加） |
| admin 画面 | 触らない（8.0 アナウンス時に差分入力 UI を後付け） |

## 3. アーキテクチャ

```
┌──────────────────────────────────────────┐
│ スキルマスター (Firestore / mockData)    │
│   Mitigation { value, recast, ...,       │
│     modes?: { evolved?: 差分 } }         │← Optional 追加
└──────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│ resolveMitigation(m, mode)               │← 新規追加
│   差分マージのみを担う唯一の関数         │
│   戻り値: Mitigation | null              │
│     - reborn → m そのまま                │
│     - evolved + 差分なし → m そのまま    │
│     - evolved + 差分 → マージ結果        │
│     - evolved + disabled: true → null    │
└──────────────────────────────────────────┘
                  │
                  ▼
┌──────────────────────────────────────────┐
│ 計算ロジック層                           │
│   PartyMember.mode を読んで              │
│   resolveMitigation 経由で値取得         │
└──────────────────────────────────────────┘
```

設計の核：
1. **データの流れは一方向**。差分の適用は `resolveMitigation` の単一関数のみで行う。
2. **mode 取得もユーティリティ集約**。`getMode(member)` で `member.mode ?? 'reborn'` を返す。フォールバックは永久に `'reborn'` 固定。
3. **DEFAULT_NEW_MODE は別軸**。新規 PartyMember 作成時に書き込むデフォルト値。8.0 時に 1 行変更で `'evolved'` 切替可能。

## 4. データモデル

### 4.1 Mitigation 型拡張（`src/types/index.ts`）

```ts
export interface Mitigation {
  // 既存フィールドはすべて変更なし（id, jobId, name, icon, recast, duration,
  // type, value, valuePhysical, valueMagical, isShield, valueType, scope,
  // healingIncrease, requires, resourceCost, family, ... など全フィールドそのまま）
  id: string;
  jobId: string;
  // ...

  /**
   * モード別の差分。
   * - 未指定: 両モードで同じ動作（リボーン基本データを使用）
   * - evolved: { ...差分... } → リボーン基本データに上書きマージ
   * - evolved: { disabled: true } → エヴォルヴモードでは存在しないスキル扱い
   */
  modes?: {
    evolved?: Partial<Mitigation> | { disabled: true };
  };
}
```

### 4.2 PartyMember 型拡張（`src/types/index.ts`）

```ts
export interface PartyMember {
  // 既存フィールドはすべて変更なし（id, jobId, role, stats, computedValues）
  id: string;
  jobId: string | null;
  // ...

  /**
   * このメンバーのスキルモード。
   * 未指定時は 'reborn' フォールバック（既存プラン互換性のため永久に reborn 固定）。
   * 新規作成時は DEFAULT_NEW_MODE が書き込まれる。
   */
  mode?: 'reborn' | 'evolved';
}
```

両フィールドとも **Optional**。既存データに無くても TypeScript エラー出ず、ロード時もクラッシュしない。

## 5. 中核ユーティリティ（新規ファイル）

`src/utils/mitigationResolver.ts`：

```ts
import type { Mitigation, PartyMember } from '../types';

export type SkillMode = 'reborn' | 'evolved';

/**
 * 新規 PartyMember 作成時のデフォルトモード。
 * 8.0 リリース時にこの 1 行を 'evolved' に変更してデフォルト切替する。
 * 注意: 既存プラン（mode 未指定）には影響しない。getMode のフォールバックは永久に 'reborn'。
 */
export const DEFAULT_NEW_MODE: SkillMode = 'reborn';

/**
 * PartyMember のモード取得。
 * 未指定時は 'reborn' を返す。このフォールバックは互換性保証のため永久に変更しない。
 */
export function getMode(member: PartyMember): SkillMode {
  return member.mode ?? 'reborn';
}

/**
 * Mitigation を指定モードで解決する。
 * @returns マージ済み Mitigation。エヴォルヴで disabled の場合は null。
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

このファイルは独立しており、他のコードを呼ばない。テストもこのファイル単独で完結。

## 6. 影響範囲（既存ファイルの変更）

### 6.1 計算・参照系（resolveMitigation 経由に書き換える）

依存関係調査で特定された Mitigation 利用箇所：

- `src/utils/calculator.ts` — シールド・軽減量計算
- `src/utils/autoPlanner.ts:56-59` — `mitiCache` ルックアップ後 value/recast/duration/type で計算
- `src/utils/resourceTracker.ts:1-2` — `resourceCost` で aetherflow/addersgall 消費判定
- `src/utils/jobMigration.ts:26` — `family` 属性でマイグレーション判定（**mode 非依存**、書き換え不要）
- `src/store/useMitigationStore.ts:815` — `requires` 前提スキル削除依存チェック

書き換えパターン：

```ts
// Before
const value = mitigation.value;

// After
const resolved = resolveMitigation(mitigation, getMode(member));
if (!resolved) return; // または filter
const value = resolved.value;
```

配列処理の場合：

```ts
// Before
mitigations.forEach(m => { /* 計算 */ });

// After
mitigations
  .map(m => resolveMitigation(m, getMode(member)))
  .filter((m): m is Mitigation => m !== null)
  .forEach(m => { /* 計算 */ });
```

### 6.2 表示系（書き換え不要、現状維持）

以下は mode 非依存の表示・選択であり、当面 resolveMitigation 経由にしない：

- `src/components/MitigationSelector.tsx` — 軽減一覧 UI（admin 表示用、mode 概念なし）
- `src/components/admin/AdminSkills.tsx` 等 admin 系
- 軽減配置時の即値表示（既存挙動維持）

8.0 アナウンス時に「UI 側でも mode を意識させたい」となれば、その時点で resolveMitigation を通す方針に切替可能。

### 6.3 PartyMember 新規作成箇所（DEFAULT_NEW_MODE を注入）

- `src/store/useMitigationStore.ts:167-176` — `INITIAL_PARTY` 定義
- `src/store/useMitigationStore.ts:252-256` — メンバー生成時 `computedValues` 計算
- `src/store/usePlanStore.ts:138-144` — テンプレート読み込み時の PartyMember 生成
- `src/store/useMitigationStore.ts:865-932` — `setMemberJob`（ジョブ変更時）
- `src/store/useMitigationStore.ts:934-970` — `changeMemberJobWithMitigations`
- `src/store/useMitigationStore.ts:972-1044` — `updatePartyBulk`

各箇所で新規 PartyMember を作る際に `mode: DEFAULT_NEW_MODE` を含める。

### 6.4 サーバーサイド・シリアライズ

調査で確認済み：

- `api/share/index.ts:212-217` — `req.body.planData` を **any 受信**、未検証で Firestore 保存。Optional フィールド追加で破損なし。
- `api/popular/index.ts:140-144` — `planData.partyMembers` 簡易マッピング。未知 `mode` フィールドは無視されるだけ。
- `api/og/index.ts`, `api/og-cache/index.ts` — OGP 生成。`mode` を読まなくても画像生成に影響なし。
- localStorage persist — JSON.parse/stringify のみ、スキーマ検証なし。Optional 追加でロード時エラーなし。

サーバー側および永続化層には **変更不要**。

## 7. ビルド保証戦略（フェーズ分け実装）

各フェーズ末で `npm run build` + `vitest run` の **両方** PASS を必須確認する。失敗したらそのフェーズで停止し、原因を特定してから次フェーズに進む。

### Phase 1: 型 Optional フィールド追加のみ

- `src/types/index.ts` で `Mitigation.modes?` と `PartyMember.mode?` を追加
- 既存コードは一切変更しない
- **期待結果**: build 通過、既存テスト 253 件すべて PASS（型追加だけで挙動変化ゼロ）

### Phase 2: `mitigationResolver.ts` 新規作成 + 単体テスト

- `src/utils/mitigationResolver.ts` 新規作成（Section 5 の内容）
- `src/utils/__tests__/mitigationResolver.test.ts` 新規作成（Section 8.1 の内容）
- 既存ファイルは触らない（孤立追加）
- **期待結果**: build 通過、既存テスト 253 件 PASS、新規テスト追加分 PASS

### Phase 3: 計算ロジック側を 1 ファイルずつ resolveMitigation 経由に書き換え

順序：

1. `calculator.ts` 書き換え → build + test 確認
2. `autoPlanner.ts` 書き換え → build + test 確認
3. `resourceTracker.ts` 書き換え → build + test 確認
4. `useMitigationStore.ts` 内の Mitigation 参照箇所書き換え → build + test 確認

各ステップで PASS してから次へ進む。1 ファイルずつコミット可能。

**期待結果**: 各ステップで既存テスト全 PASS（mode='reborn' フォールバックで挙動変化なし）

### Phase 4: PartyMember 新規作成箇所に DEFAULT_NEW_MODE 注入

- Section 6.3 の各箇所に `mode: DEFAULT_NEW_MODE` を追加
- 既存 PartyMember を読み込む際は何もしない（Optional のまま）
- **期待結果**: build 通過、既存テスト全 PASS、新規 PartyMember に `mode='reborn'` が書き込まれる

### Phase 5: 互換性ガードテスト追加・全体最終確認

- 「mode 未指定 PartyMember の計算結果が実装前のスナップショットと完全一致」を保証するテスト追加
- 「DEFAULT_NEW_MODE が 'reborn' であること」を assert（8.0 時に意図せず変更されたらテストで検知）
- 全体 build + test PASS 最終確認

## 8. テスト方針

### 8.1 新規単体テスト（`src/utils/__tests__/mitigationResolver.test.ts`）

- `resolveMitigation`
  - 差分なし + reborn → 入力と完全一致（参照同一性または deep equal）
  - 差分なし + evolved → 入力と完全一致
  - 差分あり + reborn → 入力と完全一致（差分が無視される）
  - 差分あり + evolved → 差分マージ結果（spread での上書き確認）
  - `disabled: true` + evolved → `null`
  - `disabled: true` + reborn → 入力と完全一致
- `getMode`
  - `member.mode === undefined` → `'reborn'`
  - `member.mode === 'reborn'` → `'reborn'`
  - `member.mode === 'evolved'` → `'evolved'`
- `DEFAULT_NEW_MODE` の値スナップショット（現在 `'reborn'` であること）

### 8.2 互換性ガードテスト

- 既存プラン（`mode` フィールド無し）をロード → 計算結果が実装前と一致
- 既存スキルマスター（`modes` フィールド無し）→ resolveMitigation を通しても結果変化なし

### 8.3 既存テストの扱い

既存 253 件は **一切変更しない**。実装後も全 PASS を維持。これが破損ゼロの最重要シグナル。

スナップショットテスト（`phaseMigration` / `labelMigration` / `templateConversions`）は PartyMember を含まないため影響なし（依存調査で確認済み）。

## 9. 受け入れ基準

実装完了の判定条件：

1. `npm run build` が警告ゼロで通る
2. `vitest run` で全テスト PASS（既存 253 + 新規追加分）
3. 既存プランをロードしたとき、計算結果が実装前と完全一致（互換性ガードテストで保証）
4. 新規 PartyMember 作成時、`mode: 'reborn'` が明示的に書き込まれる
5. 軽減配置・タイムライン表示・シールド計算など、ユーザー操作の挙動が実装前と完全一致（互換性ガードテストで自動保証 + ローカル動作確認）
6. UI に新しい要素が追加されていない（モード切替トグル・差分入力欄など一切なし）

## 10. 想定外への対応（YAGNI 線引き）

このインフラで吸収できる変化：

- スキル数値変更（軽減%、リキャスト、効果時間、heal increase、scope、type、isShield など）
- スキル削除（`disabled: true`）
- スキル追加（diff 側に full data）
- 既存フィールドの組み合わせ変更

このインフラでは吸収できない変化（8.0 アナウンス時に追加対応が必要）：

- `Mitigation` 型に新フィールドが必要な新概念（HP 状況分岐、スキル合体、新リソース）
- ジョブ自体の追加・削除・ロール変更
- スキル ID の改名（マッピングテーブルが必要）
- スキル間の関係性が変わる自動配置ロジック（学者エーテルフロー初期配置、オートプラン）

これらは **来てから対応**。先回りでの過剰設計はしない。

## 11. 8.0 アナウンス時に追加で必要な作業

このインフラが土台にあれば、8.0 公式情報が出てから以下の作業で対応完了する：

1. **admin 画面に「エヴォルヴ差分」入力 UI を追加**（既存 SkillFormModal 拡張）
2. **エヴォルヴ差分データを admin から投入**（コード修正なし）
3. **DEFAULT_NEW_MODE を `'evolved'` に切替**（1 行変更）
4. **PartyMember カードにモード切替 UI を追加**（既存 UI への小規模追加）
5. **必要なら autoPlanner 等の自動配置ロジックを mode 分岐対応**（要なら個別追加実装）

## 12. リスクと対策まとめ

| リスク | 評価 | 対策 |
|----|----|----|
| Optional フィールド追加で型エラー | 極小（既存コード触らない） | TypeScript strict 通過を Phase 1 で確認 |
| localStorage 既存データロードでクラッシュ | 極小（Zod 等のスキーマ無し） | 互換性ガードテストで明示確認 |
| Firestore 既存ドキュメントとの互換性 | 極小（型チェックなし） | 既存プランロードテストで確認 |
| サーバー API バリデーション失敗 | ゼロ（any 受信） | 調査済み、追加対応不要 |
| 計算ロジック書き換えでバグ混入 | 中 | フェーズ分け + 各 Phase で全テスト PASS 確認 |
| disabled スキル null 戻り値の handling 漏れ | 低（今は disabled データなし） | filter(Boolean) パターンで構造的に安全側 |
| スナップショットテスト更新漏れ | ゼロ（PartyMember 含む snapshot なし） | 調査済み、影響範囲外 |

---

## 付録: ファイル変更一覧

### 新規作成
- `src/utils/mitigationResolver.ts`
- `src/utils/__tests__/mitigationResolver.test.ts`

### 変更（型 Optional 追加）
- `src/types/index.ts`

### 変更（resolveMitigation 経由に書き換え）
- `src/utils/calculator.ts`
- `src/utils/autoPlanner.ts`
- `src/utils/resourceTracker.ts`
- `src/store/useMitigationStore.ts`（Mitigation 参照箇所のみ）

### 変更（DEFAULT_NEW_MODE 注入）
- `src/store/useMitigationStore.ts`（PartyMember 生成箇所）
- `src/store/usePlanStore.ts`（テンプレート読み込み時 PartyMember 生成）

### 変更なし（明示的に触らない）
- すべての UI コンポーネント
- すべての admin 画面
- すべての api/* サーバーサイドコード
- `src/utils/jobMigration.ts`（mode 非依存）
- Firestore スキーマ・ドキュメント

---

このインフラ追加によるユーザー目線の変化は **ゼロ**。8.0 アナウンス時の追加工数を最小化するための土台のみ準備する。
