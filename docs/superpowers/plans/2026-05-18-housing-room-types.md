# ハウジング 個室・アパート対応 (Schema 確定) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** HousingListing スキーマを個室・アパート対応に置換し、 整合性制約 + 重複判定 + Firestore Rules を完成させる。 UI 実装 (登録モーダル / ギャラリー / 通報 UI 分離 / 異議申し立て) は本 plan の **scope 外** (Sub-spec 2B 系で別 plan)。

**Architecture:** 既存パターン踏襲 — TypeScript 型定義 + type guard 関数 + 純粋 validation 関数 + Firestore Rules の 4 層で整合性を担保。 zod 等の新規 dependency は追加しない。 既存 `addressKey` 仕組み (server 生成 / クライアント書き換え不可) を維持しつつ、 新スキーマで key 構造を再定義。

**前提:** 既存 `housing_listings` コレクションには本番データなし (placeholder 段階)。 マイグレーション不要、 全面置換可。

**Tech Stack:** TypeScript, Firestore Rules, vitest, 既存 housing 系既存パターン (zod 不使用)

**親仕様:** [`docs/superpowers/specs/2026-05-18-housing-room-types-design.md`](../specs/2026-05-18-housing-room-types-design.md)

---

## ファイル構造マップ

| ファイル | 役割 | 操作 |
|---|---|---|
| `src/constants/housing.ts` | 範囲定数 (WARD / PLOT / ROOM 等) | Modify |
| `src/types/housing.ts` | TypeScript 型定義 + type guard | Modify (HousingListing 全面置換) |
| `src/utils/housingDuplicate.ts` | `buildAddressKey` 関数 | Modify (key 構造刷新) |
| `src/utils/housingDuplicate.test.ts` | 上記テスト | **Create** |
| `src/utils/housingValidation.ts` | `validateAddress` / `validateRegistrationDraft` | Modify (整合性制約) |
| `src/utils/housingValidation.test.ts` | 上記テスト | **Create** |
| `src/lib/housingListingsService.ts` | Firestore 読取り (関連登録特定) | Modify (新クエリ 3 つ追加) |
| `src/lib/housingListingsService.test.ts` | 上記テスト | **Create** |
| `api/housing/_registerListingHandler.ts` | 登録 API | Modify (新フィールド対応) |
| `api/housing/_checkDuplicateHandler.ts` | 重複チェック API | Modify (新フィールド対応) |
| `firestore.rules` | Firestore Security Rules | Modify (整合性制約反映) |

---

## Task 1: 定数の更新

**Files:**
- Modify: `src/constants/housing.ts`

- [ ] **Step 1: PLOT_RANGE を 1-30 に修正 + 新規定数追加**

`src/constants/housing.ts` の `PLOT_RANGE` を `{ min: 1, max: 30 }` に変更 (subdivision 別 30 区画ずつのため)。 新規定数を追加:

```ts
export const WARD_RANGE = { min: 1, max: 30 } as const;
export const PLOT_RANGE = { min: 1, max: 30 } as const;                // 30 → 60 から訂正 (subdivision 別)
export const APARTMENT_ROOM_RANGE = { min: 1, max: 90 } as const;
export const PRIVATE_CHAMBER_RANGE = { min: 1, max: 512 } as const;    // NEW (FC 個室、 公式上限)
```

- [ ] **Step 2: 既存 import 影響確認**

```bash
rtk grep "PLOT_RANGE" src/
```

PLOT_RANGE を使っているのは `src/utils/housingValidation.ts` のみ (Task 3 で更新)。 OK。

- [ ] **Step 3: tsc で型エラーなしを確認**

```bash
npx tsc --noEmit
```

Expected: PASS (定数追加のみ、 型エラーなし)

- [ ] **Step 4: Commit**

```bash
rtk git add src/constants/housing.ts
rtk git commit -m "feat(housing): 個室・アパ対応で範囲定数追加 (PRIVATE_CHAMBER_RANGE) + PLOT_RANGE を 30 に訂正"
```

---

## Task 2: 型定義の置換 (`src/types/housing.ts`)

**Files:**
- Modify: `src/types/housing.ts`

- [ ] **Step 1: 新規 enum と type 追加**

`src/types/housing.ts` の `HOUSING_SIZES` 行の **直後** に以下を追加:

