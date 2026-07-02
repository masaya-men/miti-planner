# ハウジング登録ページ (Register) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新シェル `/housing/register` を本実装ページへ差し替え、「SNS URL 貼付→住所自動入力→土地ミニマップ点灯→公開/非公開で登録」が実機で通るようにする。あわせてタイトル・公開設定・公開終了日時のデータ基盤と、非公開を Firestore ルールで本当に隠す仕組みを入れる。

**Architecture:** データ基盤 (パートA: 型/バリデーション/サーバー/ルール/store/詳細ページ) を先に固め、その上に登録ページ UI (パートB) と土地ミニマップ部品 (パートC) を載せる。既存の登録ロジック資産 (`HousingRegisterForm` のフィールド状態・`parseHousingFromText` 自動入力・`checkDuplicate`・`registerListing`) を核に再利用し、見た目は質感A案トークンで新規に組む。非公開は「読む側でクエリ絞り込み + Firestore ルールで他人のデータごと拒否 + 期限は遅延評価」で成立させる。

**Tech Stack:** React 18 + TypeScript + Zustand + react-router-dom + react-i18next + Vitest (`pool='vmThreads'`)。Firestore (client 直読み + `/api/housing` 書き込み・Vercel Node Functions)。CSS = `src/styles/housing.css` (独自トンマナ・トークン経由)。地図 = `scripts/parse-ward-svg.mjs` 生成 JSON + Figma 書き出し SVG の `?raw` inline。

**Spec:** `docs/superpowers/specs/2026-07-02-housing-register-page-design.md`
**台帳:** `.superpowers/sdd/progress.md` (本 plan 用に更新すること)

## Global Constraints

- **ハウジング独自トンマナ**: 白黒のみ/Inter 禁止/honey 禁止 等の LoPo ルールは**適用外**。質感A案 (`.claude/rules/housing-design.md:31-42`) = 濃紺フラットパネル (`--housing-panel-bg`)・2アクセント (ハニー`--housing-honey`=主アクション / 青`--housing-aether`=`#00BFFF`=選択・進行・ステップ番号)・AI 感払拭 (色付き alert 箱/装飾ピル/過剰 glow 禁止・ヒントはヘアライン`border-top: 1px solid var(--housing-divider)`+グレー`var(--housing-text-mute)` 注記)・縦積みはコンテナ `gap` で余白リズム。
- **ハードコード禁止**: 色/font-size/寸法/影は `src/styles/housing.css` の `--housing-*` トークン経由。`style={{}}` に rgb/rgba/#hex/px 直書き禁止。新規トークンは housing.css 上部の `.housing-workspace,...` セレクタ群に追加。各コンポーネント新規時、最後に `rgb\(|rgba\(|#[0-9a-f]{3,8}|[0-9]px` を対象ファイルに grep 監査。
- **backdrop-filter 直書き禁止**: `blur(...)` リテラル不可。`var(--liquid-filter, none)` 等の変数参照は OK。
- **timestamp は number (epoch ms)**: `src/types/housing.ts` は Firebase SDK import を型層に持ち込まない規約 (`:13-18`)。`publishUntil` も `number | null`。Firestore Timestamp との変換は adapter/サーバー層。
- **i18n 4言語 parity**: 新規文言は `housing.register.*` に ja/en/ko/zh すべて追加。ロケール JSON (`src/locales/{ja,en,ko,zh}.json`) は**該当ブロックのみ textual 編集** (全体 parse→stringify 禁止、`[[feedback_locale_json_textual_edit]]`)。用語は「ハウジング」統一・「物件」禁止 (`[[feedback_terminology_housing]]`)。
- **用語 (UI 文言)**: 登録操作対象は「ハウジング」。「物件」は使わない。
- **push 前**: `npm run build` (tsc -b 厳密・未使用変数/型不足が罠 `[[feedback_vercel_tsc_strict]]`) + `npx vitest run` 緑。vitest は `npx vitest run <path>` を**直叩き** (パイプ禁止・重い UI 全体駆動テストは置かず純関数ユニット中心 `[[reference_vitest_appcheck_teardown]]` `[[reference_vitest_vmthreads_hang]]`)。
- **DOM テストの環境ディレクティブ (必須)**: `vitest.config.ts` の既定は `environment: 'node'` (`:6`)。`render()` / `screen` を使う DOM テストは**ファイル先頭に `// @vitest-environment happy-dom` を必ず書く** (無いと `document is not defined` で即失敗し TDD の赤緑が成立しない)。純関数ユニット (validation/publish/resolve/autosave 等) と i18n parity (locales JSON 直読み) は DOM 不要なのでディレクティブ不要。
- **テストの i18n セットアップ**: DOM テストの i18n は既存 `src/components/housing/pages/__tests__/FavoritesPage.test.tsx` の方式に合わせる (`import i18n from 'i18next'` + `initReactI18next` + `src/locales/ja.json` を手動 init。`src/i18n.ts` を直 import しない = init 副作用/localStorage 参照を避ける)。本 plan の各テスト例の `import i18n from '../../../../i18n'` は**この既存方式に読み替える** (実装時に FavoritesPage.test.tsx の冒頭をコピーして合わせる)。i18n parity テストのみ locales JSON 直読み。
- **API クライアントは buildHousingHeaders 経由必須**: 生 fetch は本番 403 (`[[reference_housing_appcheck_headers]]`)。
- **後方互換 (最重要)**: 旧登録モーダル `HousingRegisterFormModal` が `/housing/p/:listingId`・`/housing/tour/:tourId` (`src/components/housing/workspace/HousingWorkspace.tsx:145`) で本番稼働中。共有バリデーション/共有 API を壊さない。title 必須はサーバーでは強制せず新 RegisterPage クライアントで強制。checkDuplicate は既存 `duplicates` キーを温存し additive 拡張のみ。
- **merge しない**: 本スパン完成が merge 解禁ゲート。完成まで merge/push/デプロイ保留 (ローカル確認のみ、`[[feedback_deploy]]`)。Vercel Hobby ビルド枠のため push はまとめる (`[[feedback_vercel_builds]]`)。
- **確認は実画面**: ユーザーは spec/plan を読まない。視覚の区切りで「見て」と声かけ。開発者実画面 = CSS `1489x679` / DPR `2.58`。
- **登録データは使い捨て**: 既存 housing 登録は全て本人テストデータ = 自由に削除/バックフィル OK。軽減表 (本体) は絶対触らない (`[[feedback_housing_data_disposable]]`)。

---

## パートA — データ基盤

### Task 1: 型・定数・バリデーション (title / visibility / publishUntil)

**Files:**
- Modify: `src/constants/housing.ts` (`MAX_TITLE_LENGTH` 追加。既存 `MAX_DESCRIPTION_LENGTH` の隣)
- Modify: `src/types/housing.ts` (`HousingListing` に `title?` / `visibility?` / `publishUntil?` 追加。`title` は `description?` の隣 `:190-191`、`visibility`/`publishUntil` は `deletedAt` の後 `:220`)
- Modify: `src/utils/housingValidation.ts` (`RegistrationDraft` `:47-81` に 3 フィールド追加 / `validateTitle` 新設 / `validateRegistrationDraft` `:447-454` に配線)
- Modify: `src/lib/housing/galleryAdapter.ts` (`firestoreToGalleryListing` return `:45-77` に 3 フィールド pass-through)
- Modify: `src/data/housing/mockListings.ts` (`MockListing` `:13-65` に 3 フィールド optional 追加)
- Test: `src/utils/__tests__/housingValidation.title.test.ts` (新規)

**Interfaces:**
- Produces:
  - `MAX_TITLE_LENGTH = 50` (const, `src/constants/housing.ts`)
  - `HousingListing.title?: string` / `HousingListing.visibility?: 'public' | 'private'` / `HousingListing.publishUntil?: number | null` (`src/types/housing.ts`)
  - `RegistrationDraft.title?: string` / `.visibility?: 'public' | 'private'` / `.publishUntil?: number | null`
  - `validateTitle(title: string | undefined): ValidationResult`
  - `MockListing.title?: string` / `.visibility?: 'public' | 'private'` / `.publishUntil?: number | null`
- Consumes: 既存 `ValidationResult` = `{ ok: boolean; errors: Partial<Record<string, string>> }`、ヘルパ `ok()` / `fail(errors)` (`housingValidation.ts:83-87`)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/utils/__tests__/housingValidation.title.test.ts
import { describe, it, expect } from 'vitest';
import { validateTitle } from '../housingValidation';

describe('validateTitle', () => {
  it('undefined は ok (サーバー寛容・旧経路が title を送らないため)', () => {
    expect(validateTitle(undefined)).toEqual({ ok: true, errors: {} });
  });
  it('空文字/空白のみは required エラー', () => {
    expect(validateTitle('').ok).toBe(false);
    expect(validateTitle('   ').errors.title).toBe('required');
  });
  it('50字ちょうどは ok', () => {
    expect(validateTitle('あ'.repeat(50)).ok).toBe(true);
  });
  it('51字は too_long エラー', () => {
    expect(validateTitle('あ'.repeat(51)).errors.title).toBe('too_long');
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/utils/__tests__/housingValidation.title.test.ts`
Expected: FAIL (`validateTitle` が export されていない)

- [ ] **Step 3: 定数を追加**

`src/constants/housing.ts` の `MAX_DESCRIPTION_LENGTH` 定義行の直後に:

```ts
export const MAX_TITLE_LENGTH = 50;
```

- [ ] **Step 4: バリデータを実装**

`src/utils/housingValidation.ts`。冒頭の import 群に `MAX_TITLE_LENGTH` を既存の `HOUSING_LIMITS` / 定数 import 行へ追加。`validateDescription` (`:164-169`) の直後に:

```ts
export function validateTitle(title: string | undefined): ValidationResult {
  // undefined = 未送信 (旧登録モーダル経路)。サーバー共有バリデーションは寛容にし、
  // 必須の強制は新 RegisterPage / 編集モーダルのクライアント側で行う (spec A-1)。
  if (title === undefined) return ok();
  const trimmed = title.trim();
  if (trimmed.length === 0) return fail({ title: 'required' });
  if (trimmed.length > MAX_TITLE_LENGTH) return fail({ title: 'too_long' });
  return ok();
}
```

`RegistrationDraft` interface (`:47-81`) に追加:

```ts
  title?: string;
  visibility?: 'public' | 'private';
  publishUntil?: number | null;
```

`validateRegistrationDraft` (`:447-454`) の `validateDescription` 行の隣に配線:

```ts
  Object.assign(errors, validateTitle(draft.title).errors);
```

(visibility は列挙2値のみ・publishUntil の未来チェックはサーバー handler が行うため、ここでは型のみ。相関バリデータは新設しない = YAGNI。)

- [ ] **Step 5: 型定義を追加**

`src/types/housing.ts` の `HousingListing`。`description?: string;` (`:191`) の直後に:

```ts
  /** ハウジングのタイトル (新シェル登録ページで必須・50字。旧経路 doc には無い場合あり)。 */
  title?: string;
```

`deletedAt: number | null;` (`:220`) の直後 (閉じ `}` の直前) に:

```ts
  /** 公開設定。未設定の既存 doc は 'public' 扱い (バックフィルで付与)。 */
  visibility?: 'public' | 'private';
  /** 公開終了日時 (epoch ms)。null/未設定 = 無期限。過ぎたら遅延評価で非公開扱い。 */
  publishUntil?: number | null;
```

`src/data/housing/mockListings.ts` の `MockListing` (`:13-65`) の `description?: string;` の隣に同3フィールドを optional で追加 (`gen()` は optional なので無変更で通る)。

`src/lib/housing/galleryAdapter.ts` の return オブジェクト (`:45-77`) の `description: h.description,` の隣に:

```ts
    title: h.title,
    visibility: h.visibility,
    publishUntil: h.publishUntil,
```

- [ ] **Step 6: テストが通る**

Run: `npx vitest run src/utils/__tests__/housingValidation.title.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: build 確認**

Run: `npm run build`
Expected: tsc EXIT 0 (既存 `validateRegistrationDraft` 呼び出し側・adapter・MockListing 消費側で型エラーが出ないこと)

- [ ] **Step 8: Commit**

```bash
rtk git add src/constants/housing.ts src/types/housing.ts src/utils/housingValidation.ts src/lib/housing/galleryAdapter.ts src/data/housing/mockListings.ts src/utils/__tests__/housingValidation.title.test.ts
rtk git commit -m "feat(housing): 登録データ基盤にtitle/visibility/publishUntilを追加 (型/検証/adapter)"
```

---

### Task 2: 公開判定の純関数 (isEffectivelyPublic / mergeListingsForViewer)

**Files:**
- Create: `src/lib/housing/listingPublish.ts`
- Test: `src/lib/housing/__tests__/listingPublish.test.ts`

**Interfaces:**
- Produces:
  - `isEffectivelyPublic(listing: { visibility?: 'public' | 'private'; publishUntil?: number | null }, nowMs: number): boolean`
  - `mergeListingsForViewer(publicListings: MockListing[], myListings: MockListing[], viewerUid: string | null, nowMs: number): MockListing[]`
- Consumes: `MockListing` (`src/data/housing/mockListings.ts`、`ownerUid: string` / `id: string` を持つ)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/listingPublish.test.ts
import { describe, it, expect } from 'vitest';
import { isEffectivelyPublic, mergeListingsForViewer } from '../listingPublish';
import type { MockListing } from '../../../data/housing/mockListings';

const base = (over: Partial<MockListing>): MockListing =>
  ({ id: 'x', ownerUid: 'o', dc: 'Elemental', server: 'Gaia', region: 'JP',
     area: 'Mist', ward: 1, imageMode: 'none', tags: [], createdAt: 0,
     lastConfirmedAt: 0, addressKey: 'k', ...over } as MockListing);

const NOW = 1000;

describe('isEffectivelyPublic', () => {
  it('visibility 未設定は公開扱い', () => {
    expect(isEffectivelyPublic({}, NOW)).toBe(true);
  });
  it('private は非公開', () => {
    expect(isEffectivelyPublic({ visibility: 'private' }, NOW)).toBe(false);
  });
  it('publishUntil が未来なら公開', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: NOW + 1 }, NOW)).toBe(true);
  });
  it('publishUntil が過去なら非公開 (遅延評価)', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: NOW - 1 }, NOW)).toBe(false);
  });
  it('publishUntil が null なら無期限公開', () => {
    expect(isEffectivelyPublic({ visibility: 'public', publishUntil: null }, NOW)).toBe(true);
  });
});

