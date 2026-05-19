# ハウジング Schema 訂正 (subdivision/ownerType 削除 + plot 1-60) 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 前セッション (2026-05-18) で確定した HousingListing schema には公式仕様調査誤りが含まれていた (subdivision フィールド不要、 plot 範囲 1-60 が正解)。 さらに ownerType (個人/FC 区別) もユーザー目線で意味なしと判明。 これら 2 つのフィールド削除 + plot 範囲訂正を forward fix で適用。

**Architecture:** 既存 4 層 (型 / validation / addressKey / Firestore Rules) を維持しつつ、 2 フィールド削除 + 整合性制約を 4 パターン → 3 パターンに簡素化。 マイグレーション不要 (本番データなし、 placeholder 段階)。 全面置換で進める。

**Tech Stack:** TypeScript, Firestore Rules, vitest, 既存 housing 系既存パターン (zod 不使用)

**親仕様:** [`docs/superpowers/specs/2026-05-18-housing-room-types-design.md`](../specs/2026-05-18-housing-room-types-design.md) (2026-05-19 訂正版)

**前提:** 本 plan の前に `docs/superpowers/plans/2026-05-18-housing-room-types.md` (前版 schema) が実装済み。 本 plan はその訂正。 既存 housing_listings に本番データなし、 placeholder 段階。

---

## ファイル構造マップ

| ファイル | 役割 | 操作 |
|---|---|---|
| `src/constants/housing.ts` | 範囲定数 (PLOT_RANGE 等) | Modify (plot 1-60) |
| `src/types/housing.ts` | TypeScript 型定義 + type guard | Modify (subdivision/ownerType enum + isValid* 削除、 HousingListing から 2 フィールド削除) |
| `src/utils/housingDuplicate.ts` | `buildAddressKey` 関数 | Modify (key から S${subdivision} 削除) |
| `src/utils/housingDuplicate.test.ts` | 上記テスト | Modify (ケース書き直し) |
| `src/utils/housingValidation.ts` | `validateAddress` | Modify (subdivision/ownerType 検証削除、 整合性制約 3 パターン) |
| `src/utils/housingValidation.test.ts` | 上記テスト | Modify (ケース書き直し) |
| `src/lib/housingListingsService.ts` | Firestore 読取り (関連登録特定) | Modify (subdivision クエリ削除) |
| `src/lib/housingListingsService.test.ts` | 上記テスト | Modify |
| `api/housing/_registerListingHandler.ts` | 登録 API | Modify (subdivision/ownerType 保存削除) |
| `api/housing/_checkDuplicateHandler.ts` | 重複チェック API | (型キャストのみ、 コード変更なし想定) |
| `firestore.rules` | Firestore Security Rules | Modify (helper 関数削除、 整合性制約 3 パターン) |
| `src/components/housing/register/HousingRegisterView.tsx` | 登録 View 暫定 | Modify (EMPTY_DRAFT から 2 フィールド削除) |
| `src/__tests__/housing/HousingRegisterAddressFields.test.tsx` | 既存テスト | Modify (subdivision/ownerType 削除、 plot 範囲) |
| `src/__tests__/housing/HousingRegisterView.test.tsx` | 既存テスト | (型エラー出れば修正) |

---

## Task 1: 定数 PLOT_RANGE の訂正

**Files:**
- Modify: `src/constants/housing.ts`

- [ ] **Step 1: PLOT_RANGE を 1-60 に変更**

`src/constants/housing.ts` の `PLOT_RANGE` を変更:

```ts
export const PLOT_RANGE = { min: 1, max: 60 } as const;     // 本街 1-30 + 拡張街 31-60 通し番号
```

コメントも訂正済みのものに置換 (前版の「30 → 60 から訂正」 を削除して新しい説明に)。

- [ ] **Step 2: tsc 確認**

```bash
npx tsc --noEmit
```

Expected: PASS (定数値変更のみ、 型エラーなし)

- [ ] **Step 3: Commit**

```bash
rtk git add src/constants/housing.ts
rtk git commit -m "fix(housing): PLOT_RANGE を 1-60 通し番号に訂正 (拡張街 plot 31-60、 spec 2026-05-19 公式再調査)"
```

---

## Task 2: 型定義から subdivision / ownerType を削除

**Files:**
- Modify: `src/types/housing.ts`

- [ ] **Step 1: enum と type guard を削除**

`src/types/housing.ts` から以下を削除:

```ts
// 削除対象 (既存ブロック全体):
export const OWNER_TYPES = ['personal', 'fc'] as const;
export type OwnerType = typeof OWNER_TYPES[number];

export const SUBDIVISIONS = ['main', 'sub'] as const;
export type Subdivision = typeof SUBDIVISIONS[number];

// 削除対象 (type guard):
export function isValidOwnerType(value: string): value is OwnerType { ... }
export function isValidSubdivision(value: string): value is Subdivision { ... }
```

新規追加なし。 `BUILDING_TYPES`, `ROOM_KINDS` 系は保持。

- [ ] **Step 2: HousingListing interface から 2 フィールド削除**

```ts
export interface HousingListing {
  id: string;
  ownerUid: string;

  dc: string;
  server: string;

  area: HousingArea;
  ward: number;                   // 1-30
  // subdivision: 削除 (plot 番号で本街/拡張街判別可能)

  buildingType: BuildingType;

  // === house の場合 ===
  // ownerType: 削除 (個人/FC 区別なし)
  plot?: number;                  // 1-60 (通し番号)
  size?: HousingSize;

  // === 部屋区分 ===
  roomKind?: RoomKind;
  roomNumber?: number;

  addressKey: string;

  imageMode: ImageMode;
  postUrl?: string;
  ogImageUrl?: string;
  thumbnailPath?: string;

  tags: string[];
  description?: string;

  createdAt: number;
  updatedAt: number;
  isHidden: boolean;
  reportCount: number;
}
```

- [ ] **Step 3: tsc 確認 (大量のエラー想定)**

```bash
npx tsc --noEmit
```

Expected: いくつかのファイルで型エラー発生 (Task 3-9 で順次対応)。 エラー箇所をメモ。

- [ ] **Step 4: Commit**

```bash
rtk git add src/types/housing.ts
rtk git commit -m "fix(housing): HousingListing 型から subdivision / ownerType 削除 (spec 2026-05-19)"
```

---

## Task 3: `housingDuplicate.ts` の addressKey を訂正

**Files:**
- Modify: `src/utils/housingDuplicate.ts`
- Modify: `src/utils/housingDuplicate.test.ts`

- [ ] **Step 1: AddressInput から 2 フィールド削除**

`src/utils/housingValidation.ts` の `AddressInput` interface を更新 (Task 5 で本実装するが、 型シグネチャだけ先に):

```ts
export interface AddressInput {
  dc: string;
  server: string;
  area: HousingArea | string;
  ward: number;
  // subdivision: 削除

  buildingType: BuildingType | string;

  // house の場合
  // ownerType: 削除
  plot?: number;
  size?: HousingSize | string;

  // 部屋区分
  roomKind?: RoomKind | string;
  roomNumber?: number;
}
```

合わせて import から `Subdivision`, `OwnerType`, `isValidSubdivision`, `isValidOwnerType` を削除。

- [ ] **Step 2: buildAddressKey 関数を訂正**

`src/utils/housingDuplicate.ts` を以下に置換:

```ts
/**
 * 同住所判定キー生成 (純粋関数)
 *
 * 設計書 docs/superpowers/specs/2026-05-18-housing-room-types-design.md §3.3 (2026-05-19 訂正版) 準拠。
 *
 * - 家全体:       `${dc}|${server}|${area}|W${ward}|H${plot}`
 * - FC 個室:      `...|H${plot}|C${roomNumber}`
 * - アパート部屋: `...|W${ward}|A${roomNumber}`
 *
 * subdivision (本街/拡張街) は plot 番号 (1-30 vs 31-60) で判別可能なため key 不参加。
 * ownerType (個人/FC) は schema 削除済み。
 */
import type { AddressInput } from './housingValidation.js';

export function buildAddressKey(addr: AddressInput): string {
  const base = `${addr.dc}|${addr.server}|${addr.area}|W${addr.ward}`;

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

- [ ] **Step 3: テスト書き直し**

`src/utils/housingDuplicate.test.ts` を全面置換:

```ts
import { describe, it, expect } from 'vitest';
import { buildAddressKey, isSameAddress } from './housingDuplicate';
import type { AddressInput } from './housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('buildAddressKey', () => {
  it('家全体 (本街、 plot 12) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'M',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H12');
  });

  it('家全体 (拡張街、 plot 45) のキーを生成', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 45,
      size: 'L',
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H45');
  });

  it('FC 個室のキーを生成 (親 plot + 個室番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|H12|C5');
  });

  it('アパート部屋のキーを生成 (plot なし、 アパ番号)', () => {
    const addr: AddressInput = {
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 42,
    };
    expect(buildAddressKey(addr)).toBe('Mana|Pandaemonium|Shirogane|W3|A42');
  });

  it('plot 31 (拡張街最初) と plot 30 (本街最後) は別キー', () => {
    const p30: AddressInput = { ...baseAddr, buildingType: 'house', plot: 30, size: 'S' };
    const p31: AddressInput = { ...baseAddr, buildingType: 'house', plot: 31, size: 'S' };
    expect(buildAddressKey(p30)).not.toBe(buildAddressKey(p31));
  });
});

