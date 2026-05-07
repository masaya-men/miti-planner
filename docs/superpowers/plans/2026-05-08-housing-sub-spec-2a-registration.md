# Housing Sub-spec 2A — Registration (画像なしモード) 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ハウジングツアーで「ログインユーザーが住所＋タグ＋紹介文だけで物件を登録できる」段階まで作る。画像 3 択 (SNS URL / サムネ) は Sub-spec 2C に先送りし、本プランでは `imageMode='none'` 固定で機能を完結させる。

**Architecture:** 既存 LoPo の Firestore 直書き + Vercel API ハイブリッド構成を踏襲。`housing_listings` の作成は Vercel API 経由（`housing_user_meta` 更新と原子的に行うため）。タグマスタは静的データ、4 言語訳は `src/locales/*.json` に集約。デザインは仮置き（既存 `bg-app-surface` / Tailwind プリミティブのみ使用、リキッドグラスやルーペは Sub-spec 2C 以降で別途追加）。

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind v4 + react-i18next + react-router-dom + Firebase Auth + Firestore + Vitest + Vercel Functions (Node)

**設計書参照:** `docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md` の §6 / §11.4 / §11.5 / §12 / §13 / §18 Sub-spec 2

**スコープ外（後続プラン）:**
- 画像 3 択処理 (SNS URL OGP 取得 / サムネアップロード) → Sub-spec 2C
- ギャラリー / 検索フィルタ → Sub-spec 2B
- リキッドグラス + ルーペエフェクト → Sub-spec 2C 以降の別プラン
- ツアー / 通報 / 削除依頼 → Sub-spec 3

---

## File Structure

新規作成ファイル:

```
src/data/housingTags.ts                               # タグマスタ定数 (id + category + i18nKey)
src/utils/housingValidation.ts                        # フォーム入力検証 (純粋関数)
src/utils/housingQuota.ts                             # canRegister/onRegisterSuccess 純粋ロジック
src/utils/housingDuplicate.ts                         # 同住所キー生成・比較
src/lib/housingListingsService.ts                    # Firestore listings read 専用 (write は API 経由)
src/lib/housingApiClient.ts                           # /api/housing 呼び出しラッパー
src/components/housing/
  ├─ HousingPage.tsx                                  # /housing メイン (タブ切替)
  ├─ HousingTabBar.tsx                                # 下部ナビ (モバイル) / サイドナビ (PC) 共通
  ├─ HousingPlaceholderView.tsx                       # ギャラリー/ツアータブ用「準備中」プレースホルダ
  ├─ HousingOnboardingDialog.tsx                      # 初回オンボーディング (仮 UI)
  ├─ HousingDuplicateWarningDialog.tsx                # 重複登録警告
  ├─ HousingLoginPrompt.tsx                           # 未ログイン時の登録ボタン代わり
  └─ register/
       ├─ HousingRegisterView.tsx                     # 登録フォーム本体
       ├─ HousingRegisterAddressFields.tsx            # DC/サーバー/エリア/区/番地/サイズ
       ├─ HousingRegisterTagPicker.tsx                # タグ選択 UI (5件まで)
       ├─ HousingRegisterDescriptionField.tsx         # 紹介文 (200文字まで)
       └─ HousingQuotaIndicator.tsx                   # 残り登録枠表示
api/housing/
  ├─ index.ts                                         # ?action ルーター
  ├─ _canRegisterHandler.ts                           # GET (auth + housing_user_meta 読み + 必要なら初期化)
  ├─ _registerListingHandler.ts                      # POST (canRegister + housing_listings 作成 + housing_user_meta 更新)
  └─ _checkDuplicateHandler.ts                        # POST (同住所重複検索)
src/__tests__/housing/
  ├─ housingTags.test.ts
  ├─ housingValidation.test.ts
  ├─ housingQuota.test.ts
  ├─ housingDuplicate.test.ts
  ├─ HousingTabBar.test.tsx
  ├─ HousingOnboardingDialog.test.tsx
  ├─ HousingDuplicateWarningDialog.test.tsx
  ├─ HousingRegisterAddressFields.test.tsx
  ├─ HousingRegisterTagPicker.test.tsx
  ├─ HousingRegisterDescriptionField.test.tsx
  └─ HousingRegisterView.test.tsx
```

修正ファイル:

```
src/App.tsx                                           # /housing 行の HousingComingSoonPage を HousingPage に差し替え
src/components/housing/index.ts                       # HousingPage export 追加 (HousingComingSoonPage は残す)
src/locales/{ja,en,ko,zh}.json                        # housing.tag.* / housing.register.* / housing.onboarding.* / housing.duplicate.* / housing.placeholder.* / housing.tabs.* キー追加
```

不変（Foundation で確定済、変更不要）:

```
firestore.rules                                       # housing_user_meta は write: false のまま、API 経由で Admin SDK 書き込み
src/types/housing.ts                                  # 型定義は Foundation で確定済
src/constants/housing.ts                              # 定数は Foundation で確定済
```

---

## Task 1: タグマスタ定義 (`housingTags.ts`)

**Files:**
- Create: `src/data/housingTags.ts`
- Test: `src/__tests__/housing/housingTags.test.ts`

設計書 §12 / 付録 A の全タグ（テイスト 45 / シーン 40 / 季節 20 / 環境 12 / 構造 15 / その他 15 ＝ 約 147 件）を `id + category + i18nKey` 構造で定義する。実訳文は Task 23 で 4 言語の locale JSON に追加する（このタスクでは i18n キーだけ確保）。

- [ ] **Step 1: テスト先行 — タグマスタ構造の網羅性チェック**

```typescript
// src/__tests__/housing/housingTags.test.ts
import { describe, it, expect } from 'vitest';
import { HOUSING_TAGS, HOUSING_TAG_CATEGORIES, getTagsByCategory, getTagById } from '../../data/housingTags';

describe('housingTags', () => {
  it('全 6 カテゴリが定義されている', () => {
    expect(HOUSING_TAG_CATEGORIES).toEqual(['taste', 'scene', 'season', 'environment', 'structure', 'other']);
  });

  it('全タグの id がユニーク', () => {
    const ids = HOUSING_TAGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('全タグの category が定義済みカテゴリのいずれか', () => {
    for (const tag of HOUSING_TAGS) {
      expect(HOUSING_TAG_CATEGORIES).toContain(tag.category);
    }
  });

  it('全タグの i18nKey が housing.tag. で始まる', () => {
    for (const tag of HOUSING_TAGS) {
      expect(tag.i18nKey).toMatch(/^housing\.tag\./);
    }
  });

  it('カテゴリ別件数が設計書 §12.5 と一致 (許容 ±2)', () => {
    expect(getTagsByCategory('taste').length).toBeGreaterThanOrEqual(43);
    expect(getTagsByCategory('taste').length).toBeLessThanOrEqual(47);
    expect(getTagsByCategory('scene').length).toBeGreaterThanOrEqual(38);
    expect(getTagsByCategory('scene').length).toBeLessThanOrEqual(42);
    expect(getTagsByCategory('season').length).toBeGreaterThanOrEqual(18);
    expect(getTagsByCategory('season').length).toBeLessThanOrEqual(22);
    expect(getTagsByCategory('environment').length).toBeGreaterThanOrEqual(10);
    expect(getTagsByCategory('environment').length).toBeLessThanOrEqual(14);
    expect(getTagsByCategory('structure').length).toBeGreaterThanOrEqual(13);
    expect(getTagsByCategory('structure').length).toBeLessThanOrEqual(17);
    expect(getTagsByCategory('other').length).toBeGreaterThanOrEqual(13);
    expect(getTagsByCategory('other').length).toBeLessThanOrEqual(17);
  });

  it('getTagById は存在する id でタグを返す', () => {
    const modern = getTagById('modern');
    expect(modern).toBeDefined();
    expect(modern?.category).toBe('taste');
  });

  it('getTagById は存在しない id で undefined を返す', () => {
    expect(getTagById('not-a-tag')).toBeUndefined();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingTags.test.ts --run
```
期待: モジュール未存在で全 fail

- [ ] **Step 3: `housingTags.ts` を実装**

```typescript
// src/data/housingTags.ts
/**
 * ハウジングタグマスタ
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §12 / 付録 A
 *
 * - 6 カテゴリ × 約 147 タグ
 * - i18nKey 経由で 4 言語表示 (実訳は src/locales/{ja,en,ko,zh}.json)
 * - 韓国語 / 中国語の品質が「(未確認)」のものは Phase 1 後にネイティブチェック
 */

export const HOUSING_TAG_CATEGORIES = [
  'taste',
  'scene',
  'season',
  'environment',
  'structure',
  'other',
] as const;
export type HousingTagCategory = typeof HOUSING_TAG_CATEGORIES[number];

export interface HousingTag {
  id: string;
  category: HousingTagCategory;
  i18nKey: string;
}

const t = (id: string, category: HousingTagCategory): HousingTag => ({
  id,
  category,
  i18nKey: `housing.tag.${id}`,
});

export const HOUSING_TAGS: readonly HousingTag[] = [
  // テイスト (45)
  t('wafu', 'taste'), t('wamodern', 'taste'), t('chinese', 'taste'), t('korean', 'taste'),
  t('western', 'taste'), t('modern', 'taste'), t('minimal', 'taste'), t('natural', 'taste'),
  t('nordic', 'taste'), t('antique', 'taste'), t('vintage', 'taste'), t('retro', 'taste'),
  t('taisho_roman', 'taste'), t('rustic', 'taste'), t('country', 'taste'), t('cottagecore', 'taste'),
  t('gothic', 'taste'), t('dark_academia', 'taste'), t('industrial', 'taste'), t('steampunk', 'taste'),
  t('cyberpunk', 'taste'), t('scifi', 'taste'), t('fantasy', 'taste'), t('marchen', 'taste'),
  t('bohemian', 'taste'), t('luxury', 'taste'), t('chic', 'taste'), t('elegant', 'taste'),
  t('romantic', 'taste'), t('cute', 'taste'), t('pop', 'taste'), t('monochrome', 'taste'),
  t('dark', 'taste'), t('light', 'taste'), t('flashy', 'taste'), t('calm', 'taste'),
  t('simple', 'taste'), t('warm', 'taste'), t('cool', 'taste'), t('mystical', 'taste'),
  t('ruins', 'taste'), t('horror', 'taste'), t('witch', 'taste'), t('alchemist', 'taste'),
  t('sage_mage', 'taste'),
  // シーン・用途 (40)
  t('residence', 'scene'), t('apartment_room', 'scene'), t('bedroom', 'scene'), t('living_room', 'scene'),
  t('dining_room', 'scene'), t('kitchen', 'scene'), t('bath', 'scene'), t('study', 'scene'),
  t('childrens_room', 'scene'), t('walkin_closet', 'scene'), t('cafe', 'scene'), t('coffee_shop', 'scene'),
  t('jun_kissa', 'scene'), t('bar', 'scene'), t('izakaya', 'scene'), t('tavern', 'scene'),
  t('nightclub', 'scene'), t('host_club', 'scene'), t('restaurant', 'scene'), t('diner', 'scene'),
  t('ramen_shop', 'scene'), t('food_stall', 'scene'), t('tea_room', 'scene'), t('bakery', 'scene'),
  t('shop', 'scene'), t('boutique', 'scene'), t('flower_shop', 'scene'), t('bookstore', 'scene'),
  t('library', 'scene'), t('gallery', 'scene'), t('atelier', 'scene'), t('workshop', 'scene'),
  t('photo_studio', 'scene'), t('temple', 'scene'), t('shrine', 'scene'), t('church', 'scene'),
  t('school', 'scene'), t('hospital', 'scene'), t('inn', 'scene'), t('hotel', 'scene'),
  // 季節・イベント (20)
  t('spring', 'season'), t('summer', 'season'), t('autumn', 'season'), t('winter', 'season'),
  t('cherry_blossom', 'season'), t('autumn_leaves', 'season'), t('snow', 'season'), t('beach', 'season'),
  t('tanabata', 'season'), t('halloween', 'season'), t('christmas', 'season'), t('valentine', 'season'),
  t('new_year', 'season'), t('hinamatsuri', 'season'), t('easter', 'season'), t('summer_festival', 'season'),
  t('starlight', 'season'), t('guardian_day', 'season'), t('matsuri', 'season'), t('illumination', 'season'),
  // 環境・舞台設定 (12)
  t('forest', 'environment'), t('desert', 'environment'), t('snowland', 'environment'),
  t('tropical', 'environment'), t('mediterranean', 'environment'), t('grassland', 'environment'),
  t('mountain', 'environment'), t('cave', 'environment'), t('underwater', 'environment'),
  t('space', 'environment'), t('floating_island', 'environment'), t('otherworld', 'environment'),
  // 構造・特殊 (15)
  t('rooftop', 'structure'), t('basement', 'structure'), t('garden', 'structure'),
  t('terrace', 'structure'), t('courtyard', 'structure'), t('multilevel', 'structure'),
  t('multifloor', 'structure'), t('atrium', 'structure'), t('loft', 'structure'),
  t('attic', 'structure'), t('gimmick', 'structure'), t('hidden_room', 'structure'),
  t('warp_room', 'structure'), t('floating_furniture', 'structure'), t('photogenic', 'structure'),
  // その他 (15)
  t('ghibli_style', 'other'), t('pirate', 'other'), t('medieval', 'other'), t('castle', 'other'),
  t('haunted_mansion', 'other'), t('yukaku', 'other'), t('ryugujo', 'other'), t('treehouse', 'other'),
  t('camp', 'other'), t('abandoned_factory', 'other'), t('lab', 'other'), t('prison', 'other'),
  t('funeral', 'other'), t('casino', 'other'), t('theater', 'other'),
];

export function getTagsByCategory(category: HousingTagCategory): HousingTag[] {
  return HOUSING_TAGS.filter((tag) => tag.category === category);
}

export function getTagById(id: string): HousingTag | undefined {
  return HOUSING_TAGS.find((tag) => tag.id === id);
}

export function isValidTagId(id: string): boolean {
  return HOUSING_TAGS.some((tag) => tag.id === id);
}
```

- [ ] **Step 4: テスト緑化を確認**

```bash
npm test -- src/__tests__/housing/housingTags.test.ts --run
```
期待: 全テスト pass

- [ ] **Step 5: コミット**

```bash
git add src/data/housingTags.ts src/__tests__/housing/housingTags.test.ts
git commit -m "feat(housing): add tag master with 6 categories (~147 tags, i18n key only)"
```

---

## Task 2: フォーム入力検証ユーティリティ (`housingValidation.ts`)

**Files:**
- Create: `src/utils/housingValidation.ts`
- Test: `src/__tests__/housing/housingValidation.test.ts`

設計書 §6.1 のフィールド入力に対する純粋関数バリデーション。React フォームと API ハンドラの両方から使う。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/housingValidation.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateAddress,
  validateTags,
  validateDescription,
  validateRegistrationDraft,
  type RegistrationDraft,
} from '../../utils/housingValidation';