describe('mergeListingsForViewer', () => {
  it('公開のみ表示 (未ログイン・他人の非公開は除外)', () => {
    const pub = [base({ id: 'a' })];
    const merged = mergeListingsForViewer(pub, [], null, NOW);
    expect(merged.map((l) => l.id)).toEqual(['a']);
  });
  it('自分の非公開は自分には表示・dedup される', () => {
    const pub = [base({ id: 'a', ownerUid: 'other' })];
    const mine = [base({ id: 'b', ownerUid: 'me', visibility: 'private' }),
                  base({ id: 'a', ownerUid: 'other' })]; // 重複 id
    const merged = mergeListingsForViewer(pub, mine, 'me', NOW);
    expect(merged.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });
  it('他人の期限切れ public は除外 (myListings に無いので落ちる)', () => {
    const pub = [base({ id: 'c', ownerUid: 'other', visibility: 'public', publishUntil: NOW - 1 })];
    const merged = mergeListingsForViewer(pub, [], 'me', NOW);
    expect(merged).toEqual([]);
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/lib/housing/__tests__/listingPublish.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: 実装**

```ts
// src/lib/housing/listingPublish.ts
import type { MockListing } from '../../data/housing/mockListings';

/**
 * 表示時点で「実質公開中」かを判定する遅延評価 (spec A-1)。
 * visibility 未設定 doc は公開扱い (バックフィル前の保険)。
 * publishUntil を過ぎていたら公開扱いしない。now は呼び出し側が渡す (閲覧端末の時計)。
 */
export function isEffectivelyPublic(
  listing: { visibility?: 'public' | 'private'; publishUntil?: number | null },
  nowMs: number,
): boolean {
  if (listing.visibility === 'private') return false;
  if (listing.publishUntil != null && listing.publishUntil <= nowMs) return false;
  return true;
}

/**
 * 一覧表示用に「公開クエリの結果」と「自分の登録クエリの結果」を合流する (spec A-3)。
 * - 公開クエリ結果からは他人の期限切れ (実質非公開) を除外する。
 * - 自分の登録は visibility/期限に関係なく全て残す (本人はバッジ付きで見える)。
 * - id で dedup (自分の公開物件が両クエリに出るため)。
 */
export function mergeListingsForViewer(
  publicListings: MockListing[],
  myListings: MockListing[],
  viewerUid: string | null,
  nowMs: number,
): MockListing[] {
  const byId = new Map<string, MockListing>();
  for (const l of publicListings) {
    if (l.ownerUid === viewerUid || isEffectivelyPublic(l, nowMs)) byId.set(l.id, l);
  }
  for (const l of myListings) {
    if (l.ownerUid === viewerUid) byId.set(l.id, l);
  }
  return Array.from(byId.values());
}
```

- [ ] **Step 4: テストが通る**

Run: `npx vitest run src/lib/housing/__tests__/listingPublish.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/housing/listingPublish.ts src/lib/housing/__tests__/listingPublish.test.ts
rtk git commit -m "feat(housing): 公開判定の純関数 isEffectivelyPublic/mergeListingsForViewer"
```

---

### Task 3: サーバーハンドラ + クライアント API 型 (additive)

**Files:**
- Modify: `api/housing/_registerListingHandler.ts` (listing 構築 `:79-111` に visibility default / publishUntil / title)
- Modify: `api/housing/_updateListingHandler.ts` (updatePayload `:90-118` + draftForValidation 組み立て `:56-74` に 3 フィールド)
- Modify: `api/housing/_checkDuplicateHandler.ts` (`:36-71` に privateMatchCount を additive)
- Modify: `src/lib/housingApiClient.ts` (`CheckDuplicateResponse` に `privateMatchCount?` 追加)
- Test: `src/utils/__tests__/housingValidation.title.test.ts` は Task1 で作成済。ここはサーバーロジックの純部分を `api/housing/__tests__/checkDuplicatePrivate.test.ts` で検証

**Interfaces:**
- Produces: `CheckDuplicateResponse = { duplicates: DuplicateEntry[]; privateMatchCount?: number }` (既存 `duplicates` 温存)。register/update handler が visibility/publishUntil/title を保存。
- Consumes: 既存 `DuplicateEntry = { id; ownerUid; createdAt; tags }`、`validateRegistrationDraft`、`RegisterListingResponse = { id; addressKey }`。

- [ ] **Step 1: register handler に新フィールドを保存**

`api/housing/_registerListingHandler.ts` の `listing` オブジェクト (`:79-111`)。`deletedAt: null,` の直後に:

```ts
  // 公開設定 (spec A-1/A-3): 未送信は 'public' を必ず書き込む (旧クライアント互換 +
  // 全 doc に visibility が載る保証 = ルール締めの前提)。
  visibility: draft.visibility === 'private' ? 'private' : 'public',
  publishUntil:
    typeof draft.publishUntil === 'number' && draft.publishUntil > now
      ? draft.publishUntil
      : null,
  ...(draft.title && draft.title.trim() ? { title: draft.title.trim() } : {}),
```

(`now` は同ハンドラ内で既出。publishUntil はサーバー時計 `now` より未来のときだけ採用 = 過去/改ざん入力を無効化。)

- [ ] **Step 2: update handler に新フィールドを反映**

`api/housing/_updateListingHandler.ts`。`draftForValidation` 組み立て (`:56-74`) に、`req.body` の updates から title/visibility/publishUntil を渡す行を追加 (既存の詰め替えパターンに合わせる)。次に `updatePayload` (`:90-118`) の末尾付近 (`tx.update` の前) に:

```ts
  if (draftForValidation.visibility === 'public' || draftForValidation.visibility === 'private') {
    updatePayload.visibility = draftForValidation.visibility;
  }
  if ('publishUntil' in draftForValidation) {
    const pu = draftForValidation.publishUntil;
    updatePayload.publishUntil = typeof pu === 'number' && pu > Date.now() ? pu : null;
  }
  if (typeof draftForValidation.title === 'string' && draftForValidation.title.trim()) {
    updatePayload.title = draftForValidation.title.trim();
  }
```

- [ ] **Step 3: checkDuplicate に privateMatchCount を additive 追加 — 失敗するテスト**

```ts
// api/housing/__tests__/checkDuplicatePrivate.test.ts
import { describe, it, expect } from 'vitest';
import { splitDuplicates } from '../_checkDuplicateHandler';

// splitDuplicates(docs): 公開分の要約配列と、非公開分の件数を返す純関数。
describe('splitDuplicates', () => {
  it('公開は duplicates に要約・非公開は件数だけ', () => {
    const docs = [
      { id: '1', data: () => ({ ownerUid: 'a', createdAt: 1, tags: ['x'], visibility: 'public' }) },
      { id: '2', data: () => ({ ownerUid: 'b', createdAt: 2, tags: [], visibility: 'private' }) },
      { id: '3', data: () => ({ ownerUid: 'c', createdAt: 3, tags: [] }) }, // 未設定=公開
    ] as any;
    const r = splitDuplicates(docs);
    expect(r.duplicates.map((d) => d.id).sort()).toEqual(['1', '3']);
    expect(r.privateMatchCount).toBe(1);
  });
});
```

- [ ] **Step 4: 実行して落ちる**

Run: `npx vitest run api/housing/__tests__/checkDuplicatePrivate.test.ts`
Expected: FAIL (`splitDuplicates` not exported)

- [ ] **Step 5: splitDuplicates を切り出して実装**

`api/housing/_checkDuplicateHandler.ts`。現行の `duplicates` map ロジック (`:57-64`) を純関数に抽出:

```ts
export function splitDuplicates(
  docs: Array<{ id: string; data: () => Record<string, unknown> }>,
): { duplicates: Array<{ id: string; ownerUid: unknown; createdAt: unknown; tags: unknown }>; privateMatchCount: number } {
  const alive = docs.filter((d) => !d.data().deletedAt);
  const publicDocs = alive.filter((d) => (d.data().visibility ?? 'public') !== 'private');
  const privateMatchCount = alive.length - publicDocs.length;
  const duplicates = publicDocs.slice(0, 5).map((doc) => ({
    id: doc.id,
    ownerUid: doc.data().ownerUid,
    createdAt: doc.data().createdAt,
    tags: doc.data().tags ?? [],
  }));
  return { duplicates, privateMatchCount };
}
```

ハンドラ本体 (`:55-67`) を差し替え:

```ts
  const { duplicates, privateMatchCount } = splitDuplicates(snap.docs);
  return res.status(200).json({ duplicates, privateMatchCount });
```

(既存 `duplicates` キーは温存 = 旧クライアント無傷。`privateMatchCount` を additive 追加。)

- [ ] **Step 6: クライアント型を additive 拡張**

`src/lib/housingApiClient.ts` の `CheckDuplicateResponse` (`:65` 付近) に:

```ts
export interface CheckDuplicateResponse {
  duplicates: DuplicateEntry[];
  /** 同住所の非公開登録の件数 (中身は返さない・匿名の重複告知用)。 */
  privateMatchCount?: number;
}
```

- [ ] **Step 7: テストが通る + build**

Run: `npx vitest run api/housing/__tests__/checkDuplicatePrivate.test.ts`
Expected: PASS (1 test)
Run: `npm run build`
Expected: tsc EXIT 0

- [ ] **Step 8: 既存の重複/登録テストが緑のまま**

Run: `npx vitest run src/lib/housingApiClient.test.ts src/__tests__/housing/HousingRegisterFormModal.test.tsx`
Expected: PASS (既存 `duplicates` 消費が壊れていないこと。落ちたら additive 違反なので Step5-6 を見直す)

- [ ] **Step 9: Commit**

```bash
rtk git add api/housing/_registerListingHandler.ts api/housing/_updateListingHandler.ts api/housing/_checkDuplicateHandler.ts src/lib/housingApiClient.ts api/housing/__tests__/checkDuplicatePrivate.test.ts
rtk git commit -m "feat(housing): サーバーに公開設定保存+重複チェックの非公開匿名件数 (additive)"
```

---

### Task 4: Firestore ルール + インデックス + バックフィル

**Files:**
- Modify: `firestore.rules` (housing_listings read `:264` を締める + create/update に visibility 型検証)
- Modify: `firestore.indexes.json` (複合インデックス追加)
- Create: `scripts/backfill-housing-visibility.mjs` (admin SDK・visibility 未設定 doc に 'public' 付与)
- Create: `src/__tests__/housing/firestoreRules.visibility.test.ts` (@firebase/rules-unit-testing。存在すれば流用、無ければ導入判断)
- Test: 上記 rules テスト

**Interfaces:**
- Produces: read ルール = 公開 or 本人。バックフィルスクリプト (手動実行)。
- Consumes: 既存 helper `isAuthenticated()` (`firestore.rules:10-12`) / `isOwner(uid)` (`:15-17`)。

- [ ] **Step 1: rules-unit-testing の有無を確認**

Run: `npx vitest run --reporter=verbose 2>&1 | head -5` は使わず、`package.json` を Read して `@firebase/rules-unit-testing` が devDependencies にあるか確認。無い & エミュレータ未整備なら、**このスパンでは rules テストを新規導入せず、ルール変更は「Step 7 の手動エミュレータ検証 or dev 実機での一覧表示確認」で代替**し、その旨を台帳に記録する (エミュレータ導入自体が別スパン級のため)。ある場合は Step 5 のテストを書く。

- [ ] **Step 2: read ルールを締める**

`firestore.rules` の `match /housing_listings/{listingId}` 内 `allow read: if true;` (`:264`) を:

```
      allow read: if resource.data.visibility == 'public'
                  || (isAuthenticated() && resource.data.ownerUid == request.auth.uid);
```

(素朴な等価比較。`resource.data.get()` は list クエリの静的証明で扱える保証が裏取りできないため不採用 — バックフィル + サーバー default 付与で「visibility 無し doc は存在しない」を保証する。)

- [ ] **Step 3: create/update に visibility 型検証を追加**

`allow create` (`:266-306`) の条件群に (owner 検証と並べて):

```
                    && (!('visibility' in request.resource.data)
                        || request.resource.data.visibility in ['public', 'private'])
```

`allow update` (`:308-346`) の検証群にも同じ visibility 妥当性チェックを追加 (owner/addressKey/reportCount/isHidden 改ざん禁止は既存のまま維持)。title/publishUntil は型が緩いので rules では強制しない (サーバー validate + クライアント強制で担保)。

- [ ] **Step 4: インデックスを追加**

`firestore.indexes.json` の `indexes` 配列に **1 本だけ**追加 (既存 3 本は温存):

```json
    {
      "collectionGroup": "housing_listings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "visibility", "order": "ASCENDING" },
        { "fieldPath": "isHidden", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
```

(getGalleryListings に `where('visibility','==','public')` を足すと `visibility + isHidden + createdAt DESC` の 3 フィールド複合が要る。**getMyListings は Task5 で orderBy を付けず client sort にする**ので `ownerUid + createdAt` 複合インデックスは追加しない — 単一等値 `where('ownerUid')` は自動インデックスで足りる。equality のみの他4関数 (findListingsByAddressKey 等) は `visibility` を足しても既存の等値組み合わせで動く可能性が高いが、**実装時にエミュレータ/実機で missing-index エラーが出たら該当分だけ追加する**。)

- [ ] **Step 5: (rules-unit-testing がある場合のみ) ルールテストを書く**

```ts
// src/__tests__/housing/firestoreRules.visibility.test.ts
// @firebase/rules-unit-testing でエミュレータに対し:
// - 他人の visibility:'private' doc の get が拒否される
// - 本人の private doc の get が許可される
// - where('visibility','==','public') の list が誰でも通る
// (エミュレータ起動が前提。CI 未整備ならローカル手動)
```

具体テストはエミュレータ設定に依存するため、導入時に `@firebase/rules-unit-testing` の `initializeTestEnvironment` / `assertFails` / `assertSucceeds` を使って上記3ケースを書く。

- [ ] **Step 6: バックフィルスクリプトを作成**

```js
// scripts/backfill-housing-visibility.mjs
// 使い方: node scripts/backfill-housing-visibility.mjs
// visibility 未設定の housing_listings 全 doc に visibility:'public' を付与する。
// 既存物件は全て本人テストデータ = 安全。dev/本番同一 Firestore のため開発着手時に実行。
// admin 初期化は既存 scripts/seed-firestore.mjs の cert パターンをインライン展開 (共通 helper は無い)。
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// ⚠ 実装時に scripts/seed-firestore.mjs:14-60 の実際の env 変数名・privateKey の
// 改行復元 (replace(/\\n/g, '\n')) 処理をそのままコピーして合わせること (推測しない)。
initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
  }),
});

async function main() {
  const db = getFirestore();
  const snap = await db.collection('housing_listings').get();
  let updated = 0;
  const batchSize = 400;
  let batch = db.batch();
  let n = 0;
  for (const doc of snap.docs) {
    if (doc.data().visibility === undefined) {
      batch.update(doc.ref, { visibility: 'public' });
      updated++; n++;
      if (n >= batchSize) { await batch.commit(); batch = db.batch(); n = 0; }
    }
  }
  if (n > 0) await batch.commit();
  console.log(`backfilled visibility='public' on ${updated} docs`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

env 変数名・privateKey の改行復元・(必要なら) dotenv 読み込みは `scripts/seed-firestore.mjs:14-60` を実際に読んで合わせること (`[[feedback_evidence_based_work]]`・推測禁止)。

- [ ] **Step 7: バックフィルを実行して検証**

Run: `node scripts/backfill-housing-visibility.mjs`
Expected: `backfilled visibility='public' on N docs` (N = 既存件数)。以後、開発中の新クエリ (`where('visibility','==','public')`) が既存 doc にヒットする。**ルールは deploy しない** (merge 時の本番反映まで read:true のまま = 開発中の新クエリは動く)。

- [ ] **Step 8: build 確認 + Commit**

Run: `npm run build`
Expected: EXIT 0 (rules/json/mjs は tsc 対象外だが、テスト追加時の型を含めて緑)

```bash
rtk git add firestore.rules firestore.indexes.json scripts/backfill-housing-visibility.mjs
rtk git commit -m "feat(housing): 非公開をルールで隠す (read締め+index+visibilityバックフィル)"
```

---

### Task 5: store loadMine + 一覧合流 + カードバッジ

**Files:**
- Modify: `src/lib/housingListingsService.ts` (`getGalleryListings` に visibility フィルタ + 他4関数にも `where('visibility','==','public')` + `getMyListings(uid)` 新設)
- Modify: `src/store/useHousingListingsStore.ts` (`myListings` state + `loadMine(uid)` + `clearMine()`)
- Modify: `src/components/housing/shell/HousingShell.tsx` (auth 購読で loadMine/clearMine)
- Modify: `src/components/housing/pages/BrowsePage.tsx` / `FavoritesPage.tsx` (`mergeListingsForViewer` で表示リスト合流)
- Modify: `src/components/housing/browse/ListingCard.tsx` (自分の非公開/期限切れバッジ)
- Test: `src/store/__tests__/useHousingListingsStore.mine.test.ts`

**Interfaces:**
- Produces:
  - `getMyListings(uid: string): Promise<HousingListing[]>` (`housingListingsService.ts`)
  - store に `myListings: MockListing[]` / `myStatus: HousingListingsStatus` / `loadMine(uid: string): Promise<void>` / `clearMine(): void`
- Consumes: `mergeListingsForViewer` (Task2)、`isEffectivelyPublic` (Task2)、`firestoreToGalleryListing` (adapter)、`sortListingsForGallery`。

- [ ] **Step 1: service に visibility フィルタと getMyListings を追加**

`src/lib/housingListingsService.ts`:
- `getGalleryListings` (`:122-133`) のクエリに `where('visibility', '==', 'public'),` を `where('isHidden', '==', false),` の隣に追加。
- 他4関数 (`findListingsByAddressKey` / `findChambersInPlot` / `findHouseForChamber` / `findApartmentRoomsInWard`) にも同 `where('visibility', '==', 'public')` を追加 (ルール適合のため)。
- 末尾に新関数:

```ts
/** spec A-3: 自分の登録一覧 (公開/非公開/期限切れ問わず)。client 側で createdAt desc ソート。 */
export async function getMyListings(uid: string): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('ownerUid', '==', uid),
    limit(200),
  );
  const snap = await getDocs(qref);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) }))
    .filter((l) => l.deletedAt == null)
    .sort((a, b) => b.createdAt - a.createdAt);
}
```

(**orderBy を付けず client sort** にすることで `ownerUid + createdAt` 複合インデックスを不要にする = Task4 Step4 の 2 本目インデックスは削ってよい。単一等値 `where('ownerUid')` は自動インデックスで足りる。この判断を Task4 と揃えること。)

- [ ] **Step 2: 失敗するテストを書く (store)**

```ts
// src/store/__tests__/useHousingListingsStore.mine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useHousingListingsStore } from '../useHousingListingsStore';