```ts
// ─────────────────────────────────────────────
// 個室・アパート対応 (spec 2026-05-18 §3.1)
// ─────────────────────────────────────────────

export const BUILDING_TYPES = ['house', 'apartment'] as const;
export type BuildingType = typeof BUILDING_TYPES[number];

export const OWNER_TYPES = ['personal', 'fc'] as const;
export type OwnerType = typeof OWNER_TYPES[number];

export const ROOM_KINDS = ['private_chamber', 'apartment_room'] as const;
export type RoomKind = typeof ROOM_KINDS[number];

export const SUBDIVISIONS = ['main', 'sub'] as const;
export type Subdivision = typeof SUBDIVISIONS[number];

export function isValidBuildingType(value: string): value is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(value);
}
export function isValidOwnerType(value: string): value is OwnerType {
  return (OWNER_TYPES as readonly string[]).includes(value);
}
export function isValidRoomKind(value: string): value is RoomKind {
  return (ROOM_KINDS as readonly string[]).includes(value);
}
export function isValidSubdivision(value: string): value is Subdivision {
  return (SUBDIVISIONS as readonly string[]).includes(value);
}
```

- [ ] **Step 2: `HOUSING_SIZES` から不要値を除去**

```ts
// Before
export const HOUSING_SIZES = ['S', 'M', 'L', 'Apartment', 'PrivateRoom'] as const;

// After
export const HOUSING_SIZES = ['S', 'M', 'L'] as const;
```

- [ ] **Step 3: HousingListing interface を spec §3.1 に置換**

`HousingListing` interface 全体を置換:

```ts
export interface HousingListing {
  id: string;
  ownerUid: string;

  // 物理ワールド
  dc: string;
  server: string;

  // エリア + ワード
  area: HousingArea;
  ward: number;                   // 1-30
  subdivision: Subdivision;       // 'main' | 'sub'

  // 建物タイプ (NEW)
  buildingType: BuildingType;     // 'house' | 'apartment'

  // === house の場合 (必須) ===
  ownerType?: OwnerType;          // 'personal' | 'fc'
  plot?: number;                  // 1-30
  size?: HousingSize;             // 'S' | 'M' | 'L'

  // === 部屋区分 (NEW) ===
  roomKind?: RoomKind;            // undefined / 'private_chamber' / 'apartment_room'
  roomNumber?: number;            // 1-512 (chamber) / 1-90 (apt)

  // 同住所検索用 denormalized key (server 生成)
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

- [ ] **Step 4: tsc で既存 import の影響を確認**

```bash
npx tsc --noEmit
```

Expected: いくつかのファイルで型エラー発生 (Task 3-6 で順次対応)。 エラー箇所をメモして後続タスクの確認材料にする。

- [ ] **Step 5: Commit**

```bash
rtk git add src/types/housing.ts
rtk git commit -m "feat(housing): HousingListing 型を個室・アパ対応に置換 (spec 2026-05-18 §3.1)"
```

---

## Task 3: `buildAddressKey` の更新 (TDD)

**Files:**
- Modify: `src/utils/housingDuplicate.ts`
- Create: `src/utils/housingDuplicate.test.ts`

新キー構造 (spec §3.3):
- 個人宅 / FC ハウス全体: `${dc}|${server}|${area}|W${ward}|S${subdivision}|H${plot}`
- FC 個室: `...|H${plot}|C${roomNumber}`
- アパート部屋: `${dc}|${server}|${area}|W${ward}|S${subdivision}|A${roomNumber}`

**注**: `ownerType` (personal/fc) は key に含めない。 同 plot は plot 属性 (個人/FC) が確定済みのため、 key に含めると重複検知が失敗する (例: 同じ plot を間違って FC として登録 → 別 key 扱いで重複検知漏れ)。

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/housingDuplicate.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from './housingDuplicate';
import type { AddressInput } from './housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward' | 'subdivision'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
  subdivision: 'main',
};

describe('buildAddressKey', () => {
  it('個人宅 (家全体) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12');
  });

  it('FC ハウス (家全体) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12');
  });

  it('FC 個室のキーを生成 (親 plot + 個室番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|H12|C5');
  });

  it('アパート部屋のキーを生成 (plot なし、 アパ番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Smain|A42');
  });

  it('subdivision の sub は S sub になる', () => {
    const addr: AddressInput = {
      ...baseAddr,
      subdivision: 'sub',
      buildingType: 'house',
      ownerType: 'personal',
      plot: 1,
      size: 'S',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|Ssub|H1');
  });

  it('個人宅 と FC ハウス全体は同 plot なら同キー (ownerType は key 不参加)', () => {
    const personal: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 12, size: 'M' };
    const fc: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    expect(buildAddressKey(personal)).toBe(buildAddressKey(fc));
  });
});

describe('isSameAddress', () => {
  it('完全一致なら true', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    expect(isSameAddress(a, b)).toBe(true);
  });

  it('plot 違いなら false', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 13, size: 'M' };
    expect(isSameAddress(a, b)).toBe(false);
  });

  it('家全体 vs 個室は別アドレス (ソフト重複)', () => {
    const house: AddressInput = { ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'M' };
    const chamber: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(isSameAddress(house, chamber)).toBe(false);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
rtk vitest run src/utils/housingDuplicate.test.ts
```