describe('validateAddress', () => {
  const base = { dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane' as const, ward: 3, plot: 12, size: 'M' as const };

  it('全フィールド OK ならエラーなし', () => {
    expect(validateAddress(base).ok).toBe(true);
  });
  it('ward が範囲外 (31)', () => {
    const r = validateAddress({ ...base, ward: 31 });
    expect(r.ok).toBe(false);
    expect(r.errors.ward).toBeDefined();
  });
  it('plot が 0', () => {
    const r = validateAddress({ ...base, plot: 0 });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });
  it('Apartment で apartmentRoom 未指定はエラー', () => {
    const r = validateAddress({ ...base, size: 'Apartment' });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentRoom).toBeDefined();
  });
  it('Apartment で apartmentRoom 指定済みは OK', () => {
    expect(validateAddress({ ...base, size: 'Apartment', apartmentRoom: 45 }).ok).toBe(true);
  });
  it('size が M で apartmentRoom 指定はエラー', () => {
    const r = validateAddress({ ...base, apartmentRoom: 45 });
    expect(r.ok).toBe(false);
    expect(r.errors.apartmentRoom).toBeDefined();
  });
  it('未知のエリアはエラー', () => {
    const r = validateAddress({ ...base, area: 'Atlantis' as never });
    expect(r.ok).toBe(false);
    expect(r.errors.area).toBeDefined();
  });
  it('dc / server / area 空文字はエラー', () => {
    const r = validateAddress({ ...base, dc: '', server: '', area: '' as never });
    expect(r.ok).toBe(false);
    expect(r.errors.dc).toBeDefined();
    expect(r.errors.server).toBeDefined();
    expect(r.errors.area).toBeDefined();
  });
});

describe('validateTags', () => {
  it('1〜5 件の正規 id', () => {
    expect(validateTags(['modern', 'cafe']).ok).toBe(true);
  });
  it('0 件はエラー', () => {
    expect(validateTags([]).ok).toBe(false);
  });
  it('6 件はエラー', () => {
    expect(validateTags(['modern', 'cafe', 'wafu', 'spring', 'summer', 'winter']).ok).toBe(false);
  });
  it('未知 id を含むとエラー', () => {
    expect(validateTags(['modern', 'not-a-tag']).ok).toBe(false);
  });
  it('重複 id はエラー', () => {
    expect(validateTags(['modern', 'modern']).ok).toBe(false);
  });
});

describe('validateDescription', () => {
  it('undefined / 空文字は OK', () => {
    expect(validateDescription(undefined).ok).toBe(true);
    expect(validateDescription('').ok).toBe(true);
  });
  it('200 文字以下は OK', () => {
    expect(validateDescription('あ'.repeat(200)).ok).toBe(true);
  });
  it('201 文字はエラー', () => {
    expect(validateDescription('あ'.repeat(201)).ok).toBe(false);
  });
});

describe('validateRegistrationDraft', () => {
  it('全 OK', () => {
    const draft: RegistrationDraft = {
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
      tags: ['modern', 'cafe'], description: 'よろしく',
    };
    expect(validateRegistrationDraft(draft).ok).toBe(true);
  });
  it('複数フィールドエラーが集約', () => {
    const draft: RegistrationDraft = {
      dc: '', server: '', area: '' as never,
      ward: 0, plot: 0, size: 'M',
      tags: [], description: 'あ'.repeat(201),
    };
    const r = validateRegistrationDraft(draft);
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingValidation.test.ts --run
```

- [ ] **Step 3: `housingValidation.ts` を実装**

```typescript
// src/utils/housingValidation.ts
/**
 * ハウジング登録フォームのバリデーション (純粋関数)
 *
 * 設計書 §4.2 / §6.1 / §13.1 と整合。
 * クライアント (React フォーム) と サーバー (/api/housing) の両方で使用。
 */
import {
  isValidHousingArea,
  isValidHousingSize,
  type HousingArea,
  type HousingSize,
} from '../types/housing';
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  HOUSING_LIMITS,
} from '../constants/housing';
import { isValidTagId } from '../data/housingTags';

export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;
  plot: number;
  size: HousingSize | string;
  apartmentRoom?: number;
}

export interface RegistrationDraft extends AddressInput {
  tags: string[];
  description?: string;
}

export type ValidationErrors = Partial<Record<string, string>>;
export interface ValidationResult { ok: boolean; errors: ValidationErrors; }

const ok = (): ValidationResult => ({ ok: true, errors: {} });
const fail = (errors: ValidationErrors): ValidationResult => ({ ok: false, errors });

export function validateAddress(addr: AddressInput): ValidationResult {
  const errors: ValidationErrors = {};

  if (!addr.dc || addr.dc.trim() === '') errors.dc = 'required';
  if (!addr.server || addr.server.trim() === '') errors.server = 'required';
  if (!addr.area || !isValidHousingArea(String(addr.area))) errors.area = 'invalid';

  if (!Number.isInteger(addr.ward) || addr.ward < WARD_RANGE.min || addr.ward > WARD_RANGE.max) {
    errors.ward = 'out_of_range';
  }
  if (!Number.isInteger(addr.plot) || addr.plot < PLOT_RANGE.min || addr.plot > PLOT_RANGE.max) {
    errors.plot = 'out_of_range';
  }
  if (!addr.size || !isValidHousingSize(String(addr.size))) errors.size = 'invalid';

  if (addr.size === 'Apartment') {
    const r = addr.apartmentRoom;
    if (!Number.isInteger(r) || (r as number) < APARTMENT_ROOM_RANGE.min || (r as number) > APARTMENT_ROOM_RANGE.max) {
      errors.apartmentRoom = 'required_for_apartment';
    }
  } else if (addr.apartmentRoom !== undefined) {
    errors.apartmentRoom = 'not_allowed_for_size';
  }

  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}

export function validateTags(tags: string[]): ValidationResult {
  if (!Array.isArray(tags) || tags.length === 0) return fail({ tags: 'min_one_required' });
  if (tags.length > HOUSING_LIMITS.MAX_TAGS_PER_LISTING) return fail({ tags: 'max_exceeded' });
  if (new Set(tags).size !== tags.length) return fail({ tags: 'duplicate' });
  for (const id of tags) {
    if (!isValidTagId(id)) return fail({ tags: 'unknown_tag' });
  }
  return ok();
}

export function validateDescription(desc: string | undefined): ValidationResult {
  if (desc === undefined || desc === '') return ok();
  if (typeof desc !== 'string') return fail({ description: 'invalid_type' });
  if (desc.length > HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH) return fail({ description: 'too_long' });
  return ok();
}

export function validateRegistrationDraft(draft: RegistrationDraft): ValidationResult {
  const errors: ValidationErrors = {};
  Object.assign(errors, validateAddress(draft).errors);
  Object.assign(errors, validateTags(draft.tags).errors);
  Object.assign(errors, validateDescription(draft.description).errors);
  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/housingValidation.test.ts --run
```

- [ ] **Step 5: コミット**

```bash
git add src/utils/housingValidation.ts src/__tests__/housing/housingValidation.test.ts
git commit -m "feat(housing): add registration form validation (pure functions)"
```

---

## Task 3: 登録枠ロジック (`housingQuota.ts`)

**Files:**
- Create: `src/utils/housingQuota.ts`
- Test: `src/__tests__/housing/housingQuota.test.ts`

設計書 §6.4 D 案を純粋関数に切り出す。`HousingUserMeta` を入力に取り、結果オブジェクト（許可可否 + 更新済み meta）を返す。サーバー側 (Vercel API) でこれを使い、Firestore Admin SDK で原子的に更新する。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/housingQuota.test.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateCanRegister,
  applyRegistrationSuccess,
  applySameDayDelete,
  initialUserMeta,
  isNewDayUTC,
} from '../../utils/housingQuota';
import type { HousingUserMeta } from '../../types/housing';

const NOW = Date.UTC(2026, 4, 8, 12, 0, 0); // 2026-05-08 12:00 UTC

describe('initialUserMeta', () => {
  it('count=0, remaining=5, lastReset=now', () => {
    const m = initialUserMeta(NOW);
    expect(m.registrationCount).toBe(0);
    expect(m.dailyQuota.remaining).toBe(5);
    expect(m.dailyQuota.lastReset).toBe(NOW);
  });
});

describe('isNewDayUTC', () => {
  it('同じ日は false', () => {
    expect(isNewDayUTC(NOW, NOW + 60_000)).toBe(false);
  });
  it('翌日 0:00 UTC は true', () => {
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    expect(isNewDayUTC(NOW, next)).toBe(true);
  });
});

describe('evaluateCanRegister', () => {
  it('count<30 なら無条件 OK', () => {
    const meta: HousingUserMeta = { registrationCount: 10, dailyQuota: { remaining: 0, lastReset: NOW } };
    const r = evaluateCanRegister(meta, NOW);
    expect(r.allowed).toBe(true);
  });
  it('count=30, 同日, remaining>0 なら OK', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 3, lastReset: NOW } };
    expect(evaluateCanRegister(meta, NOW).allowed).toBe(true);
  });
  it('count=30, 同日, remaining=0 はエラー', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 0, lastReset: NOW } };
    const r = evaluateCanRegister(meta, NOW);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe('quota_exhausted');
  });
  it('count=30, 翌日, remaining=0 でも quota リセットで OK', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 0, lastReset: NOW } };
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    const r = evaluateCanRegister(meta, next);
    expect(r.allowed).toBe(true);
    expect(r.metaAfterReset?.dailyQuota.remaining).toBe(5);
  });
});

describe('applyRegistrationSuccess', () => {
  it('count=29 → count=30, remaining 変化なし', () => {
    const meta: HousingUserMeta = { registrationCount: 29, dailyQuota: { remaining: 5, lastReset: NOW } };
    const after = applyRegistrationSuccess(meta);
    expect(after.registrationCount).toBe(30);
    expect(after.dailyQuota.remaining).toBe(5);
  });
  it('count=30 → count=31, remaining -1', () => {
    const meta: HousingUserMeta = { registrationCount: 30, dailyQuota: { remaining: 5, lastReset: NOW } };
    const after = applyRegistrationSuccess(meta);
    expect(after.registrationCount).toBe(31);
    expect(after.dailyQuota.remaining).toBe(4);
  });
});

describe('applySameDayDelete', () => {
  it('同日削除で count -1', () => {
    const meta: HousingUserMeta = { registrationCount: 31, dailyQuota: { remaining: 4, lastReset: NOW } };
    const after = applySameDayDelete(meta, NOW, NOW + 1000);
    expect(after.registrationCount).toBe(30);
    expect(after.dailyQuota.remaining).toBe(5); // 30 に戻ったので remaining +1
  });
  it('翌日以降の削除は変化なし', () => {
    const meta: HousingUserMeta = { registrationCount: 31, dailyQuota: { remaining: 4, lastReset: NOW } };
    const next = Date.UTC(2026, 4, 9, 0, 0, 1);
    const after = applySameDayDelete(meta, NOW, next);
    expect(after.registrationCount).toBe(31);
    expect(after.dailyQuota.remaining).toBe(4);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingQuota.test.ts --run
```

- [ ] **Step 3: `housingQuota.ts` を実装**

```typescript
// src/utils/housingQuota.ts
/**
 * ハウジング登録枠 (D 案) ロジック
 *
 * 設計書 §6.4 準拠。純粋関数のみ。Firestore I/O は呼び出し側 (API ハンドラ) で行う。
 *
 * - 累計 30 件まで無制限
 * - 30 件超過後は 1 日 5 件まで (UTC 日付ベース)
 * - 同日削除なら count を戻す (registrationCount が 30 を境に remaining も連動復活)
 */
import type { HousingUserMeta } from '../types/housing';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../constants/housing';

export function initialUserMeta(now: number): HousingUserMeta {
  return {
    registrationCount: 0,
    dailyQuota: { remaining: REGISTRATION_DAILY_QUOTA, lastReset: now },
  };
}

export function isNewDayUTC(prev: number, now: number): boolean {
  const a = new Date(prev);
  const b = new Date(now);
  return (
    a.getUTCFullYear() !== b.getUTCFullYear() ||
    a.getUTCMonth() !== b.getUTCMonth() ||
    a.getUTCDate() !== b.getUTCDate()
  );
}

export interface CanRegisterResult {
  allowed: boolean;
  reason?: 'quota_exhausted';
  metaAfterReset?: HousingUserMeta;
}

export function evaluateCanRegister(meta: HousingUserMeta, now: number): CanRegisterResult {
  if (meta.registrationCount < REGISTRATION_INITIAL_BONUS) {
    return { allowed: true };
  }
  let current = meta;
  if (isNewDayUTC(meta.dailyQuota.lastReset, now)) {
    current = {
      ...meta,
      dailyQuota: { remaining: REGISTRATION_DAILY_QUOTA, lastReset: now },
    };
  }
  if (current.dailyQuota.remaining > 0) {
    return { allowed: true, metaAfterReset: current };
  }
  return { allowed: false, reason: 'quota_exhausted' };
}

export function applyRegistrationSuccess(meta: HousingUserMeta): HousingUserMeta {
  const newCount = meta.registrationCount + 1;
  const consumeQuota = newCount > REGISTRATION_INITIAL_BONUS;
  return {
    ...meta,
    registrationCount: newCount,
    dailyQuota: consumeQuota
      ? { ...meta.dailyQuota, remaining: meta.dailyQuota.remaining - 1 }
      : meta.dailyQuota,
  };
}

export function applySameDayDelete(
  meta: HousingUserMeta,
  listingCreatedAt: number,
  now: number,
): HousingUserMeta {
  if (isNewDayUTC(listingCreatedAt, now)) return meta;
  const newCount = Math.max(0, meta.registrationCount - 1);
  // 30 を境に remaining が連動復活する (count > 30 から count <= 30 に戻ったら +1)
  const restoreQuota = meta.registrationCount > REGISTRATION_INITIAL_BONUS;
  return {
    ...meta,
    registrationCount: newCount,
    dailyQuota: restoreQuota
      ? {
          ...meta.dailyQuota,
          remaining: Math.min(REGISTRATION_DAILY_QUOTA, meta.dailyQuota.remaining + 1),
        }
      : meta.dailyQuota,
  };
}
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/housingQuota.test.ts --run
```

- [ ] **Step 5: コミット**

```bash
git add src/utils/housingQuota.ts src/__tests__/housing/housingQuota.test.ts
git commit -m "feat(housing): add registration quota logic (D plan, pure functions)"
```

---

## Task 4: 同住所キー生成 (`housingDuplicate.ts`)

**Files:**
- Create: `src/utils/housingDuplicate.ts`
- Test: `src/__tests__/housing/housingDuplicate.test.ts`

設計書 §6.5 の重複登録ハンドリング用に「同住所」を判定する key 文字列を生成する純粋関数。Firestore で `where('addressKey', '==', key)` クエリに使う。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/housingDuplicate.test.ts
import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from '../../utils/housingDuplicate';

describe('buildAddressKey', () => {
  it('住所フィールドを連結した文字列を返す', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|M');
  });
  it('Apartment は room 番号を含む', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'Apartment', apartmentRoom: 45,
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|Apartment|R45');
  });
  it('PrivateRoom は room を含まない', () => {
    const key = buildAddressKey({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'PrivateRoom',
    });
    expect(key).toBe('Mana|Pandaemonium|Shirogane|W3|P12|PrivateRoom');
  });
});

describe('isSameAddress', () => {
  const a = { dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane' as const, ward: 3, plot: 12, size: 'M' as const };
  it('全フィールド一致なら true', () => {
    expect(isSameAddress(a, { ...a })).toBe(true);
  });
  it('plot が違うと false', () => {
    expect(isSameAddress(a, { ...a, plot: 13 })).toBe(false);
  });
  it('Apartment 同士で room が違うと false', () => {
    const ap1 = { ...a, size: 'Apartment' as const, apartmentRoom: 45 };
    const ap2 = { ...a, size: 'Apartment' as const, apartmentRoom: 46 };
    expect(isSameAddress(ap1, ap2)).toBe(false);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingDuplicate.test.ts --run
```

- [ ] **Step 3: `housingDuplicate.ts` を実装**

```typescript
// src/utils/housingDuplicate.ts
/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 §6.5 の重複登録ハンドリングに使用。
 * housing_listings ドキュメントに addressKey フィールドを保存し、
 * `where('addressKey', '==', key)` で一致を検索する。
 */
import type { AddressInput } from './housingValidation';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}|P${addr.plot}|${addr.size}`;
  if (addr.size === 'Apartment' && addr.apartmentRoom !== undefined) {
    return `${base}|R${addr.apartmentRoom}`;
  }
  return base;
}

export function isSameAddress(a: AddressInput, b: AddressInput): boolean {
  return buildAddressKey(a) === buildAddressKey(b);
}
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/housingDuplicate.test.ts --run
```

- [ ] **Step 5: コミット**

```bash
git add src/utils/housingDuplicate.ts src/__tests__/housing/housingDuplicate.test.ts
git commit -m "feat(housing): add address key builder for duplicate detection"
```

---

## Task 5: HousingListing 型に `addressKey` を追加

**Files:**
- Modify: `src/types/housing.ts` (lines 71-99)
- Modify: `src/__tests__/housing/housingTypes.test.ts` (Foundation で作成済)
- Modify: `firestore.rules` (housing_listings の create/update バリデーション拡張)

`addressKey` は Firestore で同住所検索クエリに使う denormalized field。書き込みは API 経由のみで、サーバー側で `buildAddressKey()` から生成する（クライアント側で勝手に書かれないよう rules で検証）。

- [ ] **Step 1: 既存テストファイルに addressKey の検証を追加**

```typescript
// src/__tests__/housing/housingTypes.test.ts に追記
describe('HousingListing.addressKey', () => {
  it('listing 型は addressKey フィールドを持つ', () => {
    const listing: HousingListing = {
      id: 'abc', ownerUid: 'u1',
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
      addressKey: 'Mana|Pandaemonium|Shirogane|W3|P12|M',
      imageMode: 'none',
      tags: ['modern'],
      createdAt: 0, updatedAt: 0,
      isHidden: false, reportCount: 0,
    };
    expect(listing.addressKey).toBeDefined();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認**

```bash
npm test -- src/__tests__/housing/housingTypes.test.ts --run
```
期待: 型エラー or fail

- [ ] **Step 3: `HousingListing` 型に `addressKey` を追加**

```typescript
// src/types/housing.ts の HousingListing インターフェース内、ward/plot/size の直後に追記:
export interface HousingListing {
  id: string;
  ownerUid: string;

  // 住所
  dc: string;
  server: string;
  area: HousingArea;
  ward: number;
  plot: number;
  size: HousingSize;
  apartmentRoom?: number;

  // 同住所検索用 denormalized key (サーバー側で生成、クライアント書き換え不可)
  addressKey: string;

  // 画像（3 択のいずれか）
  imageMode: ImageMode;
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;

  // ユーザー入力
  tags: string[];
  description?: string;

  // システム
  createdAt: number;
  updatedAt: number;
  isHidden: boolean;
  reportCount: number;
}
```

- [ ] **Step 4: firestore.rules で addressKey 検証を追加**

`firestore.rules` の `match /housing_listings/{listingId}` 内、create / update に追記:

```javascript
// create に追記:
&& request.resource.data.addressKey is string
&& request.resource.data.addressKey.size() <= 200

// update に追記 (addressKey 変更不可):
&& request.resource.data.addressKey == resource.data.addressKey
```

- [ ] **Step 5: テスト緑化を確認**

```bash
npm test -- src/__tests__/housing/housingTypes.test.ts --run
npx tsc --noEmit
```

- [ ] **Step 6: rules ローカル検証 (firebase emulators 不要、構文チェックのみ)**

```bash
npx firebase deploy --only firestore:rules --dry-run
```
期待: パース成功

- [ ] **Step 7: コミット (rules デプロイは Task 12 でまとめて行う)**

```bash
git add src/types/housing.ts src/__tests__/housing/housingTypes.test.ts firestore.rules
git commit -m "feat(housing): add addressKey field for duplicate search"
```

---

## Task 6: Firestore listings 読み取り service (`housingListingsService.ts`)

**Files:**
- Create: `src/lib/housingListingsService.ts`
- Test: `src/__tests__/housing/housingListingsService.test.ts`

クライアント側から Firestore の housing_listings を **読むだけ** の service。書き込みは Vercel API 経由なのでこのファイルには含めない。Sub-spec 2A では「重複住所検索」のみ使うが、ギャラリー (Sub-spec 2B) でも使うので汎用的に作る。

- [ ] **Step 1: テスト先行 (Firestore モジュールをモック)**

```typescript
// src/__tests__/housing/housingListingsService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/firebase', () => ({ db: {} }));
const mockGetDocs = vi.fn();
const mockQuery = vi.fn();
const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: (...a: unknown[]) => mockCollection(...a),
  query: (...a: unknown[]) => mockQuery(...a),
  where: (...a: unknown[]) => mockWhere(...a),
  limit: (...a: unknown[]) => mockLimit(...a),
  getDocs: (...a: unknown[]) => mockGetDocs(...a),
}));

import { findListingsByAddressKey } from '../../lib/housingListingsService';

beforeEach(() => {
  mockGetDocs.mockReset();
  mockQuery.mockReset();
  mockCollection.mockReset();
  mockWhere.mockReset();
  mockLimit.mockReset();
});

describe('findListingsByAddressKey', () => {
  it('addressKey で一致する listings を返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'l1', data: () => ({ ownerUid: 'u1', addressKey: 'k', dc: 'Mana', server: 'P', area: 'Shirogane', ward: 3, plot: 12, size: 'M', imageMode: 'none', tags: ['modern'], createdAt: 0, updatedAt: 0, isHidden: false, reportCount: 0 }) },
      ],
    });
    const results = await findListingsByAddressKey('k');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('l1');
    expect(mockWhere).toHaveBeenCalledWith('addressKey', '==', 'k');
    expect(mockWhere).toHaveBeenCalledWith('isHidden', '==', false);
  });
  it('一致なし→空配列', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const results = await findListingsByAddressKey('k');
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingListingsService.test.ts --run
```

- [ ] **Step 3: `housingListingsService.ts` を実装**

```typescript
// src/lib/housingListingsService.ts
/**
 * housing_listings コレクションの読み取り専用クライアント
 *
 * 書き込みは /api/housing 経由 (housingApiClient.ts 参照)。
 * Sub-spec 2A では同住所検索のみ使用、Sub-spec 2B のギャラリーで getRecentListings も使う。
 */
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import type { HousingListing } from '../types/housing';

const COLLECTION_NAME = 'housing_listings';

export async function findListingsByAddressKey(addressKey: string): Promise<HousingListing[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('addressKey', '==', addressKey),
    where('isHidden', '==', false),
    limit(10),
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<HousingListing, 'id'>),
  }));
}
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/housingListingsService.test.ts --run
```

- [ ] **Step 5: コミット**

```bash
git add src/lib/housingListingsService.ts src/__tests__/housing/housingListingsService.test.ts
git commit -m "feat(housing): add listings read service (address key lookup)"
```

---

## Task 7: Vercel API ルーター (`api/housing/index.ts`)

**Files:**
- Create: `api/housing/index.ts`
- Create: `api/housing/_canRegisterHandler.ts` (空のスタブ、Task 8 で実装)
- Create: `api/housing/_registerListingHandler.ts` (空のスタブ、Task 9 で実装)
- Create: `api/housing/_checkDuplicateHandler.ts` (空のスタブ、Task 10 で実装)

`api/template/index.ts` パターンに倣い、`?action=` で 3 ハンドラに分岐するルーター。各ハンドラはこのタスクではスタブで Method Not Allowed を返すのみ。

- [ ] **Step 1: 3 つのハンドラスタブを作成**

```typescript
// api/housing/_canRegisterHandler.ts
export default async function handler(_req: any, res: any) {
  return res.status(501).json({ error: 'Not implemented (Task 8)' });
}
```

```typescript
// api/housing/_registerListingHandler.ts
export default async function handler(_req: any, res: any) {
  return res.status(501).json({ error: 'Not implemented (Task 9)' });
}
```

```typescript
// api/housing/_checkDuplicateHandler.ts
export default async function handler(_req: any, res: any) {
  return res.status(501).json({ error: 'Not implemented (Task 10)' });
}
```

- [ ] **Step 2: ルーターを作成**

```typescript
// api/housing/index.ts
/**
 * ハウジング系統合エンドポイント
 *
 * ?action=can-register      → GET 登録可能か判定 (auth + housing_user_meta 読み)
 * ?action=register-listing  → POST 物件登録 (canRegister + listings 作成 + meta 更新)
 * ?action=check-duplicate   → POST 同住所重複検索
 */
