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
export const PLOT_RANGE = { min: 1, max: 60 } as const;                // 通し番号: 本街 1-30、 拡張街 31-60 (公式仕様、 2026-05-19 訂正)
export const APARTMENT_ROOM_RANGE = { min: 1, max: 90 } as const;
export const PRIVATE_CHAMBER_RANGE = { min: 1, max: 512 } as const;    // FC 個室 公式上限

// ─────────────────────────────────────────────
// ユーザー入力の制限（設計書 §4.2 / §6.1）
// ─────────────────────────────────────────────

export const MAX_TITLE_LENGTH = 50;

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
// タグ体系 (2026-07-10 刷新: 公式23 + 季節12 + テーマ12 + 個人タグ)
// 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md
// ─────────────────────────────────────────────

/** 個人タグ id の prefix。 静的タグ (official_ / season_ / theme_) と衝突しない専用 namespace。 */
export const PERSONAL_TAG_ID_PREFIX = 'personal_' as const;

/**
 * 1 ユーザーが作成できる個人タグの上限。
 * 表記揺れ・なりすまし防止のため 1 人 1 個 (設計判断・変更不可)。
 * kind 増設に備え、 この制約自体も設定値として分離しておく (ハードコード分岐禁止)。
 */
export const PERSONAL_TAG_LIMIT_PER_USER = 1;

/** 個人タグの表示名 (例: 「@yuura」相当) の最大文字数。 */
export const PERSONAL_TAG_DISPLAY_NAME_MAX_LENGTH = 24;

/** 個人タグ検索 (オートコンプリート) の 1 回あたり最大返却件数。 */
export const PERSONAL_TAG_SEARCH_LIMIT = 20;

// ─────────────────────────────────────────────
// 通報・自浄作用（設計書 §9.3）
// ─────────────────────────────────────────────

export const REPORT_AUTO_HIDE_THRESHOLD = 3;

/**
 * 家主が自分で非表示を解除 (自己復帰) できる回数の上限。
 * これを超えて再び自動非表示になった物件は、 家主の却下/編集では戻せず、
 * Discord 異議 = 管理者対応に escalate する (いたずら登録 + 却下連打による占有を防ぐ)。
 */
export const MAX_SELF_RESTORE = 1;

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