Expected: FAIL (`AddressInput` に `subdivision` / `buildingType` 等の field がないため)

- [ ] **Step 3: `AddressInput` 型を Task 4 用に先取り更新**

`src/utils/housingValidation.ts` の `AddressInput` interface を更新 (Task 4 で本実装するが、 型シグネチャだけ先に):

```ts
export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;
  subdivision: Subdivision | string;        // NEW

  buildingType: BuildingType | string;       // NEW

  // house の場合
  ownerType?: OwnerType | string;
  plot?: number;
  size?: HousingSize | string;

  // 部屋区分
  roomKind?: RoomKind | string;
  roomNumber?: number;
}
```

合わせて import を更新:

```ts
import {
  isValidHousingArea,
  isValidHousingSize,
  isValidBuildingType,
  isValidOwnerType,
  isValidRoomKind,
  isValidSubdivision,
  type HousingArea,
  type HousingSize,
  type BuildingType,
  type OwnerType,
  type RoomKind,
  type Subdivision,
} from '../types/housing.js';
```

- [ ] **Step 4: `buildAddressKey` 本実装**

`src/utils/housingDuplicate.ts` を全面置換:

```ts
/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 docs/superpowers/specs/2026-05-18-housing-room-types-design.md §3.3 準拠。
 *
 * - 個人宅 / FC 全体: `${dc}|${server}|${area}|W${ward}|S${sub}|H${plot}`
 * - FC 個室:        `...|H${plot}|C${roomNumber}`
 * - アパート部屋:    `...|S${sub}|A${roomNumber}`
 *
 * `ownerType` (personal/fc) は key に含めない。 同 plot は属性確定なので、
 * 含めると重複検知が失敗する (e.g. FC を個人として誤登録 → 別 key 扱い)。
 */
import type { AddressInput } from './housingValidation.js';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}|S${addr.subdivision}`;

  if (addr.buildingType === 'house') {
    if (addr.roomKind === 'private_chamber') {
      return `${base}|H${addr.plot}|C${addr.roomNumber}`;
    }
    return `${base}|H${addr.plot}`;
  }

  if (addr.buildingType === 'apartment') {
    return `${base}|A${addr.roomNumber}`;
  }

  throw new Error(`Invalid buildingType: ${String(addr.buildingType)}`);
}

export function isSameAddress(a: AddressInput, b: AddressInput): boolean {
  return buildAddressKey(a) === buildAddressKey(b);
}
```

- [ ] **Step 5: テストが通ることを確認**

```bash
rtk vitest run src/utils/housingDuplicate.test.ts
```

Expected: PASS (全 8 ケース)

- [ ] **Step 6: Commit**

```bash
rtk git add src/utils/housingDuplicate.ts src/utils/housingDuplicate.test.ts src/utils/housingValidation.ts
rtk git commit -m "feat(housing): buildAddressKey を新スキーマ対応 (subdivision/buildingType/roomKind 対応) + TDD"
```

---

## Task 4: `housingValidation` の更新 (TDD)

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Create: `src/utils/housingValidation.test.ts`

整合性制約 (spec §3.2) を validation に反映:

| # | パターン | buildingType | ownerType | roomKind | plot | size | roomNumber |
|---|---|---|---|---|---|---|---|
| 1 | 個人宅 | `house` | `personal` | `undefined` | 必須 | 必須 | — |
| 2 | FC 全体 | `house` | `fc` | `undefined` | 必須 | 必須 | — |
| 3 | FC 個室 | `house` | `fc` | `private_chamber` | 必須 | 必須 | 1-512 |
| 4 | アパ部屋 | `apartment` | — | `apartment_room` | — | — | 1-90 |

- [ ] **Step 1: 失敗するテストを書く**

`src/utils/housingValidation.test.ts` を新規作成:

```ts
import { describe, it, expect } from 'vitest';
import { validateAddress, type AddressInput } from './housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward' | 'subdivision'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
  subdivision: 'main',
};

