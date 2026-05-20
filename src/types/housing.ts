/**
 * ハウジングツアー Firestore データモデル
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md §4
 *
 * - 住所中心モデル（ツイート URL は補助情報）
 * - 1 物件 1 カード（住所ハッシュベースではなく auto-id、重複は登録時警告で吸収）
 * - 画像 3 択（SNS URL / サムネ / なし）
 * - LoPo 個人情報を持たない原則準拠（screen_name 等保存しない）
 */

/**
 * **Note on timestamp fields**: All `*At`, `lastReset`, etc. timestamp fields in
 * this file are typed as `number` (Unix epoch milliseconds) rather than Firestore
 * `Timestamp`. This keeps the types layer free of Firebase SDK imports.
 * Conversion happens at the read/write adapter layer (e.g., `serverTimestamp()`
 * is converted to `Date.now()` on read).
 */

// ─────────────────────────────────────────────
// Enum-like Union Types
// ─────────────────────────────────────────────

export const HOUSING_AREAS = ['Mist', 'LavenderBeds', 'Goblet', 'Shirogane', 'Empyreum'] as const;
export type HousingArea = typeof HOUSING_AREAS[number];

export const HOUSING_SIZES = ['S', 'M', 'L'] as const;
export type HousingSize = typeof HOUSING_SIZES[number];

// ─────────────────────────────────────────────
// 個室・アパート対応 (spec 2026-05-18 §3.1)
// ─────────────────────────────────────────────

export const BUILDING_TYPES = ['house', 'apartment'] as const;
export type BuildingType = typeof BUILDING_TYPES[number];

export const ROOM_KINDS = ['private_chamber', 'apartment_room'] as const;
export type RoomKind = typeof ROOM_KINDS[number];

export const IMAGE_MODES = ['sns', 'thumbnail', 'none'] as const;
export type ImageMode = typeof IMAGE_MODES[number];

export const REPORT_REASONS = ['wrong_info', 'griefing', 'nsfw', 'sold', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];

export const FEATURE_TOOLS = ['miti', 'housing'] as const;
export type FeatureTool = typeof FEATURE_TOOLS[number];

// ─────────────────────────────────────────────
// 型ガード関数
// ─────────────────────────────────────────────

export function isValidHousingArea(value: string): value is HousingArea {
  return (HOUSING_AREAS as readonly string[]).includes(value);
}

export function isValidHousingSize(value: string): value is HousingSize {
  return (HOUSING_SIZES as readonly string[]).includes(value);
}

export function isValidBuildingType(value: string): value is BuildingType {
  return (BUILDING_TYPES as readonly string[]).includes(value);
}

export function isValidRoomKind(value: string): value is RoomKind {
  return (ROOM_KINDS as readonly string[]).includes(value);
}

export function isValidImageMode(value: string): value is ImageMode {
  return (IMAGE_MODES as readonly string[]).includes(value);
}

export function isValidReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as readonly string[]).includes(value);
}

export function isValidFeatureTool(value: string): value is FeatureTool {
  return (FEATURE_TOOLS as readonly string[]).includes(value);
}

// ─────────────────────────────────────────────
// Firestore ドキュメント型
// ─────────────────────────────────────────────

/**
 * housing_listings/{id} - メイン物件
 * 設計書: docs/superpowers/specs/2026-05-18-housing-room-types-design.md §3.1
 */
export interface HousingListing {
  id: string;
  ownerUid: string;

  // 物理ワールド
  dc: string;
  server: string;

  // エリア + ワード
  area: HousingArea;
  ward: number;                   // 1-30

  // 建物タイプ
  buildingType: BuildingType;     // 'house' | 'apartment'

  // === house の場合 (必須) ===
  // plot 番号で本街/拡張街は判別可能 (1-30 本街、 31-60 拡張街)
  plot?: number;                  // 1-60 通し番号
  size?: HousingSize;             // 'S' | 'M' | 'L' (個室の場合は親 plot のサイズ)

  // === 部屋区分 ===
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

  /**
   * 家主による削除タイムスタンプ (soft delete)。
   * - null: 生きてる
   * - number: 削除済み (30 日後に物理削除予定)
   * 既存の isHidden は「運営非表示 (自動/手動)」 として用途分離する。
   */
  deletedAt: number | null;
}

/**
 * housing_listings/{id}/reports/{reportId} - 通報サブコレクション
 * 設計書 §4.3 参照
 */
export interface HousingReport {
  reporterUid: string;
  reason: ReportReason;
  comment?: string;
  createdAt: number;
}

/**
 * housing_tours/{id} - ツアールート
 * 設計書 §4.4 参照
 * ゲストは LocalStorage に同等構造を保持（ownerUid='local'）
 */
export interface HousingTour {
  id: string;
  ownerUid: string;
  title: string;       // max 50 chars (validated at write time)
  listingIds: string[];
  startId?: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

/**
 * housing_favorites/{uid}/items/{listingId} - お気に入り
 * 設計書 §4.5 参照
 */
export interface HousingFavorite {
  listingId: string;
  addedAt: number;
}

/**
 * housing_user_meta/{uid} - ユーザーメタデータ
 * 設計書 §4.6 参照
 * 書き込みは Cloud Function 経由のみ（クライアント直接書き込み禁止）
 */
export interface HousingUserMeta {
  registrationCount: number;
  dailyQuota: {
    remaining: number;
    lastReset: number;
  };
}

/**
 * users/{uid}/featureSessions/{tool} - ツール毎 opt-in フラグ
 * 設計書 §4.7 参照
 * ツール (miti / housing) ごとに「使う」を明示的に opt-in する仕組み
 */
export interface FeatureSession {
  activated: boolean;
  activatedAt: number;
}