describe('isSameAddress', () => {
  it('完全一致なら true', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    expect(isSameAddress(a, b)).toBe(true);
  });

  it('plot 違いなら false', () => {
    const a: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const b: AddressInput = { ...baseAddr, buildingType: 'house', plot: 13, size: 'M' };
    expect(isSameAddress(a, b)).toBe(false);
  });

  it('家全体 vs 個室は別アドレス (ソフト重複)', () => {
    const house: AddressInput = { ...baseAddr, buildingType: 'house', plot: 12, size: 'M' };
    const chamber: AddressInput = {
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'M',
      roomKind: 'private_chamber',
      roomNumber: 5,
    };
    expect(isSameAddress(house, chamber)).toBe(false);
  });
});
```

- [ ] **Step 4: テストが通ることを確認**

```bash
rtk vitest run src/utils/housingDuplicate.test.ts
```

Expected: PASS (全 8 ケース)

- [ ] **Step 5: Commit**

```bash
rtk git add src/utils/housingDuplicate.ts src/utils/housingDuplicate.test.ts src/utils/housingValidation.ts
rtk git commit -m "fix(housing): buildAddressKey から subdivision 削除 + plot 1-60 対応テスト"
```

---

## Task 4: `housingValidation.ts` を 3 パターン制約に簡素化

**Files:**
- Modify: `src/utils/housingValidation.ts`
- Modify: `src/utils/housingValidation.test.ts`

- [ ] **Step 1: validateAddress を訂正**

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
  if (!addr.buildingType || !isValidBuildingType(String(addr.buildingType))) {
    errors.buildingType = 'invalid';
  }

  // buildingType 別の制約
  if (addr.buildingType === 'house') {
    // plot 必須 + 範囲 (1-60 通し番号)
    if (!Number.isInteger(addr.plot) || (addr.plot as number) < PLOT_RANGE.min || (addr.plot as number) > PLOT_RANGE.max) {
      errors.plot = 'out_of_range';
    }
    // size 必須 (個室の場合は親 plot のサイズ)
    if (!addr.size || !isValidHousingSize(String(addr.size))) {
      errors.size = 'invalid';
    }

    // 部屋区分
    if (addr.roomKind === 'private_chamber') {
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
    // plot / size 不可
    if (addr.plot !== undefined) errors.plot = 'not_allowed_for_apartment';
    if (addr.size !== undefined) errors.size = 'not_allowed_for_apartment';

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

import からも `isValidSubdivision`, `isValidOwnerType`, `Subdivision`, `OwnerType` を削除。

- [ ] **Step 2: テスト書き直し**

`src/utils/housingValidation.test.ts` を全面置換:

```ts
import { describe, it, expect } from 'vitest';
import { validateAddress, type AddressInput } from './housingValidation';

const baseAddr: Pick<AddressInput, 'dc' | 'server' | 'area' | 'ward'> = {
  dc: 'Mana',
  server: 'Pandaemonium',
  area: 'Shirogane',
  ward: 3,
};