describe('validateAddress: 4 パターン正常系', () => {
  it('個人宅', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 12, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('FC ハウス全体', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'fc', plot: 12, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    });
    expect(r.ok).toBe(true);
  });
});

describe('validateAddress: 不正組合せ reject', () => {
  it('個人宅に個室は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomKind).toBeDefined();
  });

  it('アパートに plot は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      plot: 12,
      roomKind: 'apartment_room',
      roomNumber: 42,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('house なのに ownerType 未指定は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.ownerType).toBeDefined();
  });

  it('FC 個室の roomNumber 範囲外は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 513,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('アパ部屋 roomNumber 範囲外は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 91,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('plot 範囲外 (31) は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', ownerType: 'personal', plot: 31, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('subdivision 不正は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      subdivision: 'invalid',
      buildingType: 'house',
      ownerType: 'personal',
      plot: 12,
      size: 'M',
    });
    expect(r.ok).toBe(false);
    expect(r.errors.subdivision).toBeDefined();
  });

  it('FC 個室で size 未指定は不可 (親 plot のサイズが必要)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      ownerType: 'fc',
      plot: 12,
      roomKind: 'private_chamber',
      roomNumber: 5,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
rtk vitest run src/utils/housingValidation.test.ts
```

Expected: FAIL (現 `validateAddress` は新 schema 知らず)

- [ ] **Step 3: `validateAddress` を全面置換**

`src/utils/housingValidation.ts` の `validateAddress` 関数を以下に置換:

```ts
export function validateAddress(addr: AddressInput): ValidationResult {
  const errors: ValidationErrors = {};

  // 必須共通
  if (!addr.dc || addr.dc.trim() === '') errors.dc = 'required';
  if (!addr.server || addr.server.trim() === '') errors.server = 'required';
  if (!addr.area || !isValidHousingArea(String(addr.area))) errors.area = 'invalid';
  if (!Number.isInteger(addr.ward) || addr.ward < WARD_RANGE.min || addr.ward > WARD_RANGE.max) {
    errors.ward = 'out_of_range';
  }
  if (!addr.subdivision || !isValidSubdivision(String(addr.subdivision))) {
    errors.subdivision = 'invalid';
  }
  if (!addr.buildingType || !isValidBuildingType(String(addr.buildingType))) {
    errors.buildingType = 'invalid';
  }

  // buildingType 別の制約
  if (addr.buildingType === 'house') {
    // ownerType 必須
    if (!addr.ownerType || !isValidOwnerType(String(addr.ownerType))) {
      errors.ownerType = 'required_for_house';
    }
    // plot 必須 + 範囲
    if (!Number.isInteger(addr.plot) || (addr.plot as number) < PLOT_RANGE.min || (addr.plot as number) > PLOT_RANGE.max) {
      errors.plot = 'out_of_range';
    }
    // size 必須
    if (!addr.size || !isValidHousingSize(String(addr.size))) {
      errors.size = 'invalid';
    }

    // 部屋区分
    if (addr.roomKind === 'private_chamber') {
      // FC ハウス限定
      if (addr.ownerType !== 'fc') {
        errors.roomKind = 'private_chamber_requires_fc';
      }
      // roomNumber 必須 + 範囲
      if (!Number.isInteger(addr.roomNumber)
          || (addr.roomNumber as number) < PRIVATE_CHAMBER_RANGE.min
          || (addr.roomNumber as number) > PRIVATE_CHAMBER_RANGE.max) {
        errors.roomNumber = 'out_of_range';
      }
    } else if (addr.roomKind !== undefined) {
      errors.roomKind = 'invalid_for_house';
    }
  } else if (addr.buildingType === 'apartment') {
    // plot / size / ownerType 不可
    if (addr.plot !== undefined) errors.plot = 'not_allowed_for_apartment';
    if (addr.size !== undefined) errors.size = 'not_allowed_for_apartment';
    if (addr.ownerType !== undefined) errors.ownerType = 'not_allowed_for_apartment';

    // roomKind は 'apartment_room' 必須
    if (addr.roomKind !== 'apartment_room') {
      errors.roomKind = 'apartment_room_required';
    }
    // roomNumber 必須 + 範囲
    if (!Number.isInteger(addr.roomNumber)
        || (addr.roomNumber as number) < APARTMENT_ROOM_RANGE.min
        || (addr.roomNumber as number) > APARTMENT_ROOM_RANGE.max) {
      errors.roomNumber = 'out_of_range';
    }
  }

  return Object.keys(errors).length > 0 ? fail(errors) : ok();
}
```

合わせて import を更新:

```ts
import {
  WARD_RANGE,
  PLOT_RANGE,
  APARTMENT_ROOM_RANGE,
  PRIVATE_CHAMBER_RANGE,
  HOUSING_LIMITS,
} from '../constants/housing.js';
```

- [ ] **Step 4: テストが通ることを確認**

```bash
rtk vitest run src/utils/housingValidation.test.ts
```

Expected: PASS (全 13 ケース)

- [ ] **Step 5: 既存テスト全体を実行して回帰確認**

```bash
rtk vitest run
```

Expected: 既存 housing 系以外は変化なし PASS。 housing 系は他に test なし。 全 PASS であること確認。

- [ ] **Step 6: Commit**

```bash
rtk git add src/utils/housingValidation.ts src/utils/housingValidation.test.ts
rtk git commit -m "feat(housing): validateAddress を整合性制約付きで全面置換 + TDD"
```

---

## Task 5: server-side handler の更新

**Files:**
- Modify: `api/housing/_registerListingHandler.ts`
- Modify: `api/housing/_checkDuplicateHandler.ts`

handlers はすでに `validateRegistrationDraft` / `validateAddress` + `buildAddressKey` を呼んでいる。 新 schema のフィールドを Firestore document として保存するように修正のみ。

- [ ] **Step 1: `_registerListingHandler.ts` の listing 構築箇所を更新**

`api/housing/_registerListingHandler.ts` line 76-93 の `listing` オブジェクト構築を以下に置換:

```ts
const newRef = listingsCol.doc();

const listing = {
  ownerUid: uid,
  dc: draft.dc,
  server: draft.server,
  area: draft.area,
  ward: draft.ward,
  subdivision: draft.subdivision,
  buildingType: draft.buildingType,
  ...(draft.buildingType === 'house' ? {
    ownerType: draft.ownerType,
    plot: draft.plot,
    size: draft.size,
  } : {}),
  ...(draft.roomKind ? {
    roomKind: draft.roomKind,
    roomNumber: draft.roomNumber,
  } : {}),
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
```

- [ ] **Step 2: `_checkDuplicateHandler.ts` の確認**

`api/housing/_checkDuplicateHandler.ts` は `validateAddress` + `buildAddressKey` + Firestore where 句で動いている。 新 schema の `AddressInput` が来れば自動で動作するため、 **コード変更不要**。

ただし line 38 `req.body as AddressInput` の型キャストが新 `AddressInput` 型を見るので、 tsc が通ることだけ確認。

- [ ] **Step 3: tsc で型エラーなしを確認**

```bash
npx tsc --noEmit
```

Expected: PASS (handler は新 type 経由で型解決される)

- [ ] **Step 4: Commit**

```bash
rtk git add api/housing/_registerListingHandler.ts
rtk git commit -m "feat(housing): register-listing handler を新 schema (subdivision/roomKind 等) で保存"
```

---

## Task 6: Firestore Rules の更新

**Files:**
- Modify: `firestore.rules`

整合性制約 (spec §3.2) を rules に反映:

- [ ] **Step 1: helper 関数の追加**

`firestore.rules` line 195 (`ハウジング: helper 関数` セクション) 内の既存 helper を活用しつつ、 新規 helper を追加:

```
function isValidSubdivision(sub) {
  return sub in ['main', 'sub'];
}
function isValidBuildingType(t) {
  return t in ['house', 'apartment'];
}
function isValidOwnerType(t) {
  return t in ['personal', 'fc'];
}
function isValidRoomKind(k) {
  return k in ['private_chamber', 'apartment_room'];
}
function isValidPrivateChamberNumber(n) {
  return n is int && n >= 1 && n <= 512;
}
```

`isValidHousingSize` を `'S' | 'M' | 'L'` 限定に縮める:

```
function isValidHousingSize(size) {
  return size in ['S', 'M', 'L'];
}
```

`isValidPlot` を 1-30 に縮める:

```
function isValidPlot(plot) {
  return plot is int && plot >= 1 && plot <= 30;
}
```

- [ ] **Step 2: `housing_listings` の create rule を整合性制約付きで置換**

`firestore.rules` の `match /housing_listings/{listingId}` 内 `allow create` を以下に置換:

```
allow create: if isAuthenticated()
              && request.auth.uid == request.resource.data.ownerUid
              && request.resource.data.dc is string
              && request.resource.data.server is string
              && isValidHousingArea(request.resource.data.area)
              && isValidWard(request.resource.data.ward)
              && isValidSubdivision(request.resource.data.subdivision)
              && isValidBuildingType(request.resource.data.buildingType)
              && isValidImageMode(request.resource.data.imageMode)
              && isValidTags(request.resource.data.tags)
              && (!('description' in request.resource.data) || isValidDescription(request.resource.data.description))
              && request.resource.data.addressKey is string
              && request.resource.data.addressKey.size() <= 200
              && request.resource.data.reportCount == 0
              && request.resource.data.isHidden == false
              // === buildingType 別の制約 ===
              && (
                // house パターン
                (
                  request.resource.data.buildingType == 'house'
                  && isValidOwnerType(request.resource.data.ownerType)
                  && isValidPlot(request.resource.data.plot)
                  && isValidHousingSize(request.resource.data.size)
                  && (
                    // 家全体: roomKind / roomNumber なし
                    !('roomKind' in request.resource.data)
                    || (
                      // FC 個室: ownerType=fc 必須、 roomNumber 1-512
                      request.resource.data.roomKind == 'private_chamber'
                      && request.resource.data.ownerType == 'fc'
                      && isValidPrivateChamberNumber(request.resource.data.roomNumber)
                    )
                  )
                )
                ||
                // apartment パターン: plot/size/ownerType なし、 roomKind='apartment_room' 必須、 roomNumber 1-90
                (
                  request.resource.data.buildingType == 'apartment'
                  && !('plot' in request.resource.data)
                  && !('size' in request.resource.data)
                  && !('ownerType' in request.resource.data)
                  && request.resource.data.roomKind == 'apartment_room'
                  && isValidApartmentRoom(request.resource.data.roomNumber)
                )
              );
```

- [ ] **Step 3: `allow update` も同様に整合性制約付きで置換**

`allow update` を以下に置換 (`ownerUid` / `addressKey` / `reportCount` / `isHidden` 不変、 + create と同じ buildingType 別制約):

```
allow update: if isOwner(resource.data.ownerUid)
              && request.resource.data.ownerUid == resource.data.ownerUid
              && request.resource.data.addressKey == resource.data.addressKey
              && request.resource.data.reportCount == resource.data.reportCount
              && request.resource.data.isHidden == resource.data.isHidden
              && isValidHousingArea(request.resource.data.area)
              && isValidWard(request.resource.data.ward)
              && isValidSubdivision(request.resource.data.subdivision)
              && isValidBuildingType(request.resource.data.buildingType)
              && isValidImageMode(request.resource.data.imageMode)
              && isValidTags(request.resource.data.tags)
              && (!('description' in request.resource.data) || isValidDescription(request.resource.data.description))
              && (
                (
                  request.resource.data.buildingType == 'house'
                  && isValidOwnerType(request.resource.data.ownerType)
                  && isValidPlot(request.resource.data.plot)
                  && isValidHousingSize(request.resource.data.size)
                  && (
                    !('roomKind' in request.resource.data)
                    || (
                      request.resource.data.roomKind == 'private_chamber'
                      && request.resource.data.ownerType == 'fc'
                      && isValidPrivateChamberNumber(request.resource.data.roomNumber)
                    )
                  )
                )
                ||
                (
                  request.resource.data.buildingType == 'apartment'
                  && !('plot' in request.resource.data)
                  && !('size' in request.resource.data)
                  && !('ownerType' in request.resource.data)
                  && request.resource.data.roomKind == 'apartment_room'
                  && isValidApartmentRoom(request.resource.data.roomNumber)
                )
              );
```

- [ ] **Step 4: 構文チェック**

ローカルに firestore emulator がある場合:

```bash
firebase emulators:start --only firestore
```

エミュレータ起動時に rules の構文エラーが出ないことを確認。 エミュレータがない場合は CI / 本番デプロイ時にチェックされるのでスキップ可。

- [ ] **Step 5: Commit**

```bash
rtk git add firestore.rules
rtk git commit -m "feat(housing): firestore.rules に整合性制約反映 (個人宅/FC全体/FC個室/アパ の 4 パターン)"
```

---

## Task 7: client サービス層に関連登録特定クエリを追加 (TDD)

**Files:**
- Modify: `src/lib/housingListingsService.ts`
- Create: `src/lib/housingListingsService.test.ts`

spec §4.2 の関連登録特定ロジックをクエリ関数として実装。 詳細ページの実装で使う想定。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/housingListingsService.test.ts` を新規作成 (Firebase は mock):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findChambersInPlot,
  findHouseForChamber,
  findApartmentRoomsInWard,
} from './housingListingsService';

vi.mock('./firebase', () => ({ db: {} }));

const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn((...args) => args),
  where: vi.fn((field, op, value) => ({ field, op, value })),
  limit: vi.fn((n) => ({ limit: n })),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
}));