describe('useHousingListingsStore.clearMine', () => {
  beforeEach(() => useHousingListingsStore.getState().reset());
  it('clearMine で myListings が空になる', () => {
    useHousingListingsStore.setState({ myListings: [{ id: 'x' } as any], myStatus: 'ready' });
    useHousingListingsStore.getState().clearMine();
    expect(useHousingListingsStore.getState().myListings).toEqual([]);
    expect(useHousingListingsStore.getState().myStatus).toBe('idle');
  });
});
```

(loadMine の Firestore 実 fetch は vmThreads ハング回避のためテストしない — clearMine の純同期部分のみ。`[[reference_vitest_vmthreads_hang]]`)

- [ ] **Step 3: 実行して落ちる**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.mine.test.ts`
Expected: FAIL (`clearMine` 未定義)

- [ ] **Step 4: store に myListings / loadMine / clearMine を実装**

`src/store/useHousingListingsStore.ts` の `HousingListingsState` に追加:

```ts
  myListings: MockListing[];
  myStatus: HousingListingsStatus;
  loadMine: (uid: string) => Promise<void>;
  clearMine: () => void;
```

`INITIAL` に `myListings: [], myStatus: 'idle'` を追加。実装 (既存 `load` の動的 import パターンを踏襲):

```ts
  loadMine: async (uid) => {
    set({ myStatus: 'loading' });
    try {
      const [{ getMyListings }, { firestoreToGalleryListing }] = await Promise.all([
        import('../lib/housingListingsService'),
        import('../lib/housing/galleryAdapter'),
      ]);
      const docs = await getMyListings(uid);
      const myListings = docs
        .map(firestoreToGalleryListing)
        .filter((l): l is MockListing => l !== null);
      set({ myStatus: 'ready', myListings });
    } catch {
      set({ myStatus: 'error' });
    }
  },
  clearMine: () => set({ myListings: [], myStatus: 'idle' }),
```

- [ ] **Step 5: HousingShell で auth を購読して loadMine/clearMine**

`src/components/housing/shell/HousingShell.tsx`。既存の listings `load()` (`:19-21`) に加え、auth 状態を購読する effect を追加:

```tsx
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    const store = useHousingListingsStore.getState();
    if (user?.uid) store.loadMine(user.uid);
    else store.clearMine();
  }, [user?.uid]);
```

(`useAuthStore` を import。auth 復元は非同期 = `user` が後から埋まるが、この effect が uid 変化で再実行され自分の登録を合流する。ログアウトで clearMine。)

- [ ] **Step 6: BrowsePage / FavoritesPage で表示リストを合流**

両ページで `useHousingListingsStore((s) => s.listings)` を読んでいる箇所に加え `myListings` と `useAuthStore` の uid を読み、表示に使う配列を `mergeListingsForViewer(...)` で作り、**`sortListingsForGallery` で createdAt desc に並べ直してから** `applyFilters` / `orderFavorites` に渡す (合流で後付けされる自分の登録が無秩序に末尾へ来るのを防ぐ)。フィルタ/お気に入り解決ロジック自体は不変。