describe('validateAddress: 3 パターン正常系', () => {
  it('家全体 (本街)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12, size: 'M' });
    expect(r.ok).toBe(true);
  });

  it('家全体 (拡張街、 plot 45)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 45, size: 'L' });
    expect(r.ok).toBe(true);
  });

  it('FC 個室 (親 plot 12、 個室 5)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 5,
    });
    expect(r.ok).toBe(true);
  });

  it('アパート部屋 (部屋 42)', () => {
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

  it('FC 個室の roomNumber 範囲外 (513) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      size: 'L',
      roomKind: 'private_chamber',
      roomNumber: 513,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('アパ部屋 roomNumber 範囲外 (91) は不可', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'apartment',
      roomKind: 'apartment_room',
      roomNumber: 91,
    });
    expect(r.ok).toBe(false);
    expect(r.errors.roomNumber).toBeDefined();
  });

  it('plot 範囲外 (61) は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 61, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('plot 範囲外 (0) は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 0, size: 'M' });
    expect(r.ok).toBe(false);
    expect(r.errors.plot).toBeDefined();
  });

  it('house なのに size 未指定は不可', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 12 } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });

  it('FC 個室で size 未指定は不可 (親 plot のサイズが必要)', () => {
    const r = validateAddress({
      ...baseAddr,
      buildingType: 'house',
      plot: 12,
      roomKind: 'private_chamber',
      roomNumber: 5,
    } as AddressInput);
    expect(r.ok).toBe(false);
    expect(r.errors.size).toBeDefined();
  });

  it('plot 31 (拡張街) は正常 (1-60 通し)', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 31, size: 'S' });
    expect(r.ok).toBe(true);
  });

  it('plot 60 (拡張街最後) は正常', () => {
    const r = validateAddress({ ...baseAddr, buildingType: 'house', plot: 60, size: 'L' });
    expect(r.ok).toBe(true);
  });
});
```

- [ ] **Step 3: テストが通ることを確認**

```bash
rtk vitest run src/utils/housingValidation.test.ts
```

Expected: PASS (全 14 ケース)

- [ ] **Step 4: Commit**

```bash
rtk git add src/utils/housingValidation.ts src/utils/housingValidation.test.ts
rtk git commit -m "fix(housing): validateAddress を 3 パターンに簡素化 + plot 1-60 対応"
```

---

## Task 5: `housingListingsService.ts` のクエリから subdivision 削除

**Files:**
- Modify: `src/lib/housingListingsService.ts`
- Modify: `src/lib/housingListingsService.test.ts`

- [ ] **Step 1: 関数シグネチャから subdivision を削除**

`src/lib/housingListingsService.ts` の以下を修正:

```ts
interface ChamberQuery {
  area: HousingArea;
  ward: number;
  // subdivision: 削除
  plot: number;
}