const baseQuery = {
  area: 'Shirogane' as const,
  ward: 3,
  subdivision: 'main' as const,
};

beforeEach(() => {
  mockGetDocs.mockReset();
});

describe('findChambersInPlot', () => {
  it('指定 plot の FC 個室を返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'a', data: () => ({ roomKind: 'private_chamber', plot: 12, roomNumber: 2 }) },
        { id: 'b', data: () => ({ roomKind: 'private_chamber', plot: 12, roomNumber: 5 }) },
      ],
    });
    const r = await findChambersInPlot({ ...baseQuery, plot: 12 });
    expect(r.map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('findHouseForChamber', () => {
  it('指定 plot の FC ハウス全体を返す (個室除く)', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'house', data: () => ({ roomKind: undefined, ownerType: 'fc', plot: 12 }) },
      ],
    });
    const r = await findHouseForChamber({ ...baseQuery, plot: 12 });
    expect(r?.id).toBe('house');
  });

  it('親家全体が未登録なら null', async () => {
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    const r = await findHouseForChamber({ ...baseQuery, plot: 12 });
    expect(r).toBeNull();
  });
});

describe('findApartmentRoomsInWard', () => {
  it('同 ward のアパ部屋を currentRoom 除いて返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'r7', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 7 }) },
        { id: 'r50', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 50 }) },
        { id: 'r42', data: () => ({ buildingType: 'apartment', roomKind: 'apartment_room', roomNumber: 42 }) },
      ],
    });
    const r = await findApartmentRoomsInWard({ ...baseQuery, currentRoomNumber: 42 });
    expect(r.map((x) => x.roomNumber)).toEqual([7, 50]);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