import canRegisterHandler from './_canRegisterHandler.js';
import registerListingHandler from './_registerListingHandler.js';
import checkDuplicateHandler from './_checkDuplicateHandler.js';

export default async function handler(req: any, res: any) {
  const action = req.query?.action;

  switch (action) {
    case 'can-register':
      return canRegisterHandler(req, res);
    case 'register-listing':
      return registerListingHandler(req, res);
    case 'check-duplicate':
      return checkDuplicateHandler(req, res);
    default:
      return res.status(400).json({
        error: 'Missing or invalid action parameter. Use ?action=can-register|register-listing|check-duplicate',
      });
  }
}
```

- [ ] **Step 3: ローカル動作確認**

```bash
npx vercel dev --listen 3001 &
sleep 3
curl -s "http://localhost:3001/api/housing?action=can-register" | head -5
curl -s "http://localhost:3001/api/housing?action=invalid" | head -5
kill %1 2>/dev/null || true
```
期待: 501 / 400 が返る

- [ ] **Step 4: コミット**

```bash
git add api/housing/
git commit -m "feat(housing): add /api/housing router skeleton (3 actions, stubs)"
```

---

## Task 8: `can-register` API ハンドラ実装

**Files:**
- Modify: `api/housing/_canRegisterHandler.ts`

GET `/api/housing?action=can-register` で「現在の uid が登録可能か」を返す。`housing_user_meta` を読み、未存在ならその場で初期化する（書き込みは Admin SDK 経由なので rules の write:false に抵触しない）。

- [ ] **Step 1: ハンドラを実装**

```typescript
// api/housing/_canRegisterHandler.ts
/**
 * GET /api/housing?action=can-register
 * 認証ユーザーが現在登録可能かを返す。
 * 必要なら housing_user_meta を初期化する (書き込みは Admin SDK 経由)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { evaluateCanRegister, initialUserMeta } from '../../src/utils/housingQuota.js';
import type { HousingUserMeta } from '../../src/types/housing.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const adminDb = getAdminFirestore();

    const ref = adminDb.collection('housing_user_meta').doc(uid);
    const snap = await ref.get();
    const now = Date.now();

    let meta: HousingUserMeta;
    if (!snap.exists) {
      meta = initialUserMeta(now);
      await ref.set(meta);
    } else {
      meta = snap.data() as HousingUserMeta;
    }

    const result = evaluateCanRegister(meta, now);
    if (result.metaAfterReset) {
      // 日付またぎで quota がリセットされたので保存
      await ref.set(result.metaAfterReset, { merge: true });
      meta = result.metaAfterReset;
    }

    return res.status(200).json({
      allowed: result.allowed,
      reason: result.reason ?? null,
      registrationCount: meta.registrationCount,
      remaining: meta.dailyQuota.remaining,
      lastReset: meta.dailyQuota.lastReset,
    });
  } catch (error: any) {
    console.error('[housing/can-register] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: ローカル動作確認 (要 Firebase Auth トークン取得)**

```bash
# 別ターミナルで dev server 起動
npm run dev
# 別ターミナルで vercel dev
npx vercel dev --listen 3001 &
sleep 3
# 認証なしで叩く
curl -s -X GET "http://localhost:3001/api/housing?action=can-register" | head -5
# 期待: 401 Missing auth token
kill %1 2>/dev/null || true
```

- [ ] **Step 3: コミット**

```bash
git add api/housing/_canRegisterHandler.ts
git commit -m "feat(housing): implement can-register API handler (D plan quota check)"
```

---

## Task 9: `register-listing` API ハンドラ実装

**Files:**
- Modify: `api/housing/_registerListingHandler.ts`

POST `/api/housing?action=register-listing` で物件登録を実行する。`evaluateCanRegister` で再チェック、入力を `validateRegistrationDraft` で検証、`buildAddressKey` で key 生成、`housing_listings` に書き込み、`housing_user_meta` を `applyRegistrationSuccess` で更新する。Firestore Transaction で原子的に。

- [ ] **Step 1: ハンドラを実装**

```typescript
// api/housing/_registerListingHandler.ts
/**
 * POST /api/housing?action=register-listing
 * Body: RegistrationDraft (画像なしモード固定)
 *
 * 原子操作:
 *   1. housing_user_meta.canRegister 再評価
 *   2. validateRegistrationDraft で入力検証
 *   3. addressKey 生成
 *   4. housing_listings に新規ドキュメント作成 (imageMode='none' 固定)
 *   5. housing_user_meta を applyRegistrationSuccess で更新
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { getAuth } from 'firebase-admin/auth';
import { evaluateCanRegister, applyRegistrationSuccess, initialUserMeta } from '../../src/utils/housingQuota.js';
import { validateRegistrationDraft, type RegistrationDraft } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';
import type { HousingUserMeta } from '../../src/types/housing.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  try {
    initAdmin();
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Missing auth token' });

    const decoded = await getAuth().verifyIdToken(token);
    const uid = decoded.uid;
    const draft = req.body as RegistrationDraft;

    const validation = validateRegistrationDraft(draft);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_draft', errors: validation.errors });
    }

    const adminDb = getAdminFirestore();
    const metaRef = adminDb.collection('housing_user_meta').doc(uid);
    const listingsCol = adminDb.collection('housing_listings');
    const now = Date.now();
    const addressKey = buildAddressKey(draft);

    let createdId: string | null = null;
    await adminDb.runTransaction(async (tx) => {
      const metaSnap = await tx.get(metaRef);
      let meta: HousingUserMeta = metaSnap.exists
        ? (metaSnap.data() as HousingUserMeta)
        : initialUserMeta(now);

      const can = evaluateCanRegister(meta, now);
      if (!can.allowed) throw new Error('quota_exhausted');
      if (can.metaAfterReset) meta = can.metaAfterReset;

      const newRef = listingsCol.doc();
      const listing = {
        ownerUid: uid,
        dc: draft.dc,
        server: draft.server,
        area: draft.area,
        ward: draft.ward,
        plot: draft.plot,
        size: draft.size,
        ...(draft.size === 'Apartment' ? { apartmentRoom: draft.apartmentRoom } : {}),
        addressKey,
        imageMode: 'none' as const,
        tags: draft.tags,
        ...(draft.description ? { description: draft.description } : {}),
        createdAt: now,
        updatedAt: now,
        isHidden: false,
        reportCount: 0,
      };
      tx.set(newRef, listing);
      createdId = newRef.id;

      const updatedMeta = applyRegistrationSuccess(meta);
      tx.set(metaRef, updatedMeta);
    });

    return res.status(200).json({ id: createdId, addressKey });
  } catch (error: any) {
    if (error?.message === 'quota_exhausted') {
      return res.status(429).json({ error: 'quota_exhausted' });
    }
    console.error('[housing/register-listing] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: tsc 確認**

```bash
npx tsc --noEmit
```
期待: エラーなし

- [ ] **Step 3: コミット**

```bash
git add api/housing/_registerListingHandler.ts
git commit -m "feat(housing): implement register-listing API handler (atomic transaction)"
```

---

## Task 10: `check-duplicate` API ハンドラ実装

**Files:**
- Modify: `api/housing/_checkDuplicateHandler.ts`

POST `/api/housing?action=check-duplicate` で同住所の既存登録を返す。Firestore 直接読みでもクライアントから可能だが、API 経由にしてレスポンス整形 + レート制限を統一する。

- [ ] **Step 1: ハンドラを実装**

```typescript
// api/housing/_checkDuplicateHandler.ts
/**
 * POST /api/housing?action=check-duplicate
 * Body: AddressInput (DC/サーバー/エリア/区/番地/サイズ + Apartment なら room)
 * Response: { duplicates: Array<{ id, ownerUid, createdAt, tags }> }
 *
 * 認証不要 (登録ボタン押下前のプレチェックなので)。
 */
