/**
 * 個人タグ (personal_tags) ドメインロジック — 純粋関数のみ。
 *
 * 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md Phase B。
 *
 * Firestore への実際の読み書きは api/housing/ 配下のハンドラが行う。 このファイルは
 * client (React) / server (API ハンドラ) の両方から共有される決定ロジックのみを持ち、
 * Firestore SDK には依存しない (= vitest でモック無しにテストできる)。
 */
import { PERSONAL_TAG_ID_PREFIX } from '../constants/housing.js';
import type { PersonalTag } from '../types/housing.js';

const SLUG_INVALID_CHARS = /[^a-z0-9]+/g;

/**
 * displayName から ASCII slug を作る。 絵文字・非ラテン文字 (例: 全角カタカナのみの名前) は
 * 除去されるため空文字になり得る (呼び出し側の buildPersonalTagId が random suffix で補う)。
 */
// Unicode property escape (\p{Diacritic}) で分音記号を除去。 リテラルの結合文字を
// ソースに直書きすると表示・diff が壊れるため、 文字クラス直書きは避ける。
function slugifyDisplayName(displayName: string): string {
  return displayName
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '') // 分音記号除去 (例: e-acute → e)
    .toLowerCase()
    .replace(SLUG_INVALID_CHARS, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 20);
}

const RANDOM_SUFFIX_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function defaultRandomSuffix(length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += RANDOM_SUFFIX_CHARS[Math.floor(Math.random() * RANDOM_SUFFIX_CHARS.length)];
  }
  return out;
}

/**
 * displayName から個人タグ id (`personal_<slug>_<random>` または `personal_<random>`) を生成する。
 * randomSuffix はテスト時に注入可能 (既定は真の乱数、 衝突は Firestore 側の doc 作成で実質的に無視できる確率)。
 */
export function buildPersonalTagId(
  displayName: string,
  randomSuffix: () => string = defaultRandomSuffix,
): string {
  const base = slugifyDisplayName(displayName);
  const suffix = randomSuffix();
  const core = base ? `${base}_${suffix}` : suffix;
  return `${PERSONAL_TAG_ID_PREFIX}${core}`;
}

/** 検索用の大文字小文字非依存キー。 Firestore ドキュメントの displayNameLower に保存する。 */
export function normalizeDisplayNameForSearch(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/** 1 ユーザー 1 個制約の判定 (PERSONAL_TAG_LIMIT_PER_USER と比較)。 */
export function canCreatePersonalTag(existingCount: number, limit: number): boolean {
  return existingCount < limit;
}

export type PersonalTagAttachRejection = 'not_found' | 'hidden' | 'not_owner';
export interface PersonalTagAttachResult {
  ok: boolean;
  reason?: PersonalTagAttachRejection;
}

/**
 * listing に personal_ タグを付与してよいかの判定 (自分のタグのみ・非表示は付与不可)。
 * Firestore からの読み取りは呼び出し側 (API ハンドラ) が行い、 結果 (tag | undefined) を渡す
 * (このファイルは Firestore SDK に依存しない方針のため)。
 */
export function evaluatePersonalTagAttach(
  tag: PersonalTag | undefined,
  requestingUid: string,
): PersonalTagAttachResult {
  if (!tag) return { ok: false, reason: 'not_found' };
  if (tag.isHidden) return { ok: false, reason: 'hidden' };
  if (tag.ownerUid !== requestingUid) return { ok: false, reason: 'not_owner' };
  return { ok: true };
}

/** 通報カウントの更新結果 (housing_listings の通報しきい値パターン (REPORT_AUTO_HIDE_THRESHOLD) を踏襲)。 */
export function computePersonalTagReportOutcome(
  currentCount: number,
  threshold: number,
): { newCount: number; shouldHide: boolean } {
  const newCount = currentCount + 1;
  return { newCount, shouldHide: newCount >= threshold };
}