```tsx
// 例 (BrowsePage): filtered を作る前段。sortListingsForGallery を import。
const merged = useMemo(
  () => sortListingsForGallery(mergeListingsForViewer(listings, myListings, uid, Date.now())),
  [listings, myListings, uid],
);
// 以降 applyFilters(merged, ...) を使う
```

- [ ] **Step 7: ListingCard に自分向けバッジ**

`src/components/housing/browse/ListingCard.tsx`。listing が `ownerUid === 自分` かつ `visibility === 'private'` なら「非公開」バッジ、`isEffectivelyPublic(listing, Date.now()) === false` かつ public なら「期限切れ」バッジをカード上に出す。バッジは既存の card chrome に非破壊で追加 (色は `--housing-text-mute` 系の静かな注記・色付き箱にしない)。i18n キー `housing.register.badge_private` / `housing.register.badge_expired` (Task16 で4言語追加)。viewerUid は `useAuthStore((s) => s.user?.uid ?? null)`。

- [ ] **Step 8: テスト + build**

Run: `npx vitest run src/store/__tests__/useHousingListingsStore.mine.test.ts src/lib/housing/__tests__/listingPublish.test.ts`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 9: 探す/お気に入りの回帰確認**

Run: `npx vitest run src/components/housing/pages/__tests__/`
Expected: PASS (既存 BrowsePage/FavoritesPage テストが緑。合流で他人視点の表示が変わらないこと)

- [ ] **Step 10: Commit**

```bash
rtk git add src/lib/housingListingsService.ts src/store/useHousingListingsStore.ts src/components/housing/shell/HousingShell.tsx src/components/housing/pages/BrowsePage.tsx src/components/housing/pages/FavoritesPage.tsx src/components/housing/browse/ListingCard.tsx src/store/__tests__/useHousingListingsStore.mine.test.ts
rtk git commit -m "feat(housing): 自分の登録を一覧に合流 (loadMine+merge+非公開/期限切れバッジ)"
```

---

### Task 6: 詳細ページの可視性ハードニング

**Files:**
- Modify: `src/lib/housing/listingVisibility.ts` (`canViewListing` に期限切れ判定を組み込み)
- Modify: `src/components/housing/listing/HousingDetailPage.tsx` (auth-ready 待ち + permission-denied→not_found + uid 取得を useAuthStore に統一)
- Test: `src/lib/housing/__tests__/listingVisibility.test.ts` (既存があれば追記・無ければ新規)

**Interfaces:**
- Produces: `canViewListing(listing, viewerUid, nowMs?)` — 他人の実質非公開を不可に。第3引数 `nowMs = Date.now()` 既定のため、**同じ関数を呼ぶ `HousingDetailModalRoute.tsx:77` も改修なしで非公開/期限切れ判定が自動で効く** (ModalRoute の auth-ready 待ちハードニングはスコープ外だが、可視性判定自体は追従する)。
- Consumes: `isEffectivelyPublic` (Task2)、`useAuthStore` (user/loading)。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// src/lib/housing/__tests__/listingVisibility.test.ts
import { describe, it, expect } from 'vitest';
import { canViewListing } from '../listingVisibility';