rtk vitest run src/lib/housingListingsService.test.ts
```

Expected: FAIL (関数未定義)

- [ ] **Step 3: 関数を実装**

`src/lib/housingListingsService.ts` に以下を追加:

```ts
import type { HousingArea, Subdivision } from '../types/housing';

interface ChamberQuery {
  area: HousingArea;
  ward: number;
  subdivision: Subdivision;
  plot: number;
}

interface ApartmentQuery {
  area: HousingArea;
  ward: number;
  subdivision: Subdivision;
  currentRoomNumber: number;
}

/** §4.2: 指定 plot の FC 個室一覧 (家全体ページで使う) */
export async function findChambersInPlot(q: ChamberQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('subdivision', '==', q.subdivision),
    where('plot', '==', q.plot),
    where('roomKind', '==', 'private_chamber'),
    where('isHidden', '==', false),
    limit(50),
  );
  const snap = await getDocs(qref);
  return snap.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<HousingListing, 'id'>),
  }));
}

/** §4.2: 指定 plot の FC ハウス全体登録 (個室ページで使う、 親家)。 未登録なら null */
export async function findHouseForChamber(q: ChamberQuery): Promise<HousingListing | null> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('subdivision', '==', q.subdivision),
    where('plot', '==', q.plot),
    where('ownerType', '==', 'fc'),
    where('isHidden', '==', false),
    limit(5),
  );
  const snap = await getDocs(qref);
  // roomKind=undefined (= 家全体) のみフィルタ
  const houseDocs = snap.docs.filter((d) => d.data().roomKind === undefined);
  if (houseDocs.length === 0) return null;
  const doc = houseDocs[0];
  return { id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) };
}