interface ApartmentQuery {
  area: HousingArea;
  ward: number;
  // subdivision: 削除
  currentRoomNumber: number;
}
```

import からも `Subdivision` を削除。

- [ ] **Step 2: 各クエリから where('subdivision', '==', ...) を削除**

```ts
export async function findChambersInPlot(q: ChamberQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    // where('subdivision', '==', q.subdivision): 削除
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

export async function findHouseForChamber(q: ChamberQuery): Promise<HousingListing | null> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    // where('subdivision', '==', q.subdivision): 削除
    where('plot', '==', q.plot),
    // where('ownerType', '==', 'fc'): 削除
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

export async function findApartmentRoomsInWard(q: ApartmentQuery): Promise<HousingListing[]> {
  const qref = query(
    collection(db, COLLECTION_NAME),
    where('area', '==', q.area),
    where('ward', '==', q.ward),
    // where('subdivision', '==', q.subdivision): 削除
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

- [ ] **Step 3: テスト修正**

`src/lib/housingListingsService.test.ts` の baseQuery から `subdivision` を削除:

```ts
const baseQuery = {
  area: 'Shirogane' as const,
  ward: 3,
  // subdivision: 削除
};
```

各テストで `findHouseForChamber` が `ownerType: 'fc'` を期待していたら、 `roomKind: undefined` 判定に変更:

```ts
describe('findHouseForChamber', () => {
  it('指定 plot の家全体 (= roomKind なし) を返す', async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: 'house', data: () => ({ roomKind: undefined, plot: 12 }) },
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
```

- [ ] **Step 4: テストが通ることを確認**

```bash
rtk vitest run src/lib/housingListingsService.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
rtk git add src/lib/housingListingsService.ts src/lib/housingListingsService.test.ts
rtk git commit -m "fix(housing): listing service のクエリから subdivision / ownerType 削除"
```

---

## Task 6: API handler から subdivision / ownerType 保存を削除

**Files:**
- Modify: `api/housing/_registerListingHandler.ts`

- [ ] **Step 1: listing 構築箇所を修正**

`api/housing/_registerListingHandler.ts` の `listing` オブジェクト構築を以下に置換:

```ts
const listing = {
  ownerUid: uid,
  dc: draft.dc,
  server: draft.server,
  area: draft.area,
  ward: draft.ward,
  // subdivision: 削除
  buildingType: draft.buildingType,
  ...(draft.buildingType === 'house' ? {
    // ownerType: 削除
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
```

注: FC 個室の場合、 size は親 plot のサイズとして保存される (整合性制約: house は常に size 必須)。

- [ ] **Step 2: tsc 確認**

```bash
npx tsc --noEmit
```

Expected: PASS (handler は新 type 経由で型解決される)

- [ ] **Step 3: Commit**

```bash
rtk git add api/housing/_registerListingHandler.ts
rtk git commit -m "fix(housing): register handler から subdivision / ownerType 保存削除"
```

---

## Task 7: Firestore Rules を 3 パターンに簡素化

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: helper 関数を削除/訂正**

`firestore.rules` から以下を削除:

```
function isValidSubdivision(sub) { ... }
function isValidOwnerType(t) { ... }
```

`isValidPlot` を 1-60 に訂正:

```
function isValidPlot(plot) {
  return plot is int && plot >= 1 && plot <= 60;
}
```

- [ ] **Step 2: allow create rule を 3 パターンに簡素化**

`housing_listings` の `allow create` を以下に置換:

```
allow create: if isAuthenticated()
              && request.auth.uid == request.resource.data.ownerUid
              && request.resource.data.dc is string
              && request.resource.data.server is string
              && isValidHousingArea(request.resource.data.area)
              && isValidWard(request.resource.data.ward)
              && isValidBuildingType(request.resource.data.buildingType)
              && isValidImageMode(request.resource.data.imageMode)
              && isValidTags(request.resource.data.tags)
              && (!('description' in request.resource.data) || isValidDescription(request.resource.data.description))
              && request.resource.data.addressKey is string
              && request.resource.data.addressKey.size() <= 200
              && request.resource.data.reportCount == 0
              && request.resource.data.isHidden == false
              // === buildingType 別の制約 (3 パターン) ===
              && (
                // house パターン (家全体 or FC 個室)
                (
                  request.resource.data.buildingType == 'house'
                  && isValidPlot(request.resource.data.plot)
                  && isValidHousingSize(request.resource.data.size)
                  && (
                    // 家全体: roomKind / roomNumber なし
                    !('roomKind' in request.resource.data)
                    || (
                      // FC 個室: roomNumber 1-512
                      request.resource.data.roomKind == 'private_chamber'
                      && isValidPrivateChamberNumber(request.resource.data.roomNumber)
                    )
                  )
                )
                ||
                // apartment パターン: plot/size なし、 roomKind='apartment_room' 必須、 roomNumber 1-90
                (
                  request.resource.data.buildingType == 'apartment'
                  && !('plot' in request.resource.data)
                  && !('size' in request.resource.data)
                  && request.resource.data.roomKind == 'apartment_room'
                  && isValidApartmentRoom(request.resource.data.roomNumber)
                )
              );
```

- [ ] **Step 3: allow update rule も同様に簡素化**

create と同じ buildingType 別制約を持つ。 update では `ownerUid` / `addressKey` / `reportCount` / `isHidden` 不変:

```
allow update: if isOwner(resource.data.ownerUid)
              && request.resource.data.ownerUid == resource.data.ownerUid
              && request.resource.data.addressKey == resource.data.addressKey
              && request.resource.data.reportCount == resource.data.reportCount
              && request.resource.data.isHidden == resource.data.isHidden
              && isValidHousingArea(request.resource.data.area)
              && isValidWard(request.resource.data.ward)
              && isValidBuildingType(request.resource.data.buildingType)
              && isValidImageMode(request.resource.data.imageMode)
              && isValidTags(request.resource.data.tags)
              && (!('description' in request.resource.data) || isValidDescription(request.resource.data.description))
              && (
                (
                  request.resource.data.buildingType == 'house'
                  && isValidPlot(request.resource.data.plot)
                  && isValidHousingSize(request.resource.data.size)
                  && (
                    !('roomKind' in request.resource.data)
                    || (
                      request.resource.data.roomKind == 'private_chamber'
                      && isValidPrivateChamberNumber(request.resource.data.roomNumber)
                    )
                  )
                )
                ||
                (
                  request.resource.data.buildingType == 'apartment'
                  && !('plot' in request.resource.data)
                  && !('size' in request.resource.data)
                  && request.resource.data.roomKind == 'apartment_room'
                  && isValidApartmentRoom(request.resource.data.roomNumber)
                )
              );
```

- [ ] **Step 4: Commit**

```bash
rtk git add firestore.rules
rtk git commit -m "fix(housing): firestore.rules を 3 パターン制約に簡素化 (subdivision/ownerType 削除、 plot 1-60)"
```

---

## Task 8: HousingRegisterView の EMPTY_DRAFT 修正

**Files:**
- Modify: `src/components/housing/register/HousingRegisterView.tsx`
- Modify: `src/__tests__/housing/HousingRegisterAddressFields.test.tsx`

- [ ] **Step 1: EMPTY_DRAFT から 2 フィールド削除**

```ts
const EMPTY_DRAFT: RegistrationDraft = {
  dc: '', server: '', area: '' as never,
  ward: 1,
  // subdivision: 削除
  buildingType: 'house',
  // ownerType: 削除
  plot: 1, size: 'M',
  tags: [],
  description: '',
};
```

- [ ] **Step 2: 既存テスト fixture を修正**

`src/__tests__/housing/HousingRegisterAddressFields.test.tsx` の `baseValue` を:

```ts
const baseValue = {
  dc: '', server: '', area: '' as never,
  ward: 1,
  buildingType: 'house' as const,
  plot: 1, size: 'M' as const,
};
```

- [ ] **Step 3: tsc + 既存 vitest 確認**

```bash
npx tsc --noEmit
rtk vitest run
```

Expected: PASS (housing 系 + 既存テスト全 PASS)

- [ ] **Step 4: Commit**

```bash
rtk git add src/components/housing/register/HousingRegisterView.tsx src/__tests__/housing/HousingRegisterAddressFields.test.tsx
rtk git commit -m "fix(housing): EMPTY_DRAFT + 既存テスト fixture から subdivision/ownerType 削除"
```

---

## Task 9: 統合確認 + ビルド

**Files:** (検証のみ、 修正は発生したファイルに対応)

- [ ] **Step 1: tsc 全体**

```bash
npx tsc --noEmit
```

Expected: PASS (0 errors)。 エラー出たら以下を grep して洗い出し:

- [ ] **Step 2: 旧 schema 参照を grep**

```bash
rtk grep "subdivision\|ownerType\|OwnerType\|Subdivision" src/
```

ヒットすべきは:
- 削除した箇所のコメントのみ
- 完全に削除されていれば 0 件

期待しないヒットがあれば訂正:
- `src/types/housing.ts`: 完全削除されているか
- `src/utils/housing*.ts`: 完全削除
- `api/housing/*`: 完全削除
- `firestore.rules`: 完全削除

- [ ] **Step 3: PLOT_RANGE = 30 の残骸を grep**

```bash
rtk grep "PLOT_RANGE\|max: 30\|max=30\|plot.*30" src/ api/ firestore.rules
```

PLOT_RANGE 自体は constants にあるが、 ハードコードで 30 を使っている箇所がないか確認。

- [ ] **Step 4: vitest 全体**

```bash
rtk vitest run
```

Expected: PASS (全テスト、 housing 系 + 他)

- [ ] **Step 5: build (本番ビルド)**

```bash
rtk npm run build
```

Expected: PASS (Vercel デプロイで通る)

- [ ] **Step 6: 既存の HousingRegisterAddressFields.test.tsx で it.skip 化されたテストを確認**

`src/__tests__/housing/HousingRegisterAddressFields.test.tsx` line 25 に `it.skip('size=Apartment ...` がある。 これは Phase 2 で UI 実装時に対応 (本 plan の scope 外)。 確認のみ。

- [ ] **Step 7: 統合 Commit (差分あれば)**

```bash
rtk git add -A
rtk git commit -m "fix(housing): schema 訂正の統合確認 + 残整理"
```

---

## 完了条件

- [ ] Task 1-9 すべて Step 完了
- [ ] tsc clean (0 errors)
- [ ] vitest 全 PASS
- [ ] build 成功
- [ ] grep `subdivision\|ownerType` で残骸なし
- [ ] grep `PLOT_RANGE` で max: 60 になっている

---

## 次の plan (別管理)

1. **Phase 2: 登録モーダル UI** — `2026-05-19-housing-register-modal.md` (Phase 1 完了後に作成)
   - ハウジング独自トンマナ (モックアップ準拠) でモーダル化
   - SNS URL 欄を最上部
   - 住居タイプ 5 種チップ (S/M/L/個室/アパート)
   - ファイル分け (HousingRegisterModal / Form / SnsUrlField / TypeSelector / RoomNumberField 等)
   - i18n 4 言語追加

2. **Phase 3: 物件詳細ページ + 通報 UI 分離 + 家主異議申し立て** — Phase 2 完了後

3. **Phase 1 設計書 (2026-05-07) 改訂** — §4.2/§4.3/§6.1/§6.5/§7/§9.3 を spec 2026-05-19 訂正版で更新 (上記 Phase 進行中に手作業で並行)