import { initAdmin, getAdminFirestore } from '../../src/lib/adminAuth.js';
import { verifyAppCheck } from '../../src/lib/appCheckVerify.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { validateAddress, type AddressInput } from '../../src/utils/housingValidation.js';
import { buildAddressKey } from '../../src/utils/housingDuplicate.js';

function setCors(req: any, res: any) {
  const origin = req.headers?.origin || '';
  const allowed = [
    'https://lopoly.app',
    'https://lopo-miti.vercel.app',
    'http://localhost:5173',
    'http://localhost:4173',
  ];
  const ok = allowed.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
  res.setHeader('Access-Control-Allow-Origin', ok ? origin : allowed[0]);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Firebase-AppCheck');
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifyAppCheck(req, res))) return;
  if (!(await applyRateLimit(req, res, 30, 60_000))) return;

  try {
    initAdmin();
    const addr = req.body as AddressInput;

    const validation = validateAddress(addr);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_address', errors: validation.errors });
    }

    const addressKey = buildAddressKey(addr);
    const adminDb = getAdminFirestore();
    const snap = await adminDb
      .collection('housing_listings')
      .where('addressKey', '==', addressKey)
      .where('isHidden', '==', false)
      .limit(5)
      .get();

    const duplicates = snap.docs.map((doc) => ({
      id: doc.id,
      ownerUid: doc.data().ownerUid,
      createdAt: doc.data().createdAt,
      tags: doc.data().tags ?? [],
    }));

    return res.status(200).json({ duplicates });
  } catch (error: any) {
    console.error('[housing/check-duplicate] error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}
```

- [ ] **Step 2: tsc 確認**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: コミット**

```bash
git add api/housing/_checkDuplicateHandler.ts
git commit -m "feat(housing): implement check-duplicate API handler"
```

---

## Task 11: API クライアントラッパー (`housingApiClient.ts`)

**Files:**
- Create: `src/lib/housingApiClient.ts`
- Test: `src/__tests__/housing/housingApiClient.test.ts`

クライアント側から `/api/housing` を叩く薄いラッパー。`apiClient.ts` パターンに倣い、Firebase Auth トークン + App Check トークンをヘッダに付ける。

- [ ] **Step 1: 既存 apiClient.ts を確認**

```bash
cat src/lib/apiClient.ts
```
既存の `getAuthHeaders()` ヘルパーがあれば再利用、なければ inline で書く。

- [ ] **Step 2: テスト先行 (fetch をモック)**

```typescript
// src/__tests__/housing/housingApiClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/firebase', () => ({
  auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('test-token') } },
  appCheck: Promise.resolve({}),
}));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn().mockResolvedValue({ token: 'app-check-token' }),
}));

import { canRegister, registerListing, checkDuplicate } from '../../lib/housingApiClient';

beforeEach(() => {
  vi.spyOn(globalThis, 'fetch').mockReset();
});

describe('canRegister', () => {
  it('GET /api/housing?action=can-register を叩く', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ allowed: true, registrationCount: 5, remaining: 5, lastReset: 0 }), { status: 200 }),
    );
    const result = await canRegister();
    expect(result.allowed).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/housing?action=can-register'),
      expect.objectContaining({ method: 'GET' }),
    );
  });
});

describe('registerListing', () => {
  it('POST register-listing で id を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'l1', addressKey: 'k' }), { status: 200 }),
    );
    const result = await registerListing({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M', tags: ['modern'],
    });
    expect(result.id).toBe('l1');
  });
  it('429 quota_exhausted は QuotaExhaustedError を投げる', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'quota_exhausted' }), { status: 429 }),
    );
    await expect(
      registerListing({
        dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
        ward: 3, plot: 12, size: 'M', tags: ['modern'],
      }),
    ).rejects.toThrow('quota_exhausted');
  });
});

describe('checkDuplicate', () => {
  it('POST check-duplicate で duplicates 配列を返す', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ duplicates: [{ id: 'l1', ownerUid: 'u1', createdAt: 0, tags: ['modern'] }] }), { status: 200 }),
    );
    const result = await checkDuplicate({
      dc: 'Mana', server: 'Pandaemonium', area: 'Shirogane',
      ward: 3, plot: 12, size: 'M',
    });
    expect(result.duplicates).toHaveLength(1);
  });
});
```

- [ ] **Step 3: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/housingApiClient.test.ts --run
```

- [ ] **Step 4: `housingApiClient.ts` を実装**

```typescript
// src/lib/housingApiClient.ts
/**
 * /api/housing クライアント
 *
 * - canRegister: 登録可能か事前チェック (フォーム表示時に呼ぶ)
 * - registerListing: 物件登録 (フォーム送信時)
 * - checkDuplicate: 同住所重複チェック (フォーム送信前のプレチェック)
 */
import { auth, appCheck } from './firebase';
import { getToken } from 'firebase/app-check';
import type { AddressInput, RegistrationDraft } from '../utils/housingValidation';

const API_BASE = '/api/housing';

export class QuotaExhaustedError extends Error {
  constructor() {
    super('quota_exhausted');
    this.name = 'QuotaExhaustedError';
  }
}

async function buildHeaders(requireAuth: boolean): Promise<HeadersInit> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const ac = await appCheck;
    if (ac) {
      const token = await getToken(ac as any, false);
      headers['X-Firebase-AppCheck'] = token.token;
    }
  } catch {
    // App Check 取得失敗時はヘッダなしで送る (サーバー側で 401 を返す)
  }
  if (requireAuth) {
    const user = auth.currentUser;
    if (!user) throw new Error('not_authenticated');
    const idToken = await user.getIdToken();
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  return headers;
}

export interface CanRegisterResponse {
  allowed: boolean;
  reason: string | null;
  registrationCount: number;
  remaining: number;
  lastReset: number;
}

export async function canRegister(): Promise<CanRegisterResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=can-register`, { method: 'GET', headers });
  if (!res.ok) throw new Error(`can-register failed: ${res.status}`);
  return (await res.json()) as CanRegisterResponse;
}

export interface RegisterListingResponse {
  id: string;
  addressKey: string;
}

export async function registerListing(draft: RegistrationDraft): Promise<RegisterListingResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=register-listing`, {
    method: 'POST',
    headers,
    body: JSON.stringify(draft),
  });
  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    if (body.error === 'quota_exhausted') throw new QuotaExhaustedError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `register-listing failed: ${res.status}`);
  }
  return (await res.json()) as RegisterListingResponse;
}

export interface DuplicateEntry {
  id: string;
  ownerUid: string;
  createdAt: number;
  tags: string[];
}
export interface CheckDuplicateResponse {
  duplicates: DuplicateEntry[];
}

export async function checkDuplicate(addr: AddressInput): Promise<CheckDuplicateResponse> {
  const headers = await buildHeaders(false);
  const res = await fetch(`${API_BASE}?action=check-duplicate`, {
    method: 'POST',
    headers,
    body: JSON.stringify(addr),
  });
  if (!res.ok) throw new Error(`check-duplicate failed: ${res.status}`);
  return (await res.json()) as CheckDuplicateResponse;
}
```

- [ ] **Step 5: テスト緑化**

```bash
npm test -- src/__tests__/housing/housingApiClient.test.ts --run
```

- [ ] **Step 6: コミット**

```bash
git add src/lib/housingApiClient.ts src/__tests__/housing/housingApiClient.test.ts
git commit -m "feat(housing): add API client wrapper (auth + app check headers)"
```

---

## Task 12: firestore.rules + addressKey デプロイ

**Files:**
- 既存 `firestore.rules` を本番にデプロイ

Task 5 で追加した `addressKey` 検証を本番に反映。

- [ ] **Step 1: rules 内容を最終確認**

```bash
grep -n "addressKey" firestore.rules
```
期待: housing_listings の create / update に addressKey の検証が入っている

- [ ] **Step 2: 本番デプロイ**

```bash
npx firebase deploy --only firestore:rules
```

- [ ] **Step 3: 確認**
本番 Firestore Console (https://console.firebase.google.com/project/lopo-7793e/firestore/rules) で更新時刻を確認。

- [ ] **Step 4: コミットなし（rules は既に Task 5 で commit 済）**

---

## Task 13: ページタブ骨格 (`HousingPage.tsx` + `HousingTabBar.tsx`)

**Files:**
- Create: `src/components/housing/HousingPage.tsx`
- Create: `src/components/housing/HousingTabBar.tsx`
- Create: `src/components/housing/HousingPlaceholderView.tsx`
- Test: `src/__tests__/housing/HousingTabBar.test.tsx`

`/housing` のメインコンテナ。3 タブ「探す / 回る / 登録」を持ち、URL ハッシュ (`#search` / `#tour` / `#register`) で内部 state を管理。Sub-spec 2A では「登録」タブのみ機能、他はプレースホルダ。

デザインは仮置き：既存 Tailwind クラス (`bg-app-surface`, `text-app-text` 等) のみ使用、リキッドグラスは未適用。

- [ ] **Step 1: テスト先行 (TabBar のみ)**

```typescript
// src/__tests__/housing/HousingTabBar.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HousingTabBar } from '../../components/housing/HousingTabBar';

describe('HousingTabBar', () => {
  it('3 つのタブを表示する', () => {
    render(<HousingTabBar activeTab="register" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /housing\.tabs\.search/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.tour/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /housing\.tabs\.register/i })).toBeInTheDocument();
  });

  it('activeTab に aria-selected=true が付く', () => {
    render(<HousingTabBar activeTab="register" onChange={() => {}} />);
    const reg = screen.getByRole('tab', { name: /housing\.tabs\.register/i });
    expect(reg).toHaveAttribute('aria-selected', 'true');
  });

  it('クリックで onChange が呼ばれる', async () => {
    const user = (await import('@testing-library/user-event')).default.setup();
    const onChange = vi.fn();
    render(<HousingTabBar activeTab="register" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: /housing\.tabs\.search/i }));
    expect(onChange).toHaveBeenCalledWith('search');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingTabBar.test.tsx --run
```

- [ ] **Step 3: `HousingTabBar.tsx` を実装**

```tsx
// src/components/housing/HousingTabBar.tsx
import { useTranslation } from 'react-i18next';

export type HousingTab = 'search' | 'tour' | 'register';

interface Props {
  activeTab: HousingTab;
  onChange: (tab: HousingTab) => void;
}

export const HousingTabBar: React.FC<Props> = ({ activeTab, onChange }) => {
  const { t } = useTranslation();
  const tabs: { id: HousingTab; labelKey: string }[] = [
    { id: 'search', labelKey: 'housing.tabs.search' },
    { id: 'tour', labelKey: 'housing.tabs.tour' },
    { id: 'register', labelKey: 'housing.tabs.register' },
  ];

  return (
    <div role="tablist" className="flex border-b border-app-border bg-app-surface">
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`flex-1 py-3 text-app-md font-medium tracking-wider transition-colors ${
              active
                ? 'text-app-text border-b-2 border-app-text'
                : 'text-app-text-muted hover:text-app-text'
            }`}
          >
            {t(tab.labelKey)}
          </button>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 4: `HousingPlaceholderView.tsx` を実装 (最小)**

```tsx
// src/components/housing/HousingPlaceholderView.tsx
import { useTranslation } from 'react-i18next';

interface Props {
  i18nKey: string; // 例: 'housing.placeholder.search'
}

export const HousingPlaceholderView: React.FC<Props> = ({ i18nKey }) => {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8 text-center">
      <p className="text-app-md text-app-text-muted">{t(i18nKey)}</p>
    </div>
  );
};
```

- [ ] **Step 5: `HousingPage.tsx` を実装 (タブ切替の枠 + Coming Soon プレースホルダで仮埋め、Task 17 で登録フォーム接続)**

```tsx
// src/components/housing/HousingPage.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';
import { HousingTabBar, type HousingTab } from './HousingTabBar';
import { HousingPlaceholderView } from './HousingPlaceholderView';

function readTabFromHash(): HousingTab {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'search' || hash === 'tour' || hash === 'register') return hash;
  return 'search';
}

export const HousingPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();
  const [tab, setTab] = useState<HousingTab>(readTabFromHash);

  useEffect(() => {
    document.title = t('app.page_title_housing');
  }, [t]);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (next: HousingTab) => {
    window.location.hash = next;
    setTab(next);
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-app-bg)', color: 'var(--color-app-text)' }}
    >
      <HousingTabBar activeTab={tab} onChange={handleTabChange} />
      <div className="flex-1">
        {tab === 'search' && <HousingPlaceholderView i18nKey="housing.placeholder.search" />}
        {tab === 'tour' && <HousingPlaceholderView i18nKey="housing.placeholder.tour" />}
        {tab === 'register' && <HousingPlaceholderView i18nKey="housing.placeholder.register_loading" />}
      </div>
    </main>
  );
};
```

- [ ] **Step 6: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingTabBar.test.tsx --run
```

- [ ] **Step 7: バレル export 更新**

`src/components/housing/index.ts` に追記:

```typescript
export { HousingPage } from './HousingPage';
export { HousingTabBar } from './HousingTabBar';
export { HousingPlaceholderView } from './HousingPlaceholderView';
```

- [ ] **Step 8: コミット**

```bash
git add src/components/housing/HousingPage.tsx src/components/housing/HousingTabBar.tsx src/components/housing/HousingPlaceholderView.tsx src/components/housing/index.ts src/__tests__/housing/HousingTabBar.test.tsx
git commit -m "feat(housing): add page skeleton with 3 tabs (search/tour/register)"
```

---

## Task 14: 住所入力フィールド (`HousingRegisterAddressFields.tsx`)

**Files:**
- Create: `src/components/housing/register/HousingRegisterAddressFields.tsx`
- Test: `src/__tests__/housing/HousingRegisterAddressFields.test.tsx`

DC / サーバー / エリア / 区 / 番地 / サイズ / (Apartment 時のみ room) を入力する制御コンポーネント。`serverMasterData` / `housingAreaMasterData` / `housingSizeMasterData` から選択肢生成、変更を `onChange(addr)` で親に通知。バリデーションは親で実行、エラー文字列を `errors` prop で受けて表示。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingRegisterAddressFields.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterAddressFields } from '../../components/housing/register/HousingRegisterAddressFields';

