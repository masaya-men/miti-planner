import type { HousingArea, HousingSize } from '../../store/useHousingFilterStore';
import type { MockListing } from '../../data/housing/mockListings';
import type { Region } from '../../data/housing/dcServerMap';
import { regionForDC } from '../../data/housing/dcServerMap';
import { isValidHousingArea } from '../../types/housing';
import { WARD_RANGE, PLOT_RANGE, APARTMENT_ROOM_RANGE } from '../../constants/housing';
import { buildAddressKey } from '../../utils/housingDuplicate';

/**
 * 「住所登録なし一時ツアー」向け: 一時 listing の型・境界検証・factory (計画書 §2-4)。
 *
 * 一時 listing = SNS 投稿からパースした住所を Firestore に永続化せず、その場でツアー
 * 表示するための使い捨ての `MockListing` 完全互換オブジェクト (`id` が `ephemeral-` prefix)。
 * 専用 store (`useEphemeralListingsStore`, persist なし) にのみ保持し、リロードで消える。
 */

/** 一時 listing の id prefix。`isEphemeralListingId` の判定根拠 (spec §3.1) 以外の用途で複製しないこと。 */
export const EPHEMERAL_ID_PREFIX = 'ephemeral-';

/** 専用 store が同時に保持できる件数の上限。 */
export const EPHEMERAL_POOL_LIMIT = 30;

/** id が一時 listing (ephemeral- prefix) かどうかの唯一の判定根拠。 */
export function isEphemeralListingId(id: string): boolean {
  return id.startsWith(EPHEMERAL_ID_PREFIX);
}

// id 連番: モジュール内カウンタ + Date.now() で一意化 (同一 ms 内の連続生成にも耐える)。
let ephemeralIdCounter = 0;
function nextEphemeralId(): string {
  ephemeralIdCounter += 1;
  return `${EPHEMERAL_ID_PREFIX}${Date.now()}-${ephemeralIdCounter}`;
}

/** 一時 listing 生成の入力。 SNS パーサ (parseHousingFromText 等) の出力を想定。 */
export interface EphemeralInput {
  area: HousingArea;
  ward: number; // 1-30
  buildingType: 'house' | 'apartment';
  plot?: number; // house: 1-60
  size?: HousingSize; // house 任意
  apartmentBuilding?: 1 | 2; // apartment (未指定は 1)
  roomNumber?: number; // apartment: 1-90
  title?: string;
  postUrl?: string; // SNS 経由のとき (登録リンク引き継ぎ用)
  ogImageUrl?: string; // SNS 経由の代表画像
  sourceImageUrls?: string[];
  dc?: string;
  server?: string; // パーサが取れたときだけ (並べ替えの安定用・表示には未使用)
}

export type EphemeralValidation =
  | { ok: true }
  | { ok: false; error: 'invalid_area' | 'invalid_ward' | 'invalid_plot' | 'invalid_room' };

/**
 * 境界検証 (純関数)。 range は既存 `constants/housing.ts` の `WARD_RANGE` / `PLOT_RANGE` /
 * `APARTMENT_ROOM_RANGE` と同一値を参照 (ハードコーディング回避)。
 *
 * - area: `types/housing.ts` の `isValidHousingArea` を流用
 * - ward: 1-30 (buildingType によらず共通)
 * - house のとき plot: 1-60 (未指定/範囲外は invalid_plot、size は未検証 = 任意項目のため)
 * - apartment のとき roomNumber: 1-90 (未指定/範囲外は invalid_room)
 */
