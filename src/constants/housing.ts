/**
 * ハウジングツアー定数
 *
 * 設計書: docs/superpowers/specs/2026-05-07-housing-tour-phase1-design.md
 *
 * すべてのマジックナンバー・ハードコード値はここに集約。
 */

// ─────────────────────────────────────────────
// 物件構造の範囲（FF14 仕様）
// ─────────────────────────────────────────────

export const WARD_RANGE = { min: 1, max: 30 } as const;
export const PLOT_RANGE = { min: 1, max: 30 } as const;                // 30 → 60 から訂正 (subdivision 別)
export const APARTMENT_ROOM_RANGE = { min: 1, max: 90 } as const;
export const PRIVATE_CHAMBER_RANGE = { min: 1, max: 512 } as const;    // NEW (FC 個室、 公式上限)

// ─────────────────────────────────────────────
// ユーザー入力の制限（設計書 §4.2 / §6.1）
// ─────────────────────────────────────────────

export const HOUSING_LIMITS = {
  MAX_TAGS_PER_LISTING: 5,
  MAX_DESCRIPTION_LENGTH: 200,
  MAX_TOUR_TITLE_LENGTH: 50,
  MAX_THUMBNAIL_BYTES: 100 * 1024,            // 100KB（圧縮前の上限、後段で 80KB に圧縮）
  THUMBNAIL_DIMENSION_PX: 400,
  MAX_TOUR_LISTINGS: 100,
  MAX_FAVORITES_PER_USER: 100,
} as const;

// ─────────────────────────────────────────────
// 通報・自浄作用（設計書 §9.3）
// ─────────────────────────────────────────────

export const REPORT_AUTO_HIDE_THRESHOLD = 3;

// ─────────────────────────────────────────────
// 登録枠 D 案（設計書 §6.4）
// ─────────────────────────────────────────────

export const REGISTRATION_INITIAL_BONUS = 30;       // 累計 30 件まで無制限
export const REGISTRATION_DAILY_QUOTA = 5;          // 30 件超過後の日次回復数

// ─────────────────────────────────────────────
// ルート定義（設計書 §10.1）
// ─────────────────────────────────────────────

export const HOUSING_ROUTES = {
  TOP: '/housing',
  LISTING_DETAIL_TEMPLATE: '/housing/p/:id',
  TOUR_DETAIL_TEMPLATE: '/housing/tour/:id',
} as const;

/** 物件詳細 URL を組み立て */
export function buildListingDetailPath(id: string): string {
  return `/housing/p/${id}`;
}

/** ツアー詳細 URL を組み立て */
export function buildTourDetailPath(id: string): string {
  return `/housing/tour/${id}`;
}
