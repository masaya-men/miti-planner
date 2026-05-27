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

  // === apartment の場合 (必須、 2026-05-27 追加) ===
  /**
   * アパート号棟。 1=本街アパート、 2=拡張街アパート。
   * 各 ward にアパート棟が 2 つ存在し、 同 ward 同部屋番号でも号棟違いで別物件 (公式仕様)。
   * buildingType==='house' の場合は持たない。
   */
  apartmentBuilding?: 1 | 2;

  // === 部屋区分 ===
  roomKind?: RoomKind;            // undefined / 'private_chamber' / 'apartment_room'
  roomNumber?: number;            // 1-512 (chamber) / 1-90 (apt)

  // 同住所検索用 denormalized key (server 生成)
  addressKey: string;

  // 画像（3 択のいずれか）
  imageMode: ImageMode;
  postUrl?: string;
  ogImageUrl?: string;
  /**
   * 1 枚目のサムネ URL (後方互換 + 一覧用代表画像)。
   * 複数画像対応 (2026-05-26) 前の物件はこのフィールドのみ持つ。
   * 新規物件は thumbnailPaths[0] と同値を保存して後方互換維持。
   */
  thumbnailPath?: string;
  /**
   * 複数画像対応 (2026-05-26 追加)。 thumbnail mode の物件で 1-4 枚保存。
   * 表示側は thumbnailPaths があれば優先、 なければ thumbnailPath を 1 枚として扱う。
   */
  thumbnailPaths?: string[];

  /**
   * 2026-05-27 追加: SNS 投稿元 (housingsnap / studio-xiv 等の OGP) から取得した
   * 外部画像 URL リスト (1-4 件)。 imageMode==='sns' で OGP 経由のときのみ持つ。
   *
   * - **画像本体は LoPo の倉庫にコピーせず**、 表示時に `<img src>` で元サイトを直接読む
   *   (投稿削除で自動消失、 LoPo 帯域消費ゼロ、 設計書 §6.2 sns モード)
   * - Twitter / YouTube は ogImageUrl 1 枚維持 (sourceImageUrls は持たない)
   * - 表示側は sourceImageUrls があれば配列で切替、 なければ ogImageUrl 1 枚を fallback
   */
  sourceImageUrls?: string[];

  // SNS 連動 (imageMode==='sns' のみ持つ)
  /** syndication 問い合わせキー。postUrl から再パースでも可だが明示保持で query/index を単純化。 */
  tweetId?: string;
  /** 最後にツイート生存を確認した時刻(ms)。cron の「古い順」並びと開いた時チェックに使う。 */
  lastTweetCheckAt?: number;

  /**
   * YouTube 動画 ID (11 文字 [A-Za-z0-9_-])。 2026-05-26 追加。
   * imageMode==='sns' で source が YouTube の場合のみ持つ。
   * postUrl = YouTube watch URL、 ogImageUrl = サムネ URL (img.youtube.com)。
   * tweetId とは排他 (どちらか一方のみ)。
   */
  youtubeVideoId?: string;

  /**
   * 2026-05-27 追加: Twitter 動画ツイートの mp4 URL。
   * 元: `https://video.twimg.com/ext_tw_video/.../mp4`。
   * 表示時は `/api/tweet-video?url=<encoded>` で proxy 経由で `<video>` 再生。
   * imageMode==='sns' && tweetId 時に存在 (静止画ツイート sourceImageUrls とは排他)。
   */
  videoUrl?: string;
  /**
   * 2026-05-27 追加: Twitter 動画ツイートの poster 画像 URL (`pbs.twimg.com`)。
   * `<video poster>` 属性 + Lightbox 表示前のフォールバック。
   */
  videoPosterUrl?: string;
  /**
   * 2026-05-27 追加: 動画アスペクト比 (width/height、 例 1.78=16:9)。
   * 一覧カードの aspect-ratio 確保に使用。
   */
  videoAspectRatio?: number;

  // ユーザー入力
  tags: string[];
  description?: string;

  // システム
  createdAt: number;
  updatedAt: number;
  isHidden: boolean;
  reportCount: number;

  /**
   * 家主が自分で非表示を解除 (自己復帰) した回数。
   * MAX_SELF_RESTORE を超えると却下/編集での復帰不可 = 管理者対応 (占有対策)。
   * 未設定 (旧データ) は 0 とみなす。
   */
  restoreCount?: number;

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