/** §4.2: 同 ward のアパート他部屋一覧 (アパ部屋ページで使う、 現在の部屋を除く) */
export async function findApartmentRoomsInWard(q: ApartmentQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    where('subdivision', '==', q.subdivision),
    where('buildingType', '==', 'apartment'),
    where('isHidden', '==', false),
    limit(20),
  );
  const snap = await getDocs(qref);
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<HousingListing, 'id'>) }))
    .filter((l) => l.roomNumber !== q.currentRoomNumber);
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
rtk vitest run src/lib/housingListingsService.test.ts
```

Expected: PASS (全 4 ケース)

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/housingListingsService.ts src/lib/housingListingsService.test.ts
rtk git commit -m "feat(housing): 関連登録特定クエリ追加 (findChambersInPlot / findHouseForChamber / findApartmentRoomsInWard) + TDD"
```

---

## Task 8: 統合確認

**Files:** (検証のみ、 修正は発生したファイルに対応)

- [ ] **Step 1: tsc 全体**

```bash
npx tsc --noEmit
```

Expected: PASS (0 errors)。 エラーあれば、 既存 `apartmentRoom`/`size === 'Apartment'`/`size === 'PrivateRoom'` 等の旧 API を使っている箇所を修正:

- `src/components/housing/HousingDuplicateWarningDialog.tsx`: `DuplicateEntry` props は変えていないので影響なし (Task 9 で UI 更新時に対応)
- `src/components/housing/register/HousingRegisterView.tsx` / `HousingRegisterAddressFields.tsx`: 既存 UI が旧 schema を参照していたら **暫定** で動作させる修正のみ。 本格対応は Sub-spec 2B 系の別 plan で