const NOW = 1000;
describe('canViewListing (visibility 拡張)', () => {
  it('他人の private は不可', () => {
    expect(canViewListing({ ownerUid: 'o', visibility: 'private' }, 'me', NOW)).toBe(false);
  });
  it('本人の private は可', () => {
    expect(canViewListing({ ownerUid: 'me', visibility: 'private' }, 'me', NOW)).toBe(true);
  });
  it('他人の期限切れ public は不可', () => {
    expect(canViewListing({ ownerUid: 'o', visibility: 'public', publishUntil: NOW - 1 }, 'me', NOW)).toBe(false);
  });
  it('deletedAt は従来どおり全員不可', () => {
    expect(canViewListing({ ownerUid: 'me', deletedAt: 123 }, 'me', NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/lib/housing/__tests__/listingVisibility.test.ts`
Expected: FAIL (visibility 未対応)

- [ ] **Step 3: canViewListing を拡張**

`src/lib/housing/listingVisibility.ts` の `ListingVisibilityInput` に `visibility?: 'public' | 'private'` / `publishUntil?: number | null` を追加。`canViewListing` シグネチャに `nowMs = Date.now()` を第3引数で追加し、`deletedAt` チェックの後に:

```ts
  const isOwner = listing.ownerUid === viewerUid;
  if (!isOwner && !isEffectivelyPublic(listing, nowMs)) return false;
```

(`isEffectivelyPublic` を import。既存の `isHidden` チェックは維持。)

- [ ] **Step 4: 詳細ページの fetch を auth-ready 待ち + catch 分類**

`src/components/housing/listing/HousingDetailPage.tsx`:
- 現行は uid を `auth.currentUser?.uid` (Firebase SDK 直・`:48`) で取っている。これを **`useAuthStore((s) => s.user)` / `useAuthStore((s) => s.loading)` に統一**する。`loading === true` の間は fetch を開始しない (useEffect 内で早期 return、deps に `loading` と `user?.uid` を追加)。これで直リンク/リロード時に auth 復元前の getDoc で本人の非公開が誤って拒否される事故を防ぐ。
- catch 節 (`:57-61`) で Firebase の permission-denied を not_found に分類:

```tsx
  } catch (e) {
    if (cancelled) return;
    const code = (e as { code?: string })?.code;
    if (code === 'permission-denied') { setState({ kind: 'not_found' }); return; }
    const message = e instanceof Error ? e.message : 'unknown_error';
    setState({ kind: 'error', message });
  }
```

- `canViewListing(data, uid)` 呼び出し (`:48` 付近) は第3引数 now 省略で `Date.now()` 既定が効く。

- [ ] **Step 5: テスト + build**

Run: `npx vitest run src/lib/housing/__tests__/listingVisibility.test.ts`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 6: Commit**

```bash
rtk git add src/lib/housing/listingVisibility.ts src/components/housing/listing/HousingDetailPage.tsx src/lib/housing/__tests__/listingVisibility.test.ts
rtk git commit -m "feat(housing): 詳細ページの可視性を締める (他人の非公開/期限切れ不可+auth待ち)"
```

---

## パートC — 土地ミニマップ (先にパートB が使うため C を先行)

### Task 7: 地図データ準備 (10 JSON + 10 表示SVG + マニフェスト + 解決関数)

**Files:**
- Create: `src/data/housing/{mistSub,goblet,gobletSub,lavender,lavenderSub,shirogane,shiroganeSub,empyreum,empyreumSub}Ward.generated.json` (parse-ward-svg.mjs で生成)
- Create: `src/data/housing/{mistSub,goblet,...}.generated.svg` (docs/housing-maps-src の対応 SVG をコピー)
- Create: `src/data/housing/wardMapManifest.ts` (mapKey → lazy loader)
- Create: `src/lib/housing/resolveWardMapRef.ts` (住所→地図参照の純関数)
- Test: `src/lib/housing/__tests__/resolveWardMapRef.test.ts`

**Interfaces:**
- Produces:
  - `resolveWardMapRef(area: string, plot: number | null | undefined, apartmentBuilding: 1 | 2 | null | undefined, buildingType: 'house' | 'apartment' | undefined): { mapKey: string; highlightPlot: number; highlightKind: 'plot' | 'apart' } | null` (解決不能時は戻り値全体が `null`。`highlightPlot` 自体は常に `number`)
  - `WARD_MAP_LOADERS: Record<string, () => Promise<{ json: WardMapJson; svg: string }>>` (`wardMapManifest.ts`)
  - `WardMapJson` 型 (area/viewBox/nodes/edges/houses/roadPath/visibleRoadPath)
- Consumes: `scripts/parse-ward-svg.mjs`、`docs/housing-maps-src/*.svg`。

- [ ] **Step 1: 9 マップ分の JSON を生成 (3引数を明示)**

Run (mist 本街 `mistWard.generated.json` は既存を温存・再生成しない。以下9本):

```bash
node scripts/parse-ward-svg.mjs docs/housing-maps-src/mist-sub.svg Mist src/data/housing/mistSubWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/goblet-main.svg Goblet src/data/housing/gobletWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/goblet-sub.svg Goblet src/data/housing/gobletSubWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/lavender-main.svg LavenderBeds src/data/housing/lavenderWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/lavender-sub.svg LavenderBeds src/data/housing/lavenderSubWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/shirogane-main.svg Shirogane src/data/housing/shiroganeWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/shirogane-sub.svg Shirogane src/data/housing/shiroganeSubWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/empyreum-main.svg Empyreum src/data/housing/empyreumWard.generated.json
node scripts/parse-ward-svg.mjs docs/housing-maps-src/empyreum-sub.svg Empyreum src/data/housing/empyreumSubWard.generated.json
```

Expected: 各コマンドが houses 30 (+apart) / nodes / edges 数のサマリを出力。**必ず第3引数 (出力先) を明示** — 省略すると全部 `mistWard.generated.json` を上書きして既存を破壊する (`parse-ward-svg.mjs:11`)。

- [ ] **Step 2: 表示用 SVG を 10 枚コピー**

mist 本街の表示 SVG は既存 `src/data/housing/mist.generated.svg` (= `docs/housing-maps-src/mist.svg` のコピー、生成スクリプトなし = 手動コピー)。残り 9 枚を同様にコピー:

```bash
cp docs/housing-maps-src/mist-sub.svg src/data/housing/mistSub.generated.svg
cp docs/housing-maps-src/goblet-main.svg src/data/housing/goblet.generated.svg
cp docs/housing-maps-src/goblet-sub.svg src/data/housing/gobletSub.generated.svg
cp docs/housing-maps-src/lavender-main.svg src/data/housing/lavender.generated.svg
cp docs/housing-maps-src/lavender-sub.svg src/data/housing/lavenderSub.generated.svg
cp docs/housing-maps-src/shirogane-main.svg src/data/housing/shirogane.generated.svg
cp docs/housing-maps-src/shirogane-sub.svg src/data/housing/shiroganeSub.generated.svg
cp docs/housing-maps-src/empyreum-main.svg src/data/housing/empyreum.generated.svg
cp docs/housing-maps-src/empyreum-sub.svg src/data/housing/empyreumSub.generated.svg
```

(PowerShell なら `Copy-Item`。各 73-85KB。1 マップずつ動的 import するので初期バンドルには載らない。)

- [ ] **Step 3: マニフェストを作成 (遅延ロード)**

```ts
// src/data/housing/wardMapManifest.ts
export interface WardMapJson {
  area: string;
  viewBox: { w: number; h: number };
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ a: string; b: string; polyline: [number, number][] }>;
  houses: Array<{ kind: 'plot' | 'apart'; plot: number; x: number; y: number; node: string | null }>;
  roadPath: string;
  visibleRoadPath: string;
}

type WardMapAsset = { json: WardMapJson; svg: string };

/** mapKey → 遅延ローダ。Vite の動的 import + ?raw で該当マップだけ読む。 */
export const WARD_MAP_LOADERS: Record<string, () => Promise<WardMapAsset>> = {
  mist: async () => ({
    json: (await import('./mistWard.generated.json')).default as WardMapJson,
    svg: (await import('./mist.generated.svg?raw')).default,
  }),
  'mist-sub': async () => ({
    json: (await import('./mistSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./mistSub.generated.svg?raw')).default,
  }),
  goblet: async () => ({
    json: (await import('./gobletWard.generated.json')).default as WardMapJson,
    svg: (await import('./goblet.generated.svg?raw')).default,
  }),
  'goblet-sub': async () => ({
    json: (await import('./gobletSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./gobletSub.generated.svg?raw')).default,
  }),
  lavender: async () => ({
    json: (await import('./lavenderWard.generated.json')).default as WardMapJson,
    svg: (await import('./lavender.generated.svg?raw')).default,
  }),
  'lavender-sub': async () => ({
    json: (await import('./lavenderSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./lavenderSub.generated.svg?raw')).default,
  }),
  shirogane: async () => ({
    json: (await import('./shiroganeWard.generated.json')).default as WardMapJson,
    svg: (await import('./shirogane.generated.svg?raw')).default,
  }),
  'shirogane-sub': async () => ({
    json: (await import('./shiroganeSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./shiroganeSub.generated.svg?raw')).default,
  }),
  empyreum: async () => ({
    json: (await import('./empyreumWard.generated.json')).default as WardMapJson,
    svg: (await import('./empyreum.generated.svg?raw')).default,
  }),
  'empyreum-sub': async () => ({
    json: (await import('./empyreumSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./empyreumSub.generated.svg?raw')).default,
  }),
};
```

- [ ] **Step 4: 解決関数の失敗テストを書く**

```ts
// src/lib/housing/__tests__/resolveWardMapRef.test.ts
import { describe, it, expect } from 'vitest';
import { resolveWardMapRef } from '../resolveWardMapRef';

describe('resolveWardMapRef', () => {
  it('本街の家 (plot 1-30) は main マップ・そのままの plot', () => {
    expect(resolveWardMapRef('Mist', 15, null, 'house'))
      .toEqual({ mapKey: 'mist', highlightPlot: 15, highlightKind: 'plot' });
  });
  it('拡張街の家 (plot 31-60) は sub マップ・plot-30 に読み替え', () => {
    expect(resolveWardMapRef('Goblet', 45, null, 'house'))
      .toEqual({ mapKey: 'goblet-sub', highlightPlot: 15, highlightKind: 'plot' });
  });
  it('アパート本街 (building 1) は main の apart', () => {
    expect(resolveWardMapRef('Shirogane', null, 1, 'apartment'))
      .toEqual({ mapKey: 'shirogane', highlightPlot: 1, highlightKind: 'apart' });
  });
  it('アパート拡張街 (building 2) は sub の apart', () => {
    expect(resolveWardMapRef('Empyreum', null, 2, 'apartment'))
      .toEqual({ mapKey: 'empyreum-sub', highlightPlot: 1, highlightKind: 'apart' });
  });
  it('エリア不明は null', () => {
    expect(resolveWardMapRef('Unknown', 1, null, 'house')).toBeNull();
  });
  it('plot 未確定は null', () => {
    expect(resolveWardMapRef('Mist', null, null, 'house')).toBeNull();
  });
});
```

- [ ] **Step 5: 実行して落ちる**

Run: `npx vitest run src/lib/housing/__tests__/resolveWardMapRef.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 6: 解決関数を実装**

```ts
// src/lib/housing/resolveWardMapRef.ts
// 住所 → 表示すべき地図 mapKey とハイライト対象を解決する純関数 (spec パートC)。
// FF14 仕様: 拡張街の家は plot 31-60 (SVG は 1-30 命名なので -30 読み替え)。
// アパート棟 1=本街 / 2=拡張。FC 個室は親の家 plot をハイライト (呼び出し側で plot を渡す)。

const AREA_TO_KEY: Record<string, string> = {
  Mist: 'mist',
  LavenderBeds: 'lavender',
  Goblet: 'goblet',
  Shirogane: 'shirogane',
  Empyreum: 'empyreum',
};

export function resolveWardMapRef(
  area: string,
  plot: number | null | undefined,
  apartmentBuilding: 1 | 2 | null | undefined,
  buildingType: 'house' | 'apartment' | undefined,
): { mapKey: string; highlightPlot: number; highlightKind: 'plot' | 'apart' } | null {
  const baseKey = AREA_TO_KEY[area];
  if (!baseKey) return null;

  if (buildingType === 'apartment') {
    const sub = apartmentBuilding === 2;
    return { mapKey: sub ? `${baseKey}-sub` : baseKey, highlightPlot: 1, highlightKind: 'apart' };
  }

  if (plot == null) return null;
  if (plot >= 1 && plot <= 30) {
    return { mapKey: baseKey, highlightPlot: plot, highlightKind: 'plot' };
  }
  if (plot >= 31 && plot <= 60) {
    return { mapKey: `${baseKey}-sub`, highlightPlot: plot - 30, highlightKind: 'plot' };
  }
  return null;
}
```

- [ ] **Step 7: テストが通る**

Run: `npx vitest run src/lib/housing/__tests__/resolveWardMapRef.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 8: build (動的 import と JSON/SVG 解決の確認)**

Run: `npm run build`
Expected: EXIT 0。`?raw` の型宣言が無くて落ちる場合は既存 `MapView.tsx:9` が同じ `?raw` import を使っているので、その型宣言 (`src/vite-env.d.ts` 等) を確認して踏襲。

- [ ] **Step 9: Commit**

```bash
rtk git add src/data/housing/*.generated.json src/data/housing/*.generated.svg src/data/housing/wardMapManifest.ts src/lib/housing/resolveWardMapRef.ts src/lib/housing/__tests__/resolveWardMapRef.test.ts
rtk git commit -m "feat(housing): 全10マップの地図データ組み込み+住所→地図解決関数"
```

---

### Task 8: WardMapPreview コンポーネント

視覚要素を含む。純ロジック (Task7 の解決関数) は TDD 済み。描画部は「実装→build緑→実画面でユーザー確認→反復」。テストは render smoke + プレースホルダ分岐に限定。

**Files:**
- Create: `src/components/housing/register/WardMapPreview.tsx`
- Modify: `src/styles/housing.css` (`.housing-ward-preview*` トークン/クラス)
- Test: `src/components/housing/register/__tests__/WardMapPreview.test.tsx`

**Interfaces:**
- Produces: `WardMapPreview: React.FC<{ area?: string; plot?: number; apartmentBuilding?: 1 | 2; buildingType?: 'house' | 'apartment' }>`
- Consumes: `resolveWardMapRef` / `WARD_MAP_LOADERS` (Task7)。

- [ ] **Step 1: render smoke テストを書く (住所未確定=プレースホルダ)**

```tsx
// @vitest-environment happy-dom
// src/components/housing/register/__tests__/WardMapPreview.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
// i18n は既存 FavoritesPage.test.tsx 方式 (i18next + locales/ja.json 手動 init) に合わせる
import { WardMapPreview } from '../WardMapPreview';

describe('WardMapPreview', () => {
  it('住所未確定ならプレースホルダを出す (地図ロードしない)', () => {
    render(<I18nextProvider i18n={i18n}><WardMapPreview /></I18nextProvider>);
    expect(screen.getByTestId('housing-ward-preview-placeholder')).toBeTruthy();
  });
});
```

(i18n セットアップは既存 housing テスト (`FavoritesPage.test.tsx` 等) の方式を読んで合わせる。地図の動的 import が走る住所確定ケースは vmThreads ハング回避のためユニットに置かず実機確認。)

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/register/__tests__/WardMapPreview.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: コンポーネントを実装**

`WardMapPreview.tsx` の要点 (完全な JSX は実装時に BrowsePage/MapView の DOM パターンに合わせるが、構造は以下):
- `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)` を呼ぶ。`null` なら `data-testid="housing-ward-preview-placeholder"` の静かなプレースホルダ (`t('housing.register.map_preview.placeholder')`) を返す。
- ref が取れたら `useEffect` で `WARD_MAP_LOADERS[ref.mapKey]()` を await し、`{ json, svg }` を state に。ロード中はスケルトン (`housing-ward-preview-skeleton`)。
- ロード後: 背景に `dangerouslySetInnerHTML={{ __html: svg }}` で表示 SVG を inline (MapView.tsx:112-118 と同パターン)。その上に overlay `<svg>` を viewBox 合わせで重ね、`json.houses` から `kind===ref.highlightKind && plot===ref.highlightPlot` の house を探し、その正規化 `x*viewBox.w, y*viewBox.h` に発光マーカー (円 + パルス) を置く。**区画形状ハイライトはデータに形状が無いため中心点マーカー** (spec パートC 確定)。
- 地図下に住所要約テキスト (エリア/区/番地/サイズ/タイプ・i18n)。エーテライト表記は載せない。
- マーカーの色は青系トークン (`--housing-aether`)。新規トークン/クラスは housing.css に追加 (ハードコード禁止)。

- [ ] **Step 4: housing.css にトークン/クラスを追加**

`src/styles/housing.css` に `.housing-ward-preview` / `-skeleton` / `-placeholder` / `-map-host` / `-marker` / `-summary` を追加。マーカー発光は `--housing-aether` + box-shadow トークン。DPR 2.58 で埋もれないサイズ (`[[reference_housing_progress_visibility]]` の教訓 = 細い線は埋もれる → マーカーは十分な太さ+コントラスト)。

- [ ] **Step 5: smoke テストが通る + build**

Run: `npx vitest run src/components/housing/register/__tests__/WardMapPreview.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 6: ハードコード監査**

Run: `npx rtk grep "rgb\(|rgba\(|#[0-9a-f]{3,8}" src/components/housing/register/WardMapPreview.tsx` 相当を確認 (Grep ツールで可)。色直書きゼロを確認。

- [ ] **Step 7: Commit** (実画面確認は Task16 の統合ゲートでまとめて行う)

```bash
rtk git add src/components/housing/register/WardMapPreview.tsx src/styles/housing.css src/components/housing/register/__tests__/WardMapPreview.test.tsx
rtk git commit -m "feat(housing): 土地ミニマップ部品 WardMapPreview (中心点発光マーカー)"
```

---

## パートB — 登録ページ UI

### Task 9: RegisterPage 骨格 + ルート差替 + ログインモーダルのマウント

**Files:**
- Create: `src/components/housing/pages/RegisterPage.tsx`
- Modify: `src/App.tsx:106` (`<ComingSoonPage tab="register" />` → `<RegisterPage />`)
- Modify: `src/components/housing/shell/HousingShell.tsx` (`HousingLoginModal` / `HousingAccountModal` をマウント)
- Modify: `src/components/housing/HousingLoginPrompt.tsx` (register で `fromRegister:false` を選べる optional prop を追加。現行は props=`{ context }` のみで、context==='register' 時に内部で `openLogin({ fromRegister: true })` を呼ぶ `:14` → 新シェルには syncFromUrl が無く `?register=open` が死にクエリになる)
- Test: `src/components/housing/pages/__tests__/RegisterPage.test.tsx`

**Interfaces:**
- Produces: `RegisterPage: React.FC` (named export・3カラムオーケストレータ)。`HousingLoginPrompt` に optional prop 追加 (例 `registerFlag?: boolean`・既定 true で旧挙動維持、新シェルは false 指定)。
- Consumes: `useAuthStore` (user/loading)、`useHousingModalStore.openLogin({ fromRegister })`、`HousingLoginPrompt` (props=`{ context }` + 新 optional prop)、`HousingLoginModal` / `HousingAccountModal` (props なし・store 直購読)。

- [ ] **Step 1: 失敗するテストを書く (未ログイン=ログイン案内 / ログイン=フォーム枠)**

```tsx
// @vitest-environment happy-dom
// src/components/housing/pages/__tests__/RegisterPage.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
// i18n は既存 FavoritesPage.test.tsx 方式 (i18next + locales/ja.json 手動 init) に合わせる
import { RegisterPage } from '../RegisterPage';
import { useAuthStore } from '../../../../store/useAuthStore';

const wrap = () => render(
  <I18nextProvider i18n={i18n}><MemoryRouter><RegisterPage /></MemoryRouter></I18nextProvider>,
);

describe('RegisterPage', () => {
  beforeEach(() => useAuthStore.setState({ user: null, loading: false }));
  it('未ログインならログイン案内を出す', () => {
    wrap();
    expect(screen.getByTestId('housing-register-login-prompt')).toBeTruthy();
  });
  it('ログイン済ならフォーム枠 (3カラム) を出す', () => {
    useAuthStore.setState({ user: { uid: 'me' } as any, loading: false });
    wrap();
    expect(screen.getByTestId('housing-register-form-root')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: RegisterPage 骨格を実装**

BrowsePage/FavoritesPage と同じ 3カラム骨格 (`housing-browse` > `housing-browse-panel[data-region]` > `housing-browse-col-{left,center,right}`)。中身は Task10-14 で埋めるスタブ:
- 未ログイン (`!user`) → 中央に `HousingLoginPrompt context="register"` を `data-testid="housing-register-login-prompt"` で包む。**新 optional prop で `fromRegister:false` を指定** (spec B-1: 新シェルは syncFromUrl 無し・戻り URL で自然復帰・`?register=open` の死にクエリを残さない)。まず `HousingLoginPrompt.tsx` を Read し、`openLogin({ fromRegister })` の fromRegister を prop で制御できるよう optional prop (既定 true = 旧挙動) を追加してから RegisterPage で false を渡す。`signInWith` を prompt に渡すのは誤り (prompt にその prop は無い)。
- ログイン済 → `data-testid="housing-register-form-root"` の 3カラム。左=`RegisterStepperNav`+`RegisterGuide` スタブ、中央=5セクションのスタブ、右=`RegisterCheckPanel`+`RegisterDuplicatePanel`+`WardMapPreview` スタブ。
- クラス名は `housing-register` / `housing-register-panel` / `housing-register-col-{left,center,right}` を新設 (探すページと構造は同じだがトークンは register 用に増やせる)。

- [ ] **Step 4: ルートを差し替え**

`src/App.tsx:106` の `<Route path="register" element={<ComingSoonPage tab="register" />} />` を `<Route path="register" element={<RegisterPage />} />` に。`RegisterPage` を import。

- [ ] **Step 5: シェルにログイン/アカウントモーダルをマウント**

`src/components/housing/shell/HousingShell.tsx` に `HousingLoginModal` / `HousingAccountModal` を `<Outlet/>` の外 (StatusBar と並び) にマウント。両者は `useHousingModalStore` を内部購読 (props なし)。これで AppHeader の `openLogin()`/`openAccount()` が機能する (spec B-1 の穴修正)。旧 `HousingWorkspace.tsx:146-147` のマウントは別ルート (`/housing/p/:listingId` 等) 専用なので二重マウントにならない (シェル配下と別ツリー)。

- [ ] **Step 6: テストが通る + build**

Run: `npx vitest run src/components/housing/pages/__tests__/RegisterPage.test.tsx`
Expected: PASS (2 tests)
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/housing/pages/RegisterPage.tsx src/App.tsx src/components/housing/shell/HousingShell.tsx src/components/housing/pages/__tests__/RegisterPage.test.tsx src/styles/housing.css
rtk git commit -m "feat(housing): 登録ページ骨格+ルート差替+シェルにログインモーダル配線"
```

---

### Task 10: フォーム状態 + 住所セクション + 紹介セクション (タイトル)

**Files:**
- Create: `src/components/housing/register/RegisterSectionAddress.tsx`
- Create: `src/components/housing/register/RegisterSectionIntro.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx` (フォーム状態を親に持つ)
- Test: `src/components/housing/register/__tests__/RegisterSectionIntro.test.tsx`

**Interfaces:**
- Produces:
  - `RegisterSectionAddress: React.FC<{ fieldState; values; onChange }>` (住所フィールド群)
  - `RegisterSectionIntro: React.FC<{ title; description; tags; onChange }>` (タイトル/コメント/タグ)
  - RegisterPage が保持するフォーム状態の形 (既存 `HousingRegisterFormValues` を再利用 + `title`/`visibility`/`publishUntil`)
- Consumes: 既存 `useHousingFieldState` (`src/lib/housing/housingFieldState.ts:68-82`)、`HousingRegisterTypeSelector` / `HousingRegisterTagPicker` (流用可否は実装時に各部品を読んで判定 — トークン再スタイルが要るか)。

- [ ] **Step 1: 失敗するテストを書く (タイトル残り文字数・必須表示)**

```tsx
// @vitest-environment happy-dom
// src/components/housing/register/__tests__/RegisterSectionIntro.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
// i18n は既存 FavoritesPage.test.tsx 方式 (i18next + locales/ja.json 手動 init) に合わせる
import { RegisterSectionIntro } from '../RegisterSectionIntro';

describe('RegisterSectionIntro', () => {
  it('タイトル入力で onChange が発火し残り文字数が出る', () => {
    const onChange = vi.fn();
    render(
      <I18nextProvider i18n={i18n}>
        <RegisterSectionIntro title="" description="" tags={[]} onChange={onChange} />
      </I18nextProvider>,
    );
    const input = screen.getByTestId('housing-register-title-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'わが家' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ title: 'わが家' }));
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionIntro.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: RegisterPage にフォーム状態を実装**

RegisterPage で `useHousingFieldState` を使い (旧 `HousingRegisterForm.tsx:107` と同じ)、住所系必須フィールドを管理。加えて `title`/`visibility`(既定 'public')/`publishUntil`(既定 null) を `useState` で保持。子セクションに値とセッタを渡す。

- [ ] **Step 4: RegisterSectionIntro を実装**

タイトル入力 (`data-testid="housing-register-title-input"`・`maxLength={MAX_TITLE_LENGTH}`・残り文字数表示)、コメント (既存 `HousingRegisterDescriptionField` 流用可否を判定)、タグ (`HousingRegisterTagPicker` 流用可否を判定)。セクション見出しは質感A案 (青の縦アクセント or ヘアライン)。i18n: `housing.register.title` は既存だが「ページ見出し」と衝突するため新キー `housing.register.field_title_label` 等を Task16 で整理。

- [ ] **Step 5: RegisterSectionAddress を実装**

DC/ワールド/エリア/タイプ/区・番地・棟・部屋。タイプ別条件表示は旧 `HousingRegisterForm.tsx:92-97` の `requiredFieldsForSize` ロジックを踏襲。数値入力は本体 `NumericInput` 流用か housing クラス再スタイルかを実装時判定 (既存 `HousingRegisterAddressFields.tsx:82-138` は素の select/input)。住所確定を親に通知 (Task13 の重複チェック・Task8 のミニマップが購読)。

- [ ] **Step 6: テスト + build**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionIntro.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/housing/register/RegisterSectionAddress.tsx src/components/housing/register/RegisterSectionIntro.tsx src/components/housing/pages/RegisterPage.tsx src/components/housing/register/__tests__/RegisterSectionIntro.test.tsx
rtk git commit -m "feat(housing): 登録フォームの住所/紹介セクション+タイトル入力"
```

---

### Task 11: 画像・SNS URL セクション + OGP 住所自動入力

**Files:**
- Create: `src/components/housing/register/RegisterSectionMedia.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx` (自動入力配線)
- Test: `src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx`

**Interfaces:**
- Produces: `RegisterSectionMedia: React.FC<{ ...SNS/画像 state + onAutoFill(fields) }>`
- Consumes: 既存 `HousingRegisterSnsUrlField` / `useTweetFetch` / `useOgpFetch` / `parseHousingFromText` (`src/lib/housing/parseHousingFromText.ts`、`parseHousingFromText(text: string): HousingExtractResult`)、`HousingRegisterImageField` / `HousingRegisterSourceImageUrlsField` (流用可否を実装時判定)。

- [ ] **Step 1: 失敗するテストを書く (取得中スケルトン表示)**

```tsx
// src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx
// URL 取得中に data-testid="housing-register-media-loading" が出る、
// 取得成功で枚数表示、失敗で理由表示、の3状態を render で検証。
// (実 fetch はモック。tweet/ogp フックはモックして状態だけ渡す)
```

具体は既存 `HousingRegisterSnsUrlField.test.tsx` のモック方式を読んで合わせる。

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx`
Expected: FAIL

- [ ] **Step 3: RegisterSectionMedia を実装**

- SNS URL 入力 (Twitter/YouTube/OGP 3分岐は既存 `HousingRegisterSnsUrlField.tsx:92-134` 流用)。
- 取得状態: `fetching` 中はスケルトン (`data-testid="housing-register-media-loading"`)、成功で「画像を◯枚取得しました」、失敗で理由+対処 (静かな注記・色付き箱にしない)。
- 画像リスト表示 + ローカルアップロード (既存 `HousingRegisterImageField` 流用可否判定)。

- [ ] **Step 4: 自動入力を配線 (ツイート + OGP 両方)**

RegisterPage に `handleTweetFetched` を移植 (旧 `HousingRegisterForm.tsx:123-151`)。`parseHousingFromText(data.text)` → `dc/server/area/ward/plot/size` を `fieldState.setAutoFilled` へ (150ms スタッガー・`prefers-reduced-motion` 尊重)。**OGP 経路も追加** (spec): `useOgpFetch` の応答 `title`/`description` を結合して `parseHousingFromText` にかけ、同じ `setAutoFilled` 経路へ。読み取れなければ何もしない (画像だけ)。

- [ ] **Step 5: テスト + build**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 6: Commit**

```bash
rtk git add src/components/housing/register/RegisterSectionMedia.tsx src/components/housing/pages/RegisterPage.tsx src/components/housing/register/__tests__/RegisterSectionMedia.test.tsx
rtk git commit -m "feat(housing): 画像/SNS URLセクション+OGPサイトからの住所自動入力"
```

---

### Task 12: 公開設定セクション + ライブステッパー + 登録ガイド

**Files:**
- Create: `src/components/housing/register/RegisterSectionVisibility.tsx`
- Create: `src/components/housing/register/RegisterStepperNav.tsx`
- Create: `src/components/housing/register/RegisterGuide.tsx`
- Modify: `src/styles/housing.css` (ステッパー/公開設定のトークン)
- Test: `src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`

**Interfaces:**
- Produces:
  - `RegisterSectionVisibility: React.FC<{ visibility; publishUntil; onChange }>`
  - `RegisterStepperNav: React.FC<{ steps: Array<{ id: number; labelKey: string; state: 'idle' | 'active' | 'done' }>; onJump(id: number): void }>`
  - `RegisterGuide: React.FC<{ remaining: number | null }>` (登録枠残数含む)
- Consumes: `canRegister` (残数)、IntersectionObserver (scroll-spy)。

- [ ] **Step 1: 失敗するテストを書く (ステッパーの状態→クラス)**

```tsx
// @vitest-environment happy-dom
// src/components/housing/register/__tests__/RegisterStepperNav.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
// i18n は既存 FavoritesPage.test.tsx 方式 (i18next + locales/ja.json 手動 init) に合わせる
import { RegisterStepperNav } from '../RegisterStepperNav';

describe('RegisterStepperNav', () => {
  const steps = [
    { id: 1, labelKey: 'housing.register.step.media', state: 'done' as const },
    { id: 2, labelKey: 'housing.register.step.address', state: 'active' as const },
    { id: 3, labelKey: 'housing.register.step.intro', state: 'idle' as const },
  ];
  it('done は is-done、active は is-active クラス', () => {
    render(<I18nextProvider i18n={i18n}><RegisterStepperNav steps={steps} onJump={() => {}} /></I18nextProvider>);
    expect(screen.getByTestId('housing-register-step-1').className).toContain('is-done');
    expect(screen.getByTestId('housing-register-step-2').className).toContain('is-active');
  });
  it('クリックで onJump(id)', () => {
    const onJump = vi.fn();
    render(<I18nextProvider i18n={i18n}><RegisterStepperNav steps={steps} onJump={onJump} /></I18nextProvider>);
    fireEvent.click(screen.getByTestId('housing-register-step-3'));
    expect(onJump).toHaveBeenCalledWith(3);
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: FAIL

- [ ] **Step 3: RegisterStepperNav を実装**

5ステップ (media/address/intro/visibility/confirm)。各ステップは `is-idle`/`is-active`/`is-done` を state から付与し、`data-testid="housing-register-step-{id}"`。番号丸は青 (`--housing-aether`)、`is-done` でチェックへ (CSS でアニメーション・`prefers-reduced-motion` 尊重)。クリックで `onJump(id)`。`✅` を最初から付けない = 全 idle 開始 (`[[feedback_form_ux_progress]]`)。

- [ ] **Step 4: RegisterPage で scroll-spy 配線**

各セクションに ref を付け、IntersectionObserver で可視セクションを active に (`[[reference_perf_forced_reflow_resizeobserver]]` = scroll ハンドラで layout 読みしない)。各ステップの `done` 判定は「そのセクションの必須が埋まったか」(fieldState + title 有無 + 画像/公開設定)。`onJump` は該当セクション ref へ `scrollIntoView`。

- [ ] **Step 5: RegisterSectionVisibility を実装**

「すべてのユーザーに公開 (既定) / 非公開 (自分のみ)」の2択 (ラジオ or セグメント)。「公開終了日時を設定する」トグル ON で datetime 入力を表示。過ぎたら自動非公開の注記 (ヘアライン+グレー)。`onChange({ visibility, publishUntil })`。

- [ ] **Step 6: RegisterGuide を実装**

`FavoritesOnboarding` と同じ静かなトーン (`src/components/housing/favorites/FavoritesOnboarding.tsx` パターン)。登録の流れの短い教育 + 登録枠残数 (`canRegister` の `remaining`)。✅ を最初から付けない。

- [ ] **Step 7: housing.css + テスト + build + 監査**

housing.css に `.housing-register-stepper*` / `.housing-register-visibility*` / `.housing-register-guide*` を追加。
Run: `npx vitest run src/components/housing/register/__tests__/RegisterStepperNav.test.tsx`
Expected: PASS
Run: `npm run build`
Expected: EXIT 0
色ハードコード grep 監査。

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/housing/register/RegisterSectionVisibility.tsx src/components/housing/register/RegisterStepperNav.tsx src/components/housing/register/RegisterGuide.tsx src/components/housing/pages/RegisterPage.tsx src/styles/housing.css src/components/housing/register/__tests__/RegisterStepperNav.test.tsx
rtk git commit -m "feat(housing): 公開設定セクション+ライブステッパー+登録ガイド"
```

---

### Task 13: 右カラム — 入力チェック + 重複チェックパネル

**Files:**
- Create: `src/lib/housing/registerChecklist.ts` (入力チェックの導出純関数)
- Create: `src/components/housing/register/RegisterCheckPanel.tsx`
- Create: `src/components/housing/register/RegisterDuplicatePanel.tsx`
- Modify: `src/components/housing/pages/RegisterPage.tsx` (住所確定で重複照会・debounce)
- Test: `src/lib/housing/__tests__/registerChecklist.test.ts`
- Test: `src/components/housing/register/__tests__/RegisterCheckPanel.test.tsx`
- Test: `src/components/housing/register/__tests__/RegisterDuplicatePanel.test.tsx`

**Interfaces:**
- Produces:
  - `computeRegisterChecklist(input: { addressOk: boolean; titleOk: boolean; hasImage: boolean }): Array<{ key: string; done: boolean; labelKey: string }>` および `isReadyToPublish(items): boolean` (純関数・RegisterCheckPanel と Confirm/submit の disabled 判定を単一ソースに)
  - `RegisterCheckPanel: React.FC<{ items: Array<{ key: string; done: boolean; labelKey: string }> }>` (ライブなアクション行)
  - `RegisterDuplicatePanel: React.FC<{ state: 'idle' | 'checking' | 'clear' | 'found'; duplicates: DuplicateEntry[]; privateMatchCount: number }>`
- Consumes: `checkDuplicate` (`CheckDuplicateResponse = { duplicates; privateMatchCount? }`・Task3)、`DuplicateEntry`。

- [ ] **Step 1a: 入力チェック導出の純関数テストを書く (spec テスト節: 必須不足で disabled + 不足列挙)**

```ts
// src/lib/housing/__tests__/registerChecklist.test.ts
import { describe, it, expect } from 'vitest';
import { computeRegisterChecklist, isReadyToPublish } from '../registerChecklist';

describe('registerChecklist', () => {
  it('全部揃えば全 done・公開可', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: true, hasImage: true });
    expect(items.every((i) => i.done)).toBe(true);
    expect(isReadyToPublish(items)).toBe(true);
  });
  it('タイトル未入力は not done・公開不可', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: false, hasImage: true });
    expect(items.find((i) => i.key === 'title')?.done).toBe(false);
    expect(isReadyToPublish(items)).toBe(false);
  });
  it('必須 (住所/タイトル) が揃えば画像なしでも公開可 (画像は推奨)', () => {
    const items = computeRegisterChecklist({ addressOk: true, titleOk: true, hasImage: false });
    expect(isReadyToPublish(items)).toBe(true);
  });
});
```

- [ ] **Step 1b: 実行して落ちる → registerChecklist.ts を実装 → 緑**

`computeRegisterChecklist` は住所/タイトル (必須) + 画像 (推奨) の done 行を返す純関数。`isReadyToPublish(items)` は**必須行のみ**が done かで判定 (画像は推奨=公開ブロックしない)。行の意味は spec の「何が足りないかを具体的アクションで」。RegisterCheckPanel (表示) と Confirm/submit の disabled 判定 (Task14) がこの単一ソースを使う。
Run: `npx vitest run src/lib/housing/__tests__/registerChecklist.test.ts`
Expected: FAIL → 実装 → PASS (3 tests)

- [ ] **Step 1c: RegisterCheckPanel の render テスト (spec テスト節: 行表示)**

```tsx
// src/components/housing/register/__tests__/RegisterCheckPanel.test.tsx
// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
// i18n は既存 FavoritesPage.test.tsx の方式 (i18next + locales/ja.json 手動 init) に合わせる
import { RegisterCheckPanel } from '../RegisterCheckPanel';

describe('RegisterCheckPanel', () => {
  it('done 行は ✓ 印・not done 行は ⚠ 印を出す', () => {
    render(/* i18n provider */
      <RegisterCheckPanel items={[
        { key: 'address', done: true, labelKey: 'housing.register.check.address' },
        { key: 'image', done: false, labelKey: 'housing.register.check.image' },
      ]} />,
    );
    expect(screen.getByTestId('housing-register-check-address').className).toContain('is-done');
    expect(screen.getByTestId('housing-register-check-image').className).toContain('is-todo');
  });
});
```

Run: `npx vitest run src/components/housing/register/__tests__/RegisterCheckPanel.test.tsx`
Expected: FAIL → 実装 → PASS

- [ ] **Step 1: RegisterDuplicatePanel の失敗するテストを書く (3状態: 未照会/公開重複/匿名重複)**

```tsx
// @vitest-environment happy-dom
// src/components/housing/register/__tests__/RegisterDuplicatePanel.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
// i18n は既存 FavoritesPage.test.tsx 方式 (i18next + locales/ja.json 手動 init) に合わせる
import { RegisterDuplicatePanel } from '../RegisterDuplicatePanel';