export function validateEphemeralInput(input: EphemeralInput): EphemeralValidation {
  if (!isValidHousingArea(input.area)) {
    return { ok: false, error: 'invalid_area' };
  }

  if (!Number.isInteger(input.ward) || input.ward < WARD_RANGE.min || input.ward > WARD_RANGE.max) {
    return { ok: false, error: 'invalid_ward' };
  }

  if (input.buildingType === 'house') {
    const plot = input.plot;
    if (plot === undefined || !Number.isInteger(plot) || plot < PLOT_RANGE.min || plot > PLOT_RANGE.max) {
      return { ok: false, error: 'invalid_plot' };
    }
  }

  if (input.buildingType === 'apartment') {
    const roomNumber = input.roomNumber;
    if (
      roomNumber === undefined ||
      !Number.isInteger(roomNumber) ||
      roomNumber < APARTMENT_ROOM_RANGE.min ||
      roomNumber > APARTMENT_ROOM_RANGE.max
    ) {
      return { ok: false, error: 'invalid_room' };
    }
  }

  return { ok: true };
}

/**
 * dc から region を解決できないとき (dc 未指定 / dcServerMap に無い dc) の既定値。
 * `Region` 型 ('JP' | 'NA' | 'EU' | 'OCE') のうち、本プロジェクトの主要言語圏である JP を既定にする。
 */
const DEFAULT_EPHEMERAL_REGION: Region = 'JP';

/**
 * 一時 listing (`MockListing` 完全互換) を生成する。
 *
 * 呼び出し側は事前に `validateEphemeralInput` で境界検証を通しておくこと
 * (本関数は組み立てのみ行い、検証はしない)。
 *
 * `MockListing` 必須フィールドの中立値 (計画書より):
 * - `ownerUid`: `'__ephemeral__'` (一時 listing 専用の識別子。実ユーザー UID と衝突しない)
 * - `dc`/`server`: 未指定なら空文字 (表示には未使用、並べ替えの安定用)
 * - `region`: `dc` を `dcServerMap.regionForDC` で解決できればその値、できなければ `DEFAULT_EPHEMERAL_REGION`
 * - `imageMode`: `ogImageUrl` があれば `'sns'`、なければ `'none'`
 * - `tags`: 常に空配列 (一時 listing はタグ付けなし)
 * - `visibility`: 常に `'public'` (一時ツアーは非公開概念を持たない)
 * - `createdAt` = `lastConfirmedAt`: 生成時刻
 * - `addressKey`: 既存 `buildAddressKey` (`src/utils/housingDuplicate.ts`) を流用して生成
 *
 * apartment のとき `roomKind` 相当のフィールドは `MockListing` に存在しない。
 * `buildingType` + `apartmentBuilding` + `roomNumber` の組で足りる
 * (`resolveWardMapRef` / `TourShowcasePanel` の読み方に一致)。
 */
export function createEphemeralListing(input: EphemeralInput): MockListing {
  const now = Date.now();
  const region = (input.dc ? regionForDC(input.dc) : null) ?? DEFAULT_EPHEMERAL_REGION;
  const isHouse = input.buildingType === 'house';
  const apartmentBuilding = isHouse ? undefined : (input.apartmentBuilding ?? 1);
  const plot = isHouse ? input.plot : undefined;
  const size = isHouse ? input.size : undefined;
  const roomNumber = isHouse ? undefined : input.roomNumber;

  return {
    id: nextEphemeralId(),
    ownerUid: '__ephemeral__',
    dc: input.dc ?? '',
    server: input.server ?? '',
    region,
    area: input.area,
    ward: input.ward,
    buildingType: input.buildingType,
    plot,
    size,
    apartmentBuilding,
    roomNumber,
    imageMode: input.ogImageUrl ? 'sns' : 'none',
    postUrl: input.postUrl,
    ogImageUrl: input.ogImageUrl,
    sourceImageUrls: input.sourceImageUrls,
    tags: [],
    title: input.title,
    visibility: 'public',
    createdAt: now,
    lastConfirmedAt: now,
    addressKey: buildAddressKey({
      dc: input.dc ?? '',
      server: input.server ?? '',
      area: input.area,
      ward: input.ward,
      buildingType: input.buildingType,
      plot,
      apartmentBuilding,
      roomNumber,
    }),
  };
}