エラー出たファイル一覧を Step 2 で確認。

- [ ] **Step 2: 旧 schema 参照箇所を grep**

```bash
rtk grep "apartmentRoom\|'Apartment'\|'PrivateRoom'" src/
```

ヒットしたファイルを 1 つずつ確認:
- types/housing.ts: 既に置換済み
- utils/housingValidation.ts: 既に置換済み
- 他に残っていれば、 暫定 stub で型を通すか、 別 plan に積む

- [ ] **Step 3: vitest 全体**

```bash
rtk vitest run
```

Expected: PASS (全テスト)。 既存テストが落ちる場合、 housing 系以外なら回帰として確認、 housing 系なら scope 内のテスト修正。

- [ ] **Step 4: build (本番ビルド確認)**

```bash
rtk npm run build
```

Expected: PASS (Vercel デプロイで通る確認)

- [ ] **Step 5: Commit (必要があれば)**

統合確認で修正が出たら commit。 出なければスキップ。

```bash
rtk git add <修正ファイル>
rtk git commit -m "fix(housing): 旧 schema 参照箇所の整理 (個室・アパ対応 follow-up)"
```

---

## 完了条件

- [ ] Task 1-7 すべて Step 完了
- [ ] tsc clean
- [ ] vitest 全 PASS (新規 3 テストファイル含む)
- [ ] build 成功
- [ ] Phase 1 設計書 (2026-05-07) の改訂は **本 plan の scope 外** (別 plan か手作業で対応)
- [ ] UI 実装 (登録モーダル 4 タイプ選択 / ギャラリー詳細 / 通報 UI 分離 / 異議申し立て) は **本 plan の scope 外** (Sub-spec 2B 系の別 plan)

---

## 次の plan (別管理)

1. **Phase 1 設計書改訂** — `2026-05-07-housing-tour-phase1-design.md` の §4.2/§4.3/§6.1/§6.5/§7/§9.3 を本 spec で更新
2. **登録モーダル 4 タイプ選択** — Sub-spec 2B 系 plan で実装
3. **ギャラリー詳細ページ 関連登録表示** — Sub-spec 2B 系 plan で実装
4. **通報 UI 分離 + 家主異議申し立て** — Phase 1 既存通報フローの UI 改修 plan として独立