const wrap = (props: any) =>
  render(<I18nextProvider i18n={i18n}><RegisterDuplicatePanel {...props} /></I18nextProvider>);

describe('RegisterDuplicatePanel', () => {
  it('clear: 重複なしの安心メッセージ', () => {
    wrap({ state: 'clear', duplicates: [], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-clear')).toBeTruthy();
  });
  it('found: 公開重複はカード表示', () => {
    wrap({ state: 'found', duplicates: [{ id: '1', ownerUid: 'a', createdAt: 0, tags: [] }], privateMatchCount: 0 });
    expect(screen.getByTestId('housing-register-dup-public')).toBeTruthy();
  });
  it('found: 非公開重複は匿名件数のみ (中身なし)', () => {
    wrap({ state: 'found', duplicates: [], privateMatchCount: 2 });
    const anon = screen.getByTestId('housing-register-dup-private');
    expect(anon.textContent).not.toContain('ownerUid');
    expect(anon).toBeTruthy();
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterDuplicatePanel.test.tsx`
Expected: FAIL

- [ ] **Step 3: RegisterDuplicatePanel を実装**

- `idle` = 静かなプレースホルダ (「住所を入力すると確認します」)。
- `checking` = スケルトン。
- `clear` = 重複なしの安心行 (`data-testid="housing-register-dup-clear"`)。
- `found` = 公開分 `duplicates` をカード表示 (`data-testid="housing-register-dup-public"`・id/createdAt/tags のみ・`HousingDuplicateWarningDialog` と同じフィールド範囲)。`privateMatchCount > 0` なら匿名行 (`data-testid="housing-register-dup-private"`・`t('housing.register.duplicate.private_note', { count })` = 「非公開の登録が◯件あります。内容は表示されません。住所をもう一度ご確認ください」)。**非公開 doc の中身は絶対に出さない**。

- [ ] **Step 4: RegisterCheckPanel を実装**

親から渡る `items` (必須項目/住所形式/画像/タイトル 等の done 状態) を ✓/⚠ の行で表示。ライブ更新 (RegisterPage の state 変化で再描画)。「何が足りないか」を具体的アクションで (`[[feedback_form_ux_progress]]`・数でなく具体行)。

- [ ] **Step 5: RegisterPage で重複照会を配線 (debounce)**

住所が妥当 (`validateAddress` ok) になったら debounce (例 500ms) で `checkDuplicate(addr)` を呼び、`{ duplicates, privateMatchCount }` を state に。失敗時は止めない (安全側・旧 `HousingRegisterFormModal.tsx:204-209` と同方針)。

- [ ] **Step 6: テスト + build + 監査**

Run: `npx vitest run src/components/housing/register/__tests__/RegisterDuplicatePanel.test.tsx`
Expected: PASS (3 tests)
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 7: Commit**

```bash
rtk git add src/components/housing/register/RegisterCheckPanel.tsx src/components/housing/register/RegisterDuplicatePanel.tsx src/components/housing/pages/RegisterPage.tsx src/components/housing/register/__tests__/RegisterDuplicatePanel.test.tsx
rtk git commit -m "feat(housing): 右カラムの入力チェック+重複チェック(非公開は匿名件数)"
```

---

### Task 14: 確認セクション + 送信フロー + オートセーブ

**Files:**
- Create: `src/components/housing/register/RegisterSectionConfirm.tsx`
- Create: `src/lib/housing/registerAutosave.ts` (localStorage serialize/restore の純関数)
- Modify: `src/components/housing/pages/RegisterPage.tsx` (submit オーケストレーション + オートセーブ配線)
- Test: `src/lib/housing/__tests__/registerAutosave.test.ts`

**Interfaces:**
- Produces:
  - `RegisterSectionConfirm: React.FC<{ summary; canSubmit; visibility; onSubmit }>`
  - `serializeDraft(values): string` / `restoreDraft(raw: string | null): Partial<Values> | null` / `AUTOSAVE_KEY = 'housing-register-draft'`
- Consumes: `checkDuplicate` / `registerListing` / `uploadListingThumbnail` / `HousingDuplicateWarningDialog` / `showToast` / `useNavigate` / `fetchAndUpsert`。

- [ ] **Step 1: 失敗するテストを書く (オートセーブ round-trip)**

```ts
// src/lib/housing/__tests__/registerAutosave.test.ts
import { describe, it, expect } from 'vitest';
import { serializeDraft, restoreDraft } from '../registerAutosave';

describe('registerAutosave', () => {
  it('テキスト系フィールドを round-trip する', () => {
    const values = { title: 'わが家', description: 'コメント', dc: 'Elemental', tags: ['x'], postUrl: 'https://x.com/a' };
    const restored = restoreDraft(serializeDraft(values as any));
    expect(restored?.title).toBe('わが家');
    expect(restored?.tags).toEqual(['x']);
  });
  it('壊れた JSON は null', () => {
    expect(restoreDraft('{bad')).toBeNull();
  });
  it('null 入力は null', () => {
    expect(restoreDraft(null)).toBeNull();
  });
});
```

- [ ] **Step 2: 実行して落ちる**

Run: `npx vitest run src/lib/housing/__tests__/registerAutosave.test.ts`
Expected: FAIL

- [ ] **Step 3: registerAutosave を実装**

`serializeDraft(values)` = テキスト系フィールドのみ (`title`/`description`/住所選択/`tags`/`postUrl`/`visibility`/`publishUntil`) を JSON 化。localImages のバイナリ・SNS 派生 state (tweetData/ogpResult/sourceImageUrls) は**保存しない**。`restoreDraft(raw)` = try/catch で parse、失敗/null は null。`AUTOSAVE_KEY = 'housing-register-draft'`。

- [ ] **Step 4: RegisterSectionConfirm を実装**

入力要約 (住所/タイトル/画像枚数/公開設定) + 不足アクション列挙 (RegisterCheckPanel と同じ内容)。`canSubmit === false` でボタン disabled。ボタンラベルは visibility で変化 (「公開する」/「非公開で保存する」・ハニー主アクション)。

- [ ] **Step 5: submit フローを配線**

RegisterPage の submit: `toRegistrationDraft` 相当で値を `RegistrationDraft` に (title/visibility/publishUntil 込み) → `checkDuplicate` → 公開重複あれば `HousingDuplicateWarningDialog` (戻って修正/このまま登録) → `registerListing` → localImages あれば `uploadListingThumbnail` 逐次 → `fetchAndUpsert(id)` + `loadMine(uid)` → `navigate('/housing/listing/' + id)` + `showToast` (非公開時は「非公開で保存しました」)。エラーは quota/not_authenticated/generic の3分類 (旧 `HousingRegisterFormModal.tsx:173-180` 踏襲)。

- [ ] **Step 6: オートセーブを配線**

値変化を debounce で `localStorage.setItem(AUTOSAVE_KEY, serializeDraft(values))`。マウント時に `restoreDraft` で復元候補があれば「入力途中を復元しました (破棄する)」の注記 + 破棄ボタン。**復元と SNS 派生 state の相互作用 (spec 確定方針)**: 復元後、保存済み SNS URL があれば取得のみ再実行 (画像 state 再構築)、ただし `setAutoFilled` は**復元後に空のフィールドだけ**に適用 (復元済み手修正値を上書きしない)。「SNS 画像は再取得します」注記。登録成功・明示破棄で `localStorage.removeItem(AUTOSAVE_KEY)`。

- [ ] **Step 7: テスト + build**

Run: `npx vitest run src/lib/housing/__tests__/registerAutosave.test.ts`
Expected: PASS (3 tests)
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 8: Commit**

```bash
rtk git add src/components/housing/register/RegisterSectionConfirm.tsx src/lib/housing/registerAutosave.ts src/components/housing/pages/RegisterPage.tsx src/lib/housing/__tests__/registerAutosave.test.ts
rtk git commit -m "feat(housing): 確認セクション+送信フロー+オートセーブ(復元)"
```

---

### Task 15: 編集モーダルにタイトル/公開設定/期限を追加

**Files:**
- Modify: `src/components/housing/register/HousingRegisterView.tsx` (編集モードにフィールド追加) または `src/components/housing/edit/HousingEditModal.tsx`
- Modify: `src/components/housing/edit/useHousingUpdate.ts` (payload に3フィールド)
- Test: `src/components/housing/edit/__tests__/useHousingUpdate.test.ts` (既存に追記)

**Interfaces:**
- Produces: 編集で title/visibility/publishUntil を送れる。
- Consumes: 既存 `useHousingUpdate` → `POST /api/housing?action=update-listing` (Task3 で payload 対応済)。

- [ ] **Step 1: 既存編集の実装を読む**

`HousingEditModal.tsx` → `HousingRegisterView.tsx` (mode='edit'・`listingToDraft` で初期値注入 `:36-51`) と `useHousingUpdate.ts` を読み、初期値注入 (`listingToDraft`) に title/visibility/publishUntil を追加する場所を特定。

- [ ] **Step 2: 失敗するテストを書く (update payload に visibility が乗る)**

```ts
// src/components/housing/edit/__tests__/useHousingUpdate.test.ts (追記)
// updateListing 呼び出しの body に visibility/title/publishUntil が含まれることを検証。
// 既存テストのモック方式に合わせる。
```

- [ ] **Step 3: 実行して落ちる → 実装 → 緑**

`listingToDraft` に3フィールド追加 + 編集フォームに入力欄追加 (タイトル必須・公開設定・期限)。編集時もタイトル必須をクライアントで強制。
Run: `npx vitest run src/components/housing/edit/__tests__/useHousingUpdate.test.ts`
Expected: PASS

- [ ] **Step 4: build + Commit**

Run: `npm run build`
Expected: EXIT 0

```bash
rtk git add src/components/housing/register/HousingRegisterView.tsx src/components/housing/edit/HousingEditModal.tsx src/components/housing/edit/useHousingUpdate.ts src/components/housing/edit/__tests__/useHousingUpdate.test.ts
rtk git commit -m "feat(housing): 編集モーダルにタイトル/公開設定/公開期限を追加"
```

---

### Task 16: 仕上げ — i18n 4言語 + parity + 監査 + 実画面ゲート

**Files:**
- Modify: `src/locales/{ja,en,ko,zh}.json` (`housing.register.*` に新規キー・該当ブロックのみ textual 編集)
- Create: `src/components/housing/register/__tests__/i18nParity.test.ts` (`housing.register.*` の4言語一致)
- Modify: `.claude/rules/housing-design.md` (必要なら登録ページの学び)
- Modify: `docs/TODO.md` / `docs/TODO_COMPLETED.md` / `.superpowers/sdd/progress.md`

**Interfaces:**
- Produces: 4言語 parity の取れた登録ページ。
- Consumes: 全 Task の i18n キー。

- [ ] **Step 1: 新規 i18n キーを4言語に追加**

本 plan で登場した全 `housing.register.*` 新規キー (step.*, badge_private, badge_expired, field_title_label, map_preview.*, duplicate.private_note, visibility.*, autosave.*, guide.*, checkPanel.*, login_prompt 系 等) を ja/en/ko/zh に追加。既存 `housing.register` ブロック (ja.json `:1978-2165`) 内に textual 編集で追記。

- [ ] **Step 2: i18n parity テストを書く**

`src/components/housing/favorites/__tests__/i18nParity.test.ts` を雛形に、`favOf` の `.favorites` を `.register` にした `housing.register.*` 版を作成。既存 `housing.register.*` が既に4言語揃っているか含めて検証。

Run: `npx vitest run src/components/housing/register/__tests__/i18nParity.test.ts`
Expected: PASS (ja と en/ko/zh のキー構造一致)。落ちたら欠けている言語にキー追加。

- [ ] **Step 3: 全体テスト + build**

Run: `npx vitest run`
Expected: 新規テスト全緑。既知 legacy fail (TopBar 4 + HousingWorkspace 1) 以外に新規 fail が無いこと。
Run: `npm run build`
Expected: EXIT 0

- [ ] **Step 4: ハードコード監査**

Run (Grep ツール): `rgb\(|rgba\(|#[0-9a-f]{3,8}` を `src/components/housing/register/` 全体と追加した housing.css 箇所以外で検索。register コンポーネントに色/px 直書きゼロを確認。残ってよいのは housing.css 内のみ。

- [ ] **Step 5: 実画面ゲート (ユーザー声かけ)**

Run: `npm run dev` → `/housing/register` を開く。ユーザーに「登録ページを見て」と声かけ。確認点: 全体質感A案 / ステッパーのライブ動作 (未入力→青→チェック) / SNS URL 貼付→自動入力→スケルトン→ミニマップ点灯 / 公開・非公開・期限の入力 / 重複チェックの3状態 / 入力チェックの具体アクション表示 / 「公開する」ボタン。**OK が出るまで該当 Task を反復**。実画面 = CSS 1489x679 / DPR 2.58。

- [ ] **Step 6: エンドユーザー実機一通り (`[[feedback_endpoint_user_verification]]`)**

実際に1件、公開で登録→詳細ページ遷移→探すに出る、を通す。1件、非公開で登録→自分の探す/お気に入りにバッジ付きで見える・別視点 (ログアウト) で見えない、を通す。期限を過去日時 (編集で) にして遅延評価で消えるのを確認。

- [ ] **Step 7: 台帳・TODO 更新**

`.superpowers/sdd/progress.md` に本 plan の Task 完了記録。`docs/TODO.md` の登録ページ行を完了へ、完了スパンは `docs/TODO_COMPLETED.md` へ移動 (TODO 100行以内維持 `[[feedback_clean_environment]]`)。**merge はまだしない** — ブランチ全体の最終レビュー後にユーザー確認で解禁 (Global Constraints)。本番反映順序 (バックフィル済→アプリ→保険再バックフィル→ルール deploy) を TODO に明記。

- [ ] **Step 8: Commit**

```bash
rtk git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json src/components/housing/register/__tests__/i18nParity.test.ts docs/TODO.md docs/TODO_COMPLETED.md .superpowers/sdd/progress.md .claude/rules/housing-design.md
rtk git commit -m "feat(housing): 登録ページ i18n 4言語 parity + 仕上げ + 台帳更新"
```

---

## Self-Review (記入済)

- **Spec coverage**:
  - パートA (データ基盤): 型/検証=Task1 / 公開判定純関数=Task2 / サーバー+API=Task3 / ルール+index+バックフィル=Task4 / store 合流+カードバッジ=Task5 / 詳細ページ可視性=Task6。
  - パートC (地図): データ準備+解決関数=Task7 / WardMapPreview=Task8。
  - パートB (登録UI): 骨格+ルート+ログインモーダル=Task9 / 住所+紹介=Task10 / 画像SNS+OGP自動入力=Task11 / 公開設定+ステッパー+ガイド=Task12 / 右カラム入力/重複チェック=Task13 / 確認+送信+オートセーブ=Task14。
  - 編集モーダル=Task15 / i18n+parity+監査+実画面ゲート=Task16。spec 全節にタスク対応あり。
- **Placeholder scan**: 視覚コンポーネント (Task8/12 の描画・Task11/13 のパネル外観) は favorites plan と同じ「実装→build→実画面確認→反復」の視覚チューニング扱いで、完全な JSX リテラルは持たせず interfaces + testid + 質感A案トークン方針で規定 (固定 JSX は実画面で崩れるため意図的)。純ロジック (Task1/2/3/6/7/13/14) は完全なコード+テスト記載。TBD/未実装マーカーなし。DOM テスト例の i18n セットアップは Global Constraints の規約 (FavoritesPage.test.tsx 方式) に読み替える旨を明記済み。
- **spec テスト節の網羅**: spec:151-152 が要求する項目のうち、①RegisterCheckPanel 行表示=Task13 Step1c、②「必須不足で公開ボタン disabled + 不足列挙」=Task13 の純関数 `computeRegisterChecklist`/`isReadyToPublish` テスト (Step1a-b) で担保、③住所確定→重複照会発火=Task13 の debounce 配線 + RegisterDuplicatePanel 3状態テスト。一方 **④URL貼付→自動入力反映 / ⑤登録成功→遷移** の full-flow は、フォーム全体を submit まで駆動する happy-dom テストが setTimeout スタッガーで vitest vmThreads をハングさせる既知の罠 (`[[reference_vitest_vmthreads_hang]]`) のため**ユニットに置かず Task16 Step6 の実機エンドユーザー検証で担保** (`[[feedback_endpoint_user_verification]]`)。自動入力の中核 `parseHousingFromText` は既存テスト有り。
- **Type consistency**: `isEffectivelyPublic(listing, nowMs)` / `mergeListingsForViewer(pub, mine, uid, now)` / `resolveWardMapRef(area, plot, apartmentBuilding, buildingType)→{mapKey, highlightPlot, highlightKind}` / `getMyListings(uid)` / `loadMine(uid)`/`clearMine()` / `CheckDuplicateResponse={duplicates, privateMatchCount?}` / `splitDuplicates` / `validateTitle` / `MAX_TITLE_LENGTH` / `AUTOSAVE_KEY` / `serializeDraft`/`restoreDraft` — タスク間で名称一致を確認。`visibility: 'public'|'private'` / `publishUntil: number|null` は全層統一。
- **依存順序**: Task1→2→3→4→5→6 (A) → 7→8 (C・B が使う) → 9→10→11→12→13→14 (B) → 15 → 16。**インデックスは Task4 で 1 本のみ追加** (`visibility+isHidden+createdAt DESC`)。getMyListings は Task5 で orderBy を付けず client sort にするため `ownerUid+createdAt` 複合は追加しない (Task4/Task5 で一本化済み・死にインデックスを残さない)。`resolveWardMapRef` の `highlightPlot` は常に `number` (解決不能時は戻り値全体が `null`)。
- **既知の非目標**: 承認制限定公開 / 公開開始日時予約 / サーバー保存下書き / 期限切れ cron 掃除 / 編集画面の全面刷新 (マイページスパン) / 登録後の画像差し替え / スマホ (M6) / エーテライト入力欄 / 旧登録モーダル撤去 / 詳細・ツアーへの WardMapPreview 配線。
- **本番反映の罠 (再掲)**: dev/本番同一 Firestore。バックフィル (Task4) は開発着手時に実行済みが前提。ルール deploy は merge 後の最後 (アプリ+サーバー default 付与が先)。ルール deploy 前にエミュレータ検証ゲート (Task4 Step7 or 手動)。