const baseValue = { dc: '', server: '', area: '' as never, ward: 1, plot: 1, size: 'M' as const };

describe('HousingRegisterAddressFields', () => {
  it('全フィールドが描画される', () => {
    render(<HousingRegisterAddressFields value={baseValue} onChange={() => {}} errors={{}} />);
    expect(screen.getByLabelText(/housing\.register\.dc/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.server/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.area/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.ward/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.plot/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/housing\.register\.size/i)).toBeInTheDocument();
  });

  it('size=Apartment を選択すると apartmentRoom フィールドが表示される', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(<HousingRegisterAddressFields value={baseValue} onChange={onChange} errors={{}} />);
    expect(screen.queryByLabelText(/housing\.register\.apartment_room/i)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/housing\.register\.size/i), 'Apartment');
    expect(onChange).toHaveBeenCalled();
    rerender(<HousingRegisterAddressFields value={{ ...baseValue, size: 'Apartment' }} onChange={onChange} errors={{}} />);
    expect(screen.getByLabelText(/housing\.register\.apartment_room/i)).toBeInTheDocument();
  });

  it('errors.ward があるとエラーメッセージが出る', () => {
    render(<HousingRegisterAddressFields value={baseValue} onChange={() => {}} errors={{ ward: 'out_of_range' }} />);
    expect(screen.getByText(/housing\.register\.errors\.ward\.out_of_range/i)).toBeInTheDocument();
  });

  it('DC を選ぶとサーバーリストが絞り込まれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterAddressFields value={{ ...baseValue, dc: 'Mana' }} onChange={onChange} errors={{}} />);
    const serverSelect = screen.getByLabelText(/housing\.register\.server/i) as HTMLSelectElement;
    const options = Array.from(serverSelect.options).map((o) => o.value);
    expect(options).toContain('Pandaemonium');
    expect(options).not.toContain('Aegis');
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingRegisterAddressFields.test.tsx --run
```

- [ ] **Step 3: `HousingRegisterAddressFields.tsx` を実装**

```tsx
// src/components/housing/register/HousingRegisterAddressFields.tsx
import { useTranslation } from 'react-i18next';
import { serverMasterData, housingAreaMasterData, housingSizeMasterData } from '../../../data/masterData';
import { HOUSING_AREAS, HOUSING_SIZES, type HousingArea, type HousingSize } from '../../../types/housing';
import { WARD_RANGE, PLOT_RANGE, APARTMENT_ROOM_RANGE } from '../../../constants/housing';
import type { AddressInput } from '../../../utils/housingValidation';
import type { ValidationErrors } from '../../../utils/housingValidation';

interface Props {
  value: AddressInput;
  onChange: (next: AddressInput) => void;
  errors: ValidationErrors;
}

export const HousingRegisterAddressFields: React.FC<Props> = ({ value, onChange, errors }) => {
  const { t } = useTranslation();
  const dcKeys = Object.keys(serverMasterData);
  const serverKeys = value.dc ? Object.keys(serverMasterData[value.dc]?.servers ?? {}) : [];

  const update = <K extends keyof AddressInput>(key: K, v: AddressInput[K]) => {
    onChange({ ...value, [key]: v });
  };

  const fieldClass = 'w-full bg-app-surface2 border border-app-border rounded-md p-2 text-app-md';
  const errorClass = 'text-app-red text-app-sm mt-1';

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="housing-dc" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.dc')}
        </label>
        <select
          id="housing-dc"
          className={fieldClass}
          value={value.dc}
          onChange={(e) => onChange({ ...value, dc: e.target.value, server: '' })}
        >
          <option value="">—</option>
          {dcKeys.map((dc) => <option key={dc} value={dc}>{dc}</option>)}
        </select>
        {errors.dc && <p className={errorClass}>{t(`housing.register.errors.dc.${errors.dc}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-server" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.server')}
        </label>
        <select
          id="housing-server"
          className={fieldClass}
          value={value.server}
          disabled={!value.dc}
          onChange={(e) => update('server', e.target.value)}
        >
          <option value="">—</option>
          {serverKeys.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {errors.server && <p className={errorClass}>{t(`housing.register.errors.server.${errors.server}`)}</p>}
      </div>

      <div>
        <label htmlFor="housing-area" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.area')}
        </label>
        <select
          id="housing-area"
          className={fieldClass}
          value={value.area}
          onChange={(e) => update('area', e.target.value as HousingArea)}
        >
          <option value="">—</option>
          {HOUSING_AREAS.map((a) => (
            <option key={a} value={a}>{housingAreaMasterData[a]?.name_jp ?? a}</option>
          ))}
        </select>
        {errors.area && <p className={errorClass}>{t(`housing.register.errors.area.${errors.area}`)}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="housing-ward" className="block text-app-sm text-app-text-muted mb-1">
            {t('housing.register.ward')}
          </label>
          <input
            id="housing-ward"
            type="number"
            min={WARD_RANGE.min}
            max={WARD_RANGE.max}
            className={fieldClass}
            value={value.ward}
            onChange={(e) => update('ward', Number(e.target.value))}
          />
          {errors.ward && <p className={errorClass}>{t(`housing.register.errors.ward.${errors.ward}`)}</p>}
        </div>
        <div>
          <label htmlFor="housing-plot" className="block text-app-sm text-app-text-muted mb-1">
            {t('housing.register.plot')}
          </label>
          <input
            id="housing-plot"
            type="number"
            min={PLOT_RANGE.min}
            max={PLOT_RANGE.max}
            className={fieldClass}
            value={value.plot}
            onChange={(e) => update('plot', Number(e.target.value))}
          />
          {errors.plot && <p className={errorClass}>{t(`housing.register.errors.plot.${errors.plot}`)}</p>}
        </div>
      </div>

      <div>
        <label htmlFor="housing-size" className="block text-app-sm text-app-text-muted mb-1">
          {t('housing.register.size')}
        </label>
        <select
          id="housing-size"
          className={fieldClass}
          value={value.size}
          onChange={(e) => {
            const next = e.target.value as HousingSize;
            onChange({
              ...value,
              size: next,
              apartmentRoom: next === 'Apartment' ? value.apartmentRoom : undefined,
            });
          }}
        >
          {HOUSING_SIZES.map((s) => {
            const label = housingSizeMasterData.find((m) => m.id === s)?.label ?? s;
            return <option key={s} value={s}>{label}</option>;
          })}
        </select>
        {errors.size && <p className={errorClass}>{t(`housing.register.errors.size.${errors.size}`)}</p>}
      </div>

      {value.size === 'Apartment' && (
        <div>
          <label htmlFor="housing-room" className="block text-app-sm text-app-text-muted mb-1">
            {t('housing.register.apartment_room')}
          </label>
          <input
            id="housing-room"
            type="number"
            min={APARTMENT_ROOM_RANGE.min}
            max={APARTMENT_ROOM_RANGE.max}
            className={fieldClass}
            value={value.apartmentRoom ?? ''}
            onChange={(e) => update('apartmentRoom', Number(e.target.value))}
          />
          {errors.apartmentRoom && (
            <p className={errorClass}>{t(`housing.register.errors.apartment_room.${errors.apartmentRoom}`)}</p>
          )}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingRegisterAddressFields.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/register/HousingRegisterAddressFields.tsx src/__tests__/housing/HousingRegisterAddressFields.test.tsx
git commit -m "feat(housing): add address fields component (DC/server/area/ward/plot/size)"
```

---

## Task 15: タグピッカー (`HousingRegisterTagPicker.tsx`)

**Files:**
- Create: `src/components/housing/register/HousingRegisterTagPicker.tsx`
- Test: `src/__tests__/housing/HousingRegisterTagPicker.test.tsx`

カテゴリごとにグループ化したタグを表示し、5 件まで選択可能にする。選択済みは別エリアに表示、× で削除可。仮 UI のため検索機能は付けない（Sub-spec 2C で改善）。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingRegisterTagPicker.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterTagPicker } from '../../components/housing/register/HousingRegisterTagPicker';

describe('HousingRegisterTagPicker', () => {
  it('全 6 カテゴリ見出しを表示する', () => {
    render(<HousingRegisterTagPicker selected={[]} onChange={() => {}} />);
    expect(screen.getByText(/housing\.register\.tag_category\.taste/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.scene/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.season/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.environment/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.structure/i)).toBeInTheDocument();
    expect(screen.getByText(/housing\.register\.tag_category\.other/i)).toBeInTheDocument();
  });

  it('タグをクリックで onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={[]} onChange={onChange} />);
    await user.click(screen.getAllByRole('button', { name: /housing\.tag\.modern/i })[0]);
    expect(onChange).toHaveBeenCalledWith(['modern']);
  });

  it('5 件選択済みなら未選択タグが disabled になる', () => {
    render(
      <HousingRegisterTagPicker
        selected={['modern', 'cafe', 'wafu', 'spring', 'summer']}
        onChange={() => {}}
      />,
    );
    const winterBtn = screen.getAllByRole('button', { name: /housing\.tag\.winter/i })[0];
    expect(winterBtn).toBeDisabled();
  });

  it('既選択タグは × で削除できる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterTagPicker selected={['modern']} onChange={onChange} />);
    const removeBtn = screen.getByRole('button', { name: /housing\.register\.remove_tag/i });
    await user.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingRegisterTagPicker.test.tsx --run
```

- [ ] **Step 3: `HousingRegisterTagPicker.tsx` を実装**

```tsx
// src/components/housing/register/HousingRegisterTagPicker.tsx
import { useTranslation } from 'react-i18next';
import {
  HOUSING_TAG_CATEGORIES,
  getTagsByCategory,
  type HousingTagCategory,
} from '../../../data/housingTags';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

export const HousingRegisterTagPicker: React.FC<Props> = ({ selected, onChange }) => {
  const { t } = useTranslation();
  const isFull = selected.length >= HOUSING_LIMITS.MAX_TAGS_PER_LISTING;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-4">
      {selected.length > 0 && (
        <div>
          <p className="text-app-sm text-app-text-muted mb-2">
            {t('housing.register.selected_tags')} ({selected.length}/{HOUSING_LIMITS.MAX_TAGS_PER_LISTING})
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 bg-app-text text-app-bg rounded-full px-3 py-1 text-app-sm"
              >
                {t(`housing.tag.${id}`)}
                <button
                  type="button"
                  aria-label={t('housing.register.remove_tag')}
                  onClick={() => toggle(id)}
                  className="ml-1 hover:opacity-70"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {(HOUSING_TAG_CATEGORIES as readonly HousingTagCategory[]).map((cat) => (
        <div key={cat}>
          <p className="text-app-sm text-app-text-muted mb-2">
            {t(`housing.register.tag_category.${cat}`)}
          </p>
          <div className="flex flex-wrap gap-2">
            {getTagsByCategory(cat).map((tag) => {
              const sel = selected.includes(tag.id);
              const disabled = !sel && isFull;
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggle(tag.id)}
                  className={`rounded-full px-3 py-1 text-app-sm border transition-colors ${
                    sel
                      ? 'bg-app-text text-app-bg border-app-text'
                      : disabled
                        ? 'border-app-border text-app-text-muted opacity-40 cursor-not-allowed'
                        : 'border-app-border text-app-text hover:bg-app-surface2'
                  }`}
                >
                  {t(tag.i18nKey)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingRegisterTagPicker.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/register/HousingRegisterTagPicker.tsx src/__tests__/housing/HousingRegisterTagPicker.test.tsx
git commit -m "feat(housing): add tag picker (6 categories, 5-tag limit)"
```

---

## Task 16: 紹介文入力 (`HousingRegisterDescriptionField.tsx`)

**Files:**
- Create: `src/components/housing/register/HousingRegisterDescriptionField.tsx`
- Test: `src/__tests__/housing/HousingRegisterDescriptionField.test.tsx`

200 文字制限の textarea。残り文字数表示付き。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingRegisterDescriptionField.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingRegisterDescriptionField } from '../../components/housing/register/HousingRegisterDescriptionField';

describe('HousingRegisterDescriptionField', () => {
  it('テキスト入力で onChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HousingRegisterDescriptionField value="" onChange={onChange} error={undefined} />);
    await user.type(screen.getByRole('textbox'), 'h');
    expect(onChange).toHaveBeenCalledWith('h');
  });

  it('残り文字数を表示 (200-入力長)', () => {
    render(<HousingRegisterDescriptionField value="あ".repeat(50)} onChange={() => {}} error={undefined} />);
    expect(screen.getByText(/150/)).toBeInTheDocument();
  });

  it('error があればエラー文を表示', () => {
    render(<HousingRegisterDescriptionField value="" onChange={() => {}} error="too_long" />);
    expect(screen.getByText(/housing\.register\.errors\.description\.too_long/i)).toBeInTheDocument();
  });
});
```

> 注: 上記テストの `value="あ".repeat(50)}` はタイポ表記用。subagent は `value={'あ'.repeat(50)}` と JSX 式形で書くこと。

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingRegisterDescriptionField.test.tsx --run
```

- [ ] **Step 3: `HousingRegisterDescriptionField.tsx` を実装**

```tsx
// src/components/housing/register/HousingRegisterDescriptionField.tsx
import { useTranslation } from 'react-i18next';
import { HOUSING_LIMITS } from '../../../constants/housing';

interface Props {
  value: string;
  onChange: (next: string) => void;
  error: string | undefined;
}

export const HousingRegisterDescriptionField: React.FC<Props> = ({ value, onChange, error }) => {
  const { t } = useTranslation();
  const remaining = HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH - value.length;

  return (
    <div>
      <label htmlFor="housing-desc" className="block text-app-sm text-app-text-muted mb-1">
        {t('housing.register.description')}
      </label>
      <textarea
        id="housing-desc"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={HOUSING_LIMITS.MAX_DESCRIPTION_LENGTH + 50}
        className="w-full bg-app-surface2 border border-app-border rounded-md p-2 text-app-md resize-none"
        placeholder={t('housing.register.description_placeholder')}
      />
      <p className={`text-app-sm mt-1 ${remaining < 0 ? 'text-app-red' : 'text-app-text-muted'}`}>
        {remaining}
      </p>
      {error && (
        <p className="text-app-red text-app-sm mt-1">
          {t(`housing.register.errors.description.${error}`)}
        </p>
      )}
    </div>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingRegisterDescriptionField.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/register/HousingRegisterDescriptionField.tsx src/__tests__/housing/HousingRegisterDescriptionField.test.tsx
git commit -m "feat(housing): add description field (200 char limit)"
```

---

## Task 17: 残り登録枠表示 (`HousingQuotaIndicator.tsx`)

**Files:**
- Create: `src/components/housing/register/HousingQuotaIndicator.tsx`

`canRegister` API レスポンスを受けて「残り 4/5」「累計 28 件 (上限なし)」等を表示する純粋表示コンポーネント。テストは登録フォーム統合テスト (Task 19) に含める。

- [ ] **Step 1: 実装**

```tsx
// src/components/housing/register/HousingQuotaIndicator.tsx
import { useTranslation } from 'react-i18next';
import { REGISTRATION_INITIAL_BONUS, REGISTRATION_DAILY_QUOTA } from '../../../constants/housing';
import type { CanRegisterResponse } from '../../../lib/housingApiClient';

interface Props {
  status: CanRegisterResponse | null;
}

export const HousingQuotaIndicator: React.FC<Props> = ({ status }) => {
  const { t } = useTranslation();
  if (!status) return null;

  const onBonus = status.registrationCount < REGISTRATION_INITIAL_BONUS;
  if (onBonus) {
    return (
      <p className="text-app-sm text-app-text-muted">
        {t('housing.register.quota.bonus_phase', {
          count: status.registrationCount,
          bonus: REGISTRATION_INITIAL_BONUS,
        })}
      </p>
    );
  }
  return (
    <p className="text-app-sm text-app-text-muted">
      {t('housing.register.quota.daily_remaining', {
        remaining: status.remaining,
        max: REGISTRATION_DAILY_QUOTA,
      })}
    </p>
  );
};
```

- [ ] **Step 2: コミット**

```bash
git add src/components/housing/register/HousingQuotaIndicator.tsx
git commit -m "feat(housing): add quota indicator (bonus phase / daily remaining)"
```

---

## Task 18: 重複登録警告ダイアログ (`HousingDuplicateWarningDialog.tsx`)

**Files:**
- Create: `src/components/housing/HousingDuplicateWarningDialog.tsx`
- Test: `src/__tests__/housing/HousingDuplicateWarningDialog.test.tsx`

設計書 §6.5 のハイブリッド警告ダイアログ。既存登録のサマリ + 「住所を訂正する」「私のも登録する」の 2 ボタン。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingDuplicateWarningDialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HousingDuplicateWarningDialog } from '../../components/housing/HousingDuplicateWarningDialog';

const dup = [{ id: 'l1', ownerUid: 'u1', createdAt: Date.now() - 86400000, tags: ['modern', 'cafe'] }];

describe('HousingDuplicateWarningDialog', () => {
  it('既存登録の件数を表示する', () => {
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={() => {}} onClose={() => {}} />);
    expect(screen.getByText(/housing\.duplicate\.title/i)).toBeInTheDocument();
  });
  it('「住所を訂正する」で onCorrect 呼ばれる', async () => {
    const user = userEvent.setup();
    const onCorrect = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={onCorrect} onProceed={() => {}} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /housing\.duplicate\.correct/i }));
    expect(onCorrect).toHaveBeenCalled();
  });
  it('「私のも登録する」で onProceed 呼ばれる', async () => {
    const user = userEvent.setup();
    const onProceed = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={onProceed} onClose={() => {}} />);
    await user.click(screen.getByRole('button', { name: /housing\.duplicate\.proceed/i }));
    expect(onProceed).toHaveBeenCalled();
  });
  it('Esc で onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HousingDuplicateWarningDialog duplicates={dup} onCorrect={() => {}} onProceed={() => {}} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingDuplicateWarningDialog.test.tsx --run
```

- [ ] **Step 3: 実装**

```tsx
// src/components/housing/HousingDuplicateWarningDialog.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { DuplicateEntry } from '../../lib/housingApiClient';

interface Props {
  duplicates: DuplicateEntry[];
  onCorrect: () => void;
  onProceed: () => void;
  onClose: () => void;
}

export const HousingDuplicateWarningDialog: React.FC<Props> = ({ duplicates, onCorrect, onProceed, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-surface border border-app-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-app-2xl font-bold mb-4">{t('housing.duplicate.title')}</h2>
        <p className="text-app-md text-app-text-muted mb-4">
          {t('housing.duplicate.lead', { count: duplicates.length })}
        </p>
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {duplicates.map((d) => (
            <div key={d.id} className="bg-app-surface2 border border-app-border rounded p-3">
              <p className="text-app-sm">
                {t('housing.duplicate.created_at', {
                  date: new Date(d.createdAt).toLocaleDateString(),
                })}
              </p>
              <p className="text-app-sm text-app-text-muted">
                {d.tags.slice(0, 3).map((tag) => t(`housing.tag.${tag}`)).join(' / ')}
              </p>
            </div>
          ))}
        </div>
        <p className="text-app-sm text-app-text-muted mb-4">{t('housing.duplicate.hint')}</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCorrect}
            className="px-4 py-2 rounded-md bg-app-blue text-white hover:bg-app-blue-hover text-app-md"
          >
            {t('housing.duplicate.correct')}
          </button>
          <button
            type="button"
            onClick={onProceed}
            className="px-4 py-2 rounded-md border border-app-border text-app-text hover:bg-app-surface2 text-app-md"
          >
            {t('housing.duplicate.proceed')}
          </button>
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingDuplicateWarningDialog.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/HousingDuplicateWarningDialog.tsx src/__tests__/housing/HousingDuplicateWarningDialog.test.tsx
git commit -m "feat(housing): add duplicate warning dialog (correct/proceed actions)"
```

---

## Task 19: 登録フォーム本体 (`HousingRegisterView.tsx`)

**Files:**
- Create: `src/components/housing/register/HousingRegisterView.tsx`
- Test: `src/__tests__/housing/HousingRegisterView.test.tsx`

Task 14-18 の部品を組み合わせ、登録フローを完結させる:

1. マウント時に `canRegister()` を呼んで quota 状態取得
2. ユーザー入力中はクライアント側で `validateRegistrationDraft` を即時検証
3. 「登録する」押下時:
   a. クライアント検証で fail → エラー表示してフォームに戻る
   b. `checkDuplicate()` で同住所検索 → 1 件以上ならダイアログ表示
   c. ダイアログで「私のも登録する」or 重複なし → `registerListing()` 実行
   d. 成功 → トースト or 完了メッセージ + フォームリセット + canRegister 再取得
   e. 失敗 (quota_exhausted) → エラー表示

- [ ] **Step 1: テスト先行 (主要シナリオ 3 つ)**

```typescript
// src/__tests__/housing/HousingRegisterView.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../lib/housingApiClient', () => ({
  canRegister: vi.fn(),
  registerListing: vi.fn(),
  checkDuplicate: vi.fn(),
  QuotaExhaustedError: class extends Error {},
}));

import { HousingRegisterView } from '../../components/housing/register/HousingRegisterView';
import * as api from '../../lib/housingApiClient';

beforeEach(() => {
  vi.mocked(api.canRegister).mockReset();
  vi.mocked(api.registerListing).mockReset();
  vi.mocked(api.checkDuplicate).mockReset();
});

describe('HousingRegisterView', () => {
  it('マウント時に canRegister を呼ぶ', async () => {
    vi.mocked(api.canRegister).mockResolvedValueOnce({
      allowed: true, reason: null, registrationCount: 0, remaining: 5, lastReset: 0,
    });
    render(<HousingRegisterView />);
    await waitFor(() => expect(api.canRegister).toHaveBeenCalled());
  });

  it('正規入力 + 重複なしで registerListing が呼ばれる', async () => {
    const user = userEvent.setup();
    vi.mocked(api.canRegister).mockResolvedValue({
      allowed: true, reason: null, registrationCount: 0, remaining: 5, lastReset: 0,
    });
    vi.mocked(api.checkDuplicate).mockResolvedValue({ duplicates: [] });
    vi.mocked(api.registerListing).mockResolvedValue({ id: 'l1', addressKey: 'k' });

    render(<HousingRegisterView />);
    await waitFor(() => expect(api.canRegister).toHaveBeenCalled());

    await user.selectOptions(screen.getByLabelText(/housing\.register\.dc/i), 'Mana');
    await waitFor(() => screen.getByLabelText(/housing\.register\.server/i));
    await user.selectOptions(screen.getByLabelText(/housing\.register\.server/i), 'Pandaemonium');
    await user.selectOptions(screen.getByLabelText(/housing\.register\.area/i), 'Shirogane');
    await user.clear(screen.getByLabelText(/housing\.register\.ward/i));
    await user.type(screen.getByLabelText(/housing\.register\.ward/i), '3');
    await user.clear(screen.getByLabelText(/housing\.register\.plot/i));
    await user.type(screen.getByLabelText(/housing\.register\.plot/i), '12');
    await user.click(screen.getAllByRole('button', { name: /housing\.tag\.modern/i })[0]);
    await user.click(screen.getByRole('button', { name: /housing\.register\.submit/i }));

    await waitFor(() => expect(api.registerListing).toHaveBeenCalled());
  });

  it('quota_exhausted のときフォーム送信ボタンが無効化される', async () => {
    vi.mocked(api.canRegister).mockResolvedValueOnce({
      allowed: false, reason: 'quota_exhausted', registrationCount: 31, remaining: 0, lastReset: 0,
    });
    render(<HousingRegisterView />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /housing\.register\.submit/i });
      expect(btn).toBeDisabled();
    });
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingRegisterView.test.tsx --run
```

- [ ] **Step 3: `HousingRegisterView.tsx` を実装**

```tsx
// src/components/housing/register/HousingRegisterView.tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { auth } from '../../../lib/firebase';
import {
  canRegister,
  registerListing,
  checkDuplicate,
  QuotaExhaustedError,
  type CanRegisterResponse,
  type DuplicateEntry,
} from '../../../lib/housingApiClient';
import {
  validateRegistrationDraft,
  type RegistrationDraft,
  type ValidationErrors,
} from '../../../utils/housingValidation';
import { HousingRegisterAddressFields } from './HousingRegisterAddressFields';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingQuotaIndicator } from './HousingQuotaIndicator';
import { HousingDuplicateWarningDialog } from '../HousingDuplicateWarningDialog';
import { HousingLoginPrompt } from '../HousingLoginPrompt';

const EMPTY_DRAFT: RegistrationDraft = {
  dc: '', server: '', area: '' as never,
  ward: 1, plot: 1, size: 'M',
  tags: [],
  description: '',
};

export const HousingRegisterView: React.FC = () => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<RegistrationDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [quotaStatus, setQuotaStatus] = useState<CanRegisterResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateEntry[] | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isLoggedIn = auth.currentUser !== null;

  useEffect(() => {
    if (!isLoggedIn) return;
    canRegister().then(setQuotaStatus).catch(() => setQuotaStatus(null));
  }, [isLoggedIn]);

  if (!isLoggedIn) return <HousingLoginPrompt context="register" />;

  const canSubmit = quotaStatus?.allowed === true && !submitting;

  const performRegister = async (currentDraft: RegistrationDraft) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const result = await registerListing(currentDraft);
      setSuccessMessage(t('housing.register.success', { id: result.id }));
      setDraft(EMPTY_DRAFT);
      const next = await canRegister();
      setQuotaStatus(next);
    } catch (e) {
      if (e instanceof QuotaExhaustedError) {
        setServerError(t('housing.register.errors.quota_exhausted'));
      } else {
        setServerError(t('housing.register.errors.generic'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = validateRegistrationDraft(draft);
    setErrors(result.errors);
    if (!result.ok) return;
    if (!quotaStatus?.allowed) return;

    setSubmitting(true);
    try {
      const dup = await checkDuplicate(draft);
      setSubmitting(false);
      if (dup.duplicates.length > 0) {
        setDuplicates(dup.duplicates);
        return;
      }
      await performRegister(draft);
    } catch {
      setSubmitting(false);
      setServerError(t('housing.register.errors.generic'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-app-3xl font-bold">{t('housing.register.title')}</h2>

      <HousingQuotaIndicator status={quotaStatus} />

      {successMessage && (
        <div className="bg-app-blue-dim border border-app-blue-border rounded-md p-3 text-app-md">
          {successMessage}
        </div>
      )}
      {serverError && (
        <div className="bg-app-red-dim border border-app-red-border rounded-md p-3 text-app-md text-app-red">
          {serverError}
        </div>
      )}

      <HousingRegisterAddressFields
        value={draft}
        onChange={(addr) => setDraft({ ...draft, ...addr })}
        errors={errors}
      />

      <div>
        <p className="text-app-md font-medium mb-2">
          {t('housing.register.tags_label')}
        </p>
        <HousingRegisterTagPicker
          selected={draft.tags}
          onChange={(tags) => setDraft({ ...draft, tags })}
        />
        {errors.tags && (
          <p className="text-app-red text-app-sm mt-1">
            {t(`housing.register.errors.tags.${errors.tags}`)}
          </p>
        )}
      </div>

      <HousingRegisterDescriptionField
        value={draft.description ?? ''}
        onChange={(description) => setDraft({ ...draft, description })}
        error={errors.description}
      />

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full bg-app-blue text-white rounded-md py-3 font-semibold disabled:opacity-50"
      >
        {submitting ? t('housing.register.submitting') : t('housing.register.submit')}
      </button>

      {duplicates && (
        <HousingDuplicateWarningDialog
          duplicates={duplicates}
          onCorrect={() => setDuplicates(null)}
          onProceed={async () => {
            setDuplicates(null);
            await performRegister(draft);
          }}
          onClose={() => setDuplicates(null)}
        />
      )}
    </form>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingRegisterView.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/register/HousingRegisterView.tsx src/__tests__/housing/HousingRegisterView.test.tsx
git commit -m "feat(housing): add registration form view (orchestrates address/tags/description/quota/duplicate)"
```

---

## Task 20: 未ログイン時のプロンプト (`HousingLoginPrompt.tsx`)

**Files:**
- Create: `src/components/housing/HousingLoginPrompt.tsx`

未ログイン状態で「登録」タブを開いたときに代わりに表示する。既存の Discord / X ログインフローへ誘導するボタン。Sub-spec 2A では文言だけで、実際のログイン処理は既存 LoPo の認証 UI（`useLoginActions` 等）を流用する。実際のログイン UI 接続が複雑なら本タスクではプレースホルダにし、Task 24 のフォローアップに記録する。

- [ ] **Step 1: 既存のログイン UI 入口を確認**

```bash
grep -rn "loginWithDiscord\|loginWithTwitter\|signInWith" src/ --include="*.ts" --include="*.tsx" | head -10
```
既存のログインボタン実装が見つかればそれと同じパターンを使う。なければ「LoPo 軽減表（/miti）でログインしてから戻ってきてください」という案内 + `/miti` へのリンクで代替。

- [ ] **Step 2: 実装**

```tsx
// src/components/housing/HousingLoginPrompt.tsx
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

interface Props {
  context: 'register' | 'tour' | 'favorite';
}

export const HousingLoginPrompt: React.FC<Props> = ({ context }) => {
  const { t } = useTranslation();
  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <p className="text-app-md text-app-text mb-2">
        {t(`housing.login_prompt.${context}.title`)}
      </p>
      <p className="text-app-sm text-app-text-muted mb-4">
        {t(`housing.login_prompt.${context}.lead`)}
      </p>
      <Link
        to="/miti"
        className="inline-block px-6 py-2 rounded-md bg-app-blue text-white hover:bg-app-blue-hover text-app-md"
      >
        {t('housing.login_prompt.go_to_login')}
      </Link>
    </div>
  );
};
```

- [ ] **Step 3: コミット**

```bash
git add src/components/housing/HousingLoginPrompt.tsx
git commit -m "feat(housing): add login prompt placeholder (links to /miti for now)"
```

---

## Task 21: オンボーディングダイアログ (`HousingOnboardingDialog.tsx`)

**Files:**
- Create: `src/components/housing/HousingOnboardingDialog.tsx`
- Test: `src/__tests__/housing/HousingOnboardingDialog.test.tsx`

設計書 §11.4 の初回オンボーディング。LocalStorage の `housing-onboarding-seen` フラグで 1 回限り表示、「次回から表示しない」チェックなしの単純実装（仮 UI）。Sub-spec 2C で本格 UI に置き換える。

- [ ] **Step 1: テスト先行**

```typescript
// src/__tests__/housing/HousingOnboardingDialog.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  HousingOnboardingDialog,
  hasSeenHousingOnboarding,
  markHousingOnboardingSeen,
} from '../../components/housing/HousingOnboardingDialog';

beforeEach(() => {
  localStorage.clear();
});

describe('hasSeenHousingOnboarding', () => {
  it('未閲覧なら false', () => {
    expect(hasSeenHousingOnboarding()).toBe(false);
  });
  it('mark 後は true', () => {
    markHousingOnboardingSeen();
    expect(hasSeenHousingOnboarding()).toBe(true);
  });
});

describe('HousingOnboardingDialog', () => {
  it('open=true で表示される', () => {
    render(<HousingOnboardingDialog open={true} onClose={() => {}} />);
    expect(screen.getByText(/housing\.onboarding\.title/i)).toBeInTheDocument();
  });
  it('open=false で表示されない', () => {
    render(<HousingOnboardingDialog open={false} onClose={() => {}} />);
    expect(screen.queryByText(/housing\.onboarding\.title/i)).not.toBeInTheDocument();
  });
  it('「はじめる」で onClose が呼ばれる', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<HousingOnboardingDialog open={true} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: /housing\.onboarding\.start/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テスト失敗を確認**

```bash
npm test -- src/__tests__/housing/HousingOnboardingDialog.test.tsx --run
```

- [ ] **Step 3: 実装**

```tsx
// src/components/housing/HousingOnboardingDialog.tsx
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'housing-onboarding-seen';

export function hasSeenHousingOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markHousingOnboardingSeen(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // ignore
  }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HousingOnboardingDialog: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-app-surface border border-app-border rounded-lg max-w-md w-full p-6">
        <h2 className="text-app-3xl font-bold mb-4">{t('housing.onboarding.title')}</h2>
        <p className="text-app-md mb-3">{t('housing.onboarding.lead')}</p>
        <ul className="text-app-md space-y-2 mb-4 list-disc list-inside text-app-text-muted">
          <li>{t('housing.onboarding.bullet1')}</li>
          <li>{t('housing.onboarding.bullet2')}</li>
          <li>{t('housing.onboarding.bullet3')}</li>
        </ul>
        <p className="text-app-sm text-app-text-muted mb-4">
          {t('housing.onboarding.image_modes_note')}
        </p>
        <button
          type="button"
          onClick={() => { markHousingOnboardingSeen(); onClose(); }}
          className="w-full bg-app-blue text-white rounded-md py-2 font-semibold hover:bg-app-blue-hover text-app-md"
        >
          {t('housing.onboarding.start')}
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: テスト緑化**

```bash
npm test -- src/__tests__/housing/HousingOnboardingDialog.test.tsx --run
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/HousingOnboardingDialog.tsx src/__tests__/housing/HousingOnboardingDialog.test.tsx
git commit -m "feat(housing): add onboarding dialog (LocalStorage one-time, placeholder UI)"
```

---

## Task 22: i18n キー追加 (4 言語 × 全カテゴリ)

**Files:**
- Modify: `src/locales/ja.json`
- Modify: `src/locales/en.json`
- Modify: `src/locales/ko.json`
- Modify: `src/locales/zh.json`

以下のキー群を 4 言語すべてに追加。タグ訳は機械翻訳ベース（設計書 §12.4 の指示通り、ko/zh は Phase 1 後にネイティブチェック）。

**追加キー一覧:**
- `housing.tabs.{search,tour,register}`
- `housing.placeholder.{search,tour,register_loading}`
- `housing.register.{title,dc,server,area,ward,plot,size,apartment_room,description,description_placeholder,tags_label,selected_tags,remove_tag,submit,submitting,success}`
- `housing.register.tag_category.{taste,scene,season,environment,structure,other}`
- `housing.register.errors.{dc,server,area,ward,plot,size,apartment_room,tags,description,quota_exhausted,generic}.*`
- `housing.register.quota.{bonus_phase,daily_remaining}`
- `housing.duplicate.{title,lead,hint,correct,proceed,created_at}`
- `housing.onboarding.{title,lead,bullet1,bullet2,bullet3,image_modes_note,start}`
- `housing.login_prompt.{register,tour,favorite}.{title,lead}`
- `housing.login_prompt.go_to_login`
- `housing.tag.<id>` × 約 147 タグ ID

- [ ] **Step 1: ja.json に追加 (全キー)**

`src/locales/ja.json` の `housing` セクションに以下のキーを追加（既存の `housing.coming_soon` は残す）:

```json
{
  "housing": {
    "coming_soon": { /* 既存維持 */ },
    "tabs": {
      "search": "探す",
      "tour": "回る",
      "register": "登録"
    },
    "placeholder": {
      "search": "ギャラリーは Sub-spec 2B で実装予定です",
      "tour": "ツアー機能は Sub-spec 3 で実装予定です",
      "register_loading": "登録フォームを読み込み中..."
    },
    "register": {
      "title": "物件登録",
      "dc": "データセンター",
      "server": "サーバー",
      "area": "エリア",
      "ward": "区",
      "plot": "番地",
      "size": "サイズ",
      "apartment_room": "部屋番号",
      "description": "紹介文 (任意・200文字まで)",
      "description_placeholder": "ここに紹介文を入力",
      "tags_label": "タグ (1〜5 件)",
      "selected_tags": "選択中",
      "remove_tag": "削除",
      "submit": "登録する",
      "submitting": "登録中...",
      "success": "登録しました (ID: {{id}})",
      "tag_category": {
        "taste": "テイスト",
        "scene": "シーン・用途",
        "season": "季節・イベント",
        "environment": "環境・舞台",
        "structure": "構造・特殊",
        "other": "その他"
      },
      "errors": {
        "dc": { "required": "データセンターを選んでください" },
        "server": { "required": "サーバーを選んでください" },
        "area": { "invalid": "正しいエリアを選んでください" },
        "ward": { "out_of_range": "区は 1〜30 で指定してください" },
        "plot": { "out_of_range": "番地は 1〜60 で指定してください" },
        "size": { "invalid": "サイズを選んでください" },
        "apartment_room": {
          "required_for_apartment": "部屋番号 (1〜90) を入力してください",
          "not_allowed_for_size": "このサイズでは部屋番号は不要です"
        },
        "tags": {
          "min_one_required": "タグを 1 つ以上選んでください",
          "max_exceeded": "タグは 5 つまでです",
          "duplicate": "同じタグを 2 度選べません",
          "unknown_tag": "未知のタグが含まれています"
        },
        "description": {
          "too_long": "200 文字以内で入力してください",
          "invalid_type": "テキスト形式で入力してください"
        },
        "quota_exhausted": "本日の登録枠を使い切りました (明日 5 件回復)",
        "generic": "登録に失敗しました。しばらくしてから再試行してください"
      },
      "quota": {
        "bonus_phase": "登録枠: {{count}} / {{bonus}} 件 (上限なし)",
        "daily_remaining": "本日の登録枠: 残り {{remaining}} / {{max}} 件"
      }
    },
    "duplicate": {
      "title": "同じ住所で既に登録があります",
      "lead": "{{count}} 件の既存登録が見つかりました",
      "hint": "住所が間違っていないか、もう一度確認してください",
      "correct": "住所を訂正する",
      "proceed": "私のも登録する",
      "created_at": "登録日: {{date}}"
    },
    "onboarding": {
      "title": "ハウジングツアーへようこそ",
      "lead": "FF14 のハウジングを巡るツアー機能です",
      "bullet1": "みんなが作った素敵な家を巡れます",
      "bullet2": "自分のおすすめツアーも作って共有できます",
      "bullet3": "気に入った物件はお気に入り登録できます",
      "image_modes_note": "現在は機能のみ提供中。デザイン・画像登録は順次拡充します",
      "start": "はじめる"
    },
    "login_prompt": {
      "register": {
        "title": "物件登録にはログインが必要です",
        "lead": "Discord または X (Twitter) でログインしてください"
      },
      "tour": {
        "title": "ツアー作成にはログインが必要です",
        "lead": "ログイン後、お気に入りやツアーをクラウド同期できます"
      },
      "favorite": {
        "title": "お気に入り登録にはログインが必要です",
        "lead": "ログイン後、複数端末でお気に入りを共有できます"
      },
      "go_to_login": "/miti へ移動してログイン"
    },
    "tag": {
      "wafu": "和風", "wamodern": "和モダン", "chinese": "中華風", "korean": "韓国風",
      "western": "洋風", "modern": "モダン", "minimal": "ミニマル", "natural": "ナチュラル",
      "nordic": "北欧", "antique": "アンティーク", "vintage": "ヴィンテージ", "retro": "レトロ",
      "taisho_roman": "大正ロマン", "rustic": "ラスティック", "country": "カントリー",
      "cottagecore": "コテージコア", "gothic": "ゴシック", "dark_academia": "ダークアカデミア",
      "industrial": "インダストリアル", "steampunk": "スチームパンク", "cyberpunk": "サイバーパンク",
      "scifi": "SF・未来", "fantasy": "ファンタジー", "marchen": "メルヘン", "bohemian": "ボヘミアン",
      "luxury": "高級・ラグジュアリー", "chic": "シック", "elegant": "エレガント", "romantic": "ロマンチック",
      "cute": "かわいい", "pop": "ポップ", "monochrome": "モノクローム", "dark": "ダーク",
      "light": "ライト", "flashy": "派手", "calm": "落ち着いた", "simple": "シンプル",
      "warm": "暖かい", "cool": "涼やか", "mystical": "幻想的", "ruins": "廃墟", "horror": "ホラー",
      "witch": "魔女", "alchemist": "錬金術師", "sage_mage": "賢者・魔導師",
      "residence": "住宅・個人宅", "apartment_room": "アパルトメント", "bedroom": "寝室",
      "living_room": "リビング", "dining_room": "ダイニング", "kitchen": "キッチン",
      "bath": "浴室・風呂", "study": "書斎", "childrens_room": "子供部屋",
      "walkin_closet": "ウォークインクローゼット", "cafe": "カフェ", "coffee_shop": "喫茶店",
      "jun_kissa": "純喫茶", "bar": "バー", "izakaya": "居酒屋", "tavern": "酒場",
      "nightclub": "クラブ", "host_club": "ホストクラブ", "restaurant": "レストラン",
      "diner": "食堂", "ramen_shop": "ラーメン屋", "food_stall": "屋台", "tea_room": "茶室",
      "bakery": "ベーカリー", "shop": "ショップ", "boutique": "ブティック",
      "flower_shop": "花屋", "bookstore": "本屋", "library": "図書館",
      "gallery": "美術館・ギャラリー", "atelier": "アトリエ", "workshop": "工房",
      "photo_studio": "撮影スタジオ", "temple": "神殿", "shrine": "神社", "church": "教会",
      "school": "学校", "hospital": "病院", "inn": "旅館", "hotel": "ホテル",
      "spring": "春", "summer": "夏", "autumn": "秋", "winter": "冬",
      "cherry_blossom": "桜", "autumn_leaves": "紅葉", "snow": "雪", "beach": "海・ビーチ",
      "tanabata": "七夕 (Tanabata)", "halloween": "ハロウィン", "christmas": "クリスマス",
      "valentine": "バレンタイン", "new_year": "正月", "hinamatsuri": "ひな祭り (Hinamatsuri)",
      "easter": "イースター", "summer_festival": "夏祭り", "starlight": "星芒祭",
      "guardian_day": "守護天節", "matsuri": "縁日・祭り (Matsuri)", "illumination": "イルミネーション",
      "forest": "森", "desert": "砂漠", "snowland": "雪国", "tropical": "熱帯・南国",
      "mediterranean": "地中海・リゾート", "grassland": "草原", "mountain": "山岳",
      "cave": "洞窟", "underwater": "海中・水中", "space": "宇宙",
      "floating_island": "空中・浮島", "otherworld": "異世界",
      "rooftop": "屋上", "basement": "地下", "garden": "庭", "terrace": "テラス",
      "courtyard": "中庭", "multilevel": "高低差", "multifloor": "多層", "atrium": "吹き抜け",
      "loft": "ロフト", "attic": "屋根裏", "gimmick": "ギミック", "hidden_room": "隠し部屋",
      "warp_room": "ワープ", "floating_furniture": "浮かせ家具", "photogenic": "撮影向き",
      "ghibli_style": "ジブリ風", "pirate": "海賊", "medieval": "中世", "castle": "城・宮殿",
      "haunted_mansion": "廃墟洋館", "yukaku": "遊郭風", "ryugujo": "竜宮城",
      "treehouse": "ツリーハウス", "camp": "キャンプ", "abandoned_factory": "廃工場",
      "lab": "研究室", "prison": "監獄", "funeral": "葬祭場", "casino": "カジノ", "theater": "劇場"
    }
  }
}
```

- [ ] **Step 2: en.json / ko.json / zh.json に同構造で追加**

各 i18n キーに対応する英訳/韓訳/中訳を追加する。タグの英訳は付録 A の英語表記をベースに、housing.register / housing.duplicate / housing.onboarding / housing.login_prompt 系は標準的な英訳を作成。韓訳・中訳は機械翻訳ベース（DeepL 推奨）で生成し、設計書 §12.4 の通り Phase 1 リリース後にネイティブチェックを行う。

実装ノート:
- 4 言語ファイルの housing セクションが構造的に揃っていること (キー欠落ゼロ) を tsc + 後段の lint で検証
- 既存の `housing.coming_soon` は壊さない

- [ ] **Step 3: 構造一貫性チェック (簡易)**

```bash
node -e "
const ja = require('./src/locales/ja.json');
const en = require('./src/locales/en.json');
const ko = require('./src/locales/ko.json');
const zh = require('./src/locales/zh.json');
function flat(o, prefix='') { return Object.entries(o).flatMap(([k,v]) => typeof v==='object' && v!==null ? flat(v, prefix+k+'.') : [prefix+k]); }
const jaKeys = new Set(flat(ja.housing).map(k => 'housing.'+k));
for (const [name, obj] of [['en', en], ['ko', ko], ['zh', zh]]) {
  const otherKeys = new Set(flat(obj.housing).map(k => 'housing.'+k));
  const missing = [...jaKeys].filter(k => !otherKeys.has(k));
  if (missing.length > 0) console.error(name+' missing:', missing.slice(0,10));
  else console.log(name+' OK');
}
"
```
期待: en/ko/zh とも OK

- [ ] **Step 4: build 確認**

```bash
npm run build
```
期待: エラーなし

- [ ] **Step 5: コミット**

```bash
git add src/locales/ja.json src/locales/en.json src/locales/ko.json src/locales/zh.json
git commit -m "feat(housing): add i18n keys for registration form (4 languages, ~200 keys + ~147 tag labels)"
```

---

## Task 23: HousingPage に登録フォーム + オンボーディング統合

**Files:**
- Modify: `src/components/housing/HousingPage.tsx`
- Modify: `src/components/housing/index.ts`

Task 13 で作ったタブ骨格に、登録タブで `HousingRegisterView` を表示、初回訪問時に `HousingOnboardingDialog` を表示するロジックを追加。

- [ ] **Step 1: `HousingPage.tsx` を更新**

```tsx
// src/components/housing/HousingPage.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCanonicalUrl } from '../../hooks/useCanonicalUrl';
import { HOUSING_ROUTES } from '../../constants/housing';
import { HousingTabBar, type HousingTab } from './HousingTabBar';
import { HousingPlaceholderView } from './HousingPlaceholderView';
import { HousingRegisterView } from './register/HousingRegisterView';
import { HousingOnboardingDialog, hasSeenHousingOnboarding } from './HousingOnboardingDialog';

function readTabFromHash(): HousingTab {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'search' || hash === 'tour' || hash === 'register') return hash;
  return 'search';
}

export const HousingPage: React.FC = () => {
  useCanonicalUrl(HOUSING_ROUTES.TOP);
  const { t } = useTranslation();
  const [tab, setTab] = useState<HousingTab>(readTabFromHash);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenHousingOnboarding());

  useEffect(() => { document.title = t('app.page_title_housing'); }, [t]);

  useEffect(() => {
    const onHashChange = () => setTab(readTabFromHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const handleTabChange = (next: HousingTab) => {
    window.location.hash = next;
    setTab(next);
  };

  return (
    <main
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--color-app-bg)', color: 'var(--color-app-text)' }}
    >
      <HousingTabBar activeTab={tab} onChange={handleTabChange} />
      <div className="flex-1">
        {tab === 'search' && <HousingPlaceholderView i18nKey="housing.placeholder.search" />}
        {tab === 'tour' && <HousingPlaceholderView i18nKey="housing.placeholder.tour" />}
        {tab === 'register' && <HousingRegisterView />}
      </div>
      <HousingOnboardingDialog
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </main>
  );
};
```

- [ ] **Step 2: `index.ts` 確認 (Task 13 で更新済のはず)**

```bash
grep "HousingPage\|HousingOnboardingDialog\|HousingRegisterView\|HousingDuplicateWarningDialog\|HousingLoginPrompt\|HousingQuotaIndicator" src/components/housing/index.ts
```

不足があれば追記:

```typescript
export { HousingOnboardingDialog, hasSeenHousingOnboarding } from './HousingOnboardingDialog';
export { HousingDuplicateWarningDialog } from './HousingDuplicateWarningDialog';
export { HousingLoginPrompt } from './HousingLoginPrompt';
export { HousingRegisterView } from './register/HousingRegisterView';
```

- [ ] **Step 3: `App.tsx` のルート差し替え**

```tsx
// src/App.tsx の import 文
import {
  HousingComingSoonPage,        // 残しておく (一時 fallback 用)
  HousingDetailPagePlaceholder,
  HousingTourPagePlaceholder,
  HousingPage,                   // 追加
} from './components/housing';

// Routes 内、/housing 行を差し替え:
<Route path="/housing" element={<HousingPage />} />
```

- [ ] **Step 4: build + tsc 確認**

```bash
npm run build
npx tsc --noEmit
```

- [ ] **Step 5: コミット**

```bash
git add src/components/housing/HousingPage.tsx src/components/housing/index.ts src/App.tsx
git commit -m "feat(housing): wire up register tab and onboarding dialog to /housing"
```

---

## Task 24: 最終 build + 全テスト実行 + tsc clean 確認

**Files:**
- 新規ファイルなし（検証のみ）

設計書 §15 のテスト計画 + 既存 359 tests 含めた全数を確認。Sub-spec 2A で約 50-70 件追加されている想定（タグマスタ 7 + バリデーション 18 + クォータ 8 + 重複キー 5 + APIクライアント 4 + TabBar 3 + AddressFields 4 + TagPicker 4 + DescField 3 + DuplicateDialog 4 + OnboardingDialog 5 + RegisterView 3 ＝ 約 68）。

- [ ] **Step 1: 全テスト実行**

```bash
npm test -- --run
```
期待: 既存 359 + 新規 約 68 = 約 427 tests pass、failures ゼロ

- [ ] **Step 2: tsc 厳密モードで型エラーチェック**

```bash
npx tsc --noEmit
```
期待: エラーゼロ。`feedback_vercel_tsc_strict.md` メモリ参照（Vercel は tsc 厳密、未使用変数・型不足を必ず検出）。

- [ ] **Step 3: production build**

```bash
npm run build
```
期待: ビルド成功、警告は既存と同等（新たな大きな警告が出たら止まって調査）

- [ ] **Step 4: lint (Biome)**

```bash
npx biome check src/components/housing src/lib/housing*.ts src/utils/housing*.ts src/data/housingTags.ts api/housing
```
期待: ファイルレベルでエラーなし

- [ ] **Step 5: 結果確認のみ、コミットは Task 25 とまとめる**

---

## Task 25: ローカル動作確認 (Playwright 自動 + 手動 1 件)

**Files:**
- なし（検証のみ）

設計書 §15.3 の E2E 観点で最低限の自動チェック + 1 件は実機ログイン経由で手動確認。

- [ ] **Step 1: dev サーバ起動**

```bash
npm run dev &
# ポートが立つまで待つ
until netstat -an 2>/dev/null | grep -q "5173.*LISTEN"; do sleep 1; done
echo "dev ready"
```

- [ ] **Step 2: Playwright スクリプト作成**

```javascript
// /tmp/playwright-test-housing-register.js
const TARGET_URL = 'http://localhost:5173';

const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext();
const page = await ctx.newPage();

// 1) /housing で 3 タブが表示される
await page.goto(`${TARGET_URL}/housing`, { waitUntil: 'domcontentloaded' });
await page.locator('[role=tab]').first().waitFor();
const tabCount = await page.locator('[role=tab]').count();
console.log('tabs visible:', tabCount, '(expect 3)');

// 2) 登録タブで未ログイン → ログインプロンプト表示
await page.locator('[role=tab]').nth(2).click();
const loginPrompt = await page.locator('a[href="/miti"]').count();
console.log('login prompt link:', loginPrompt, '(expect >=1)');

// 3) オンボーディング初回表示
const onboarding = await page.getByText(/ハウジングツアーへようこそ|housing\.onboarding\.title/i).count();
console.log('onboarding visible:', onboarding, '(expect >=1 if first visit)');

// 4) オンボーディング閉じて再訪 → 出ない
await page.evaluate(() => localStorage.setItem('housing-onboarding-seen', '1'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('[role=tab]').first().waitFor();
const onboarding2 = await page.getByText(/ハウジングツアーへようこそ/i).count();
console.log('onboarding after seen flag:', onboarding2, '(expect 0)');

await browser.close();
```

- [ ] **Step 3: Playwright 実行**

```bash
cd "C:\Users\masay\.claude\plugins\cache\playwright-skill\playwright-skill\4.1.0\skills\playwright-skill" && node run.js /tmp/playwright-test-housing-register.js
```
期待: 全項目が「expect」と一致

- [ ] **Step 4: 手動チェック (ユーザー操作が必要なログイン → 登録 1 件)**

ユーザーに以下を依頼:
1. ブラウザで `http://localhost:5173/miti` を開いて Discord か X でログイン
2. `http://localhost:5173/housing#register` に遷移
3. 表示される `HousingRegisterView` で適当な住所を入力 (DC=Mana / Server=Pandaemonium / Area=Shirogane / Ward=3 / Plot=12 / Size=M)
4. タグを 1〜2 個選択
5. 「登録する」を押す
6. 成功メッセージが出れば OK

確認したいこと:
- バリデーションエラーが正しく出るか (例: ward に 31 入れる)
- 残り枠表示が更新されるか
- 同じ住所で 2 回目 → 重複ダイアログが出るか

- [ ] **Step 5: dev サーバ停止**

```bash
taskkill //F //IM node.exe //FI "MEMUSAGE gt 100000" 2>/dev/null || true
```

- [ ] **Step 6: コミット (修正があれば、なければスキップ)**

不具合修正が出た場合のみコミット。なければ Task 26 で TODO.md だけ更新。

---

## Task 26: TODO.md 更新 + push + デプロイ

**Files:**
- Modify: `docs/TODO.md`
- Modify: `docs/TODO_COMPLETED.md` (該当エントリ移動)

設計書 §18 Sub-spec 2 の進行を記録、main ブランチに push してデプロイまで。

- [ ] **Step 1: `docs/TODO.md` の「現在の状態」セクションを更新**

最新セッション記録を追加（雛形）:

```markdown
- **最新セッション（2026-05-08・ハウジングツアー Sub-spec 2A 実装）**: Registration & Gallery のうち「登録 (画像なしモード)」を完成。タグマスタ約 147 件 4 言語、バリデーション・登録枠 D 案・重複住所キー の純粋関数群、`/api/housing` 3 アクション (can-register / register-listing / check-duplicate)、登録フォーム本体 + 重複警告ダイアログ + オンボーディングダイアログ + ログインプロンプト、`/housing` ページのタブ切替（探す/回る/登録）まで実装。Sub-spec 2A スコープ完了。デザインは仮置き（Tailwind プリミティブのみ）、リキッドグラスやルーペエフェクトは Sub-spec 2C で本格適用予定。約 427 tests PASS、tsc clean、build 成功、Firestore rules `addressKey` 検証追加デプロイ済み。次は Sub-spec 2B (Gallery & Search)。
```

- [ ] **Step 2: 「次にやること」セクションを更新**

```markdown
### 次にやること（優先順）
- **ハウジングツアー Sub-spec 2B (Gallery & Search) 実装**: 登録済みデータをギャラリー表示・検索フィルタ・URL クエリ反映まで。画像はまだ「画像なし」プレースホルダで OK。リキッドグラスやルーペは Sub-spec 2C 以降で適用。
- **ハウジングツアー Sub-spec 2C (Image 3-modes & Liquid Effects)**: SNS URL OGP 取得 / サムネアップロード Cloud Function / 画像 3 択 UI / リキッドグラス + ルーペエフェクト最終仕上げ
- ... (既存項目維持)
```

- [ ] **Step 3: `docs/TODO_COMPLETED.md` に Sub-spec 2A 完了を記録**

```markdown
### Sub-spec 2A: Registration (画像なしモード) 完了 2026-05-08
- [x] タグマスタ 147 件 × 4 言語 i18n
- [x] フォーム入力検証 (純粋関数)
- [x] 登録枠 D 案ロジック (純粋関数)
- [x] 同住所キー生成 (純粋関数)
- [x] HousingListing.addressKey フィールド追加
- [x] /api/housing?action=can-register|register-listing|check-duplicate 実装
- [x] 登録フォーム本体 + 重複警告ダイアログ + オンボーディングダイアログ
- [x] /housing ページに 3 タブ (探す / 回る / 登録) 切替
- [x] Firestore rules で addressKey 検証追加デプロイ
```

- [ ] **Step 4: コミット**

```bash
git add docs/TODO.md docs/TODO_COMPLETED.md
git commit -m "docs(todo): record Sub-spec 2A completion"
```

- [ ] **Step 5: push**

```bash
git push origin main
```

- [ ] **Step 6: Vercel デプロイ確認**

push 後 1-2 分で Vercel が自動デプロイ。`https://lopoly.app/housing#register` を開いて以下を確認:
1. 3 タブ表示
2. 未ログインで `/miti` へのリンク
3. オンボーディングが初回のみ
4. (ログインして) 登録が通って Firestore に保存される

- [ ] **Step 7: 引き継ぎメッセージ作成**

ユーザーに次セッションへの引き継ぎを出力:

```
【セッション完了 2026-05-08・ハウジング Sub-spec 2A 完成】

## 完成
- /housing ページに 3 タブ (探す/回る/登録) 切替
- 登録フォーム (画像なしモード) + 重複検出 + 登録枠 D 案
- タグマスタ 147 件 × 4 言語
- /api/housing 3 アクション
- 約 427 tests PASS、本番デプロイ済み

## 次セッション最優先
Sub-spec 2B (Gallery & Search) のプラン作成
- 登録したデータをギャラリーで表示
- 検索フィルタ (タグ / DC / エリア / サイズ)
- URL クエリ反映
- お気に入り
- 画像はまだ「画像なし」プレースホルダで OK

## 必読
- docs/TODO.md
- docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md (§7 / §11 を中心に)
- docs/superpowers/plans/2026-05-08-housing-sub-spec-2a-registration.md (完了済プラン参考)
```

---

## Self-Review

このプランを書き終えたあと、設計書 §6 / §11.4 / §11.5 / §12 / §13 と照らし合わせて以下を確認済み:

**Spec 網羅性チェック (§6 / §11 / §12):**

- ✅ §6.1 登録フォーム構成 → Task 14-19 で全フィールド実装
- ✅ §6.2 画像 3 択 → 本プランでは `imageMode='none'` 固定 (Sub-spec 2C で SNS/サムネ追加、スコープ外を明示)
- ✅ §6.3 SNS URL 自動補完 → Sub-spec 2C スコープと明示
- ✅ §6.4 登録枠 D 案 → Task 3 (純粋関数) + Task 8/9 (API)
- ✅ §6.5 重複登録ハンドリング → Task 4 (キー生成) + Task 10 (API) + Task 18 (ダイアログ)
- ✅ §11.4 オンボーディング → Task 21
- ✅ §11.5 Progressive Disclosure → Sub-spec 2C スコープと明示 (URL 入力欄が無いので本プランでは不要)
- ✅ §12 タグマスター → Task 1 (構造) + Task 22 (4 言語訳)

**Spec 範囲外として明示済み (Sub-spec 2A スコープ外):**

- 🚀 §7 ギャラリー / 検索 → Sub-spec 2B
- 🚀 §11.3 リキッドグラス + ルーペ → Sub-spec 2C 以降
- 🚀 §11.2 グラスモーフィズム背景 → Sub-spec 2C 以降 (現状は単色)
- 🚀 §8 ツアー / §9 削除依頼 → Sub-spec 3

**Placeholders スキャン:** TBD / TODO / fill-in-details / 「適切なエラー処理を追加」のような空文言なし。すべて具体コードまたは具体的な参照先 (設計書 § 番号 / 既存ファイルパス) で記述済み。

**型一貫性:**

- `RegistrationDraft` (housingValidation.ts) を Task 9 / 11 / 19 で同じ構造で使用
- `AddressInput` を Task 10 / 11 / 14 で共通利用
- `HousingTab` 型を Task 13 で定義し Task 23 で再利用
- `CanRegisterResponse` / `DuplicateEntry` を housingApiClient で定義し RegisterView で利用

**潜在リスク:**

1. **Task 20 のログインプロンプト**: 既存ログイン UI が複雑な場合、`/miti` への誘導で代替する想定。実装時に既存パターンが見つかれば直接置き換える。
2. **Task 22 の i18n**: 約 200+ キー × 4 言語 = 約 800 翻訳の追加。subagent でも工数大きく、機械翻訳ベースの初版で進める前提。Phase 1 リリース後にネイティブチェック (設計書 §12.4 準拠)。
3. **Vercel API 認証フロー**: Foundation で書いた `housing_user_meta` rules `write: false` のままでは Admin SDK 経由しか書けないため、Task 8/9 の Vercel API 経由パスが必須。クライアント直書きの誘惑があっても rules を緩めない。

---

**Plan complete.** 26 タスク、想定工数 3-5 日。

**実行方法選択:**

1. **Subagent-Driven (推奨)** — タスクごとに新規 subagent を派遣、間で 2 段階レビュー、高速イテレーション
2. **Inline Execution** — このセッションで `executing-plans` を使ってバッチ実行、チェックポイントでレビュー

どちらで進めますか？


