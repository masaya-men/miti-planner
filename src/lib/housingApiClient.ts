/**
 * /api/housing クライアント
 *
 * - canRegister: 登録可能か事前チェック (フォーム表示時に呼ぶ)
 * - registerListing: 物件登録 (フォーム送信時)
 * - checkDuplicate: 同住所重複チェック (フォーム送信前のプレチェック)
 */
import { buildHousingHeaders as buildHeaders } from './housingAuthHeaders';
import type { AddressInput, RegistrationDraft } from '../utils/housingValidation';

const API_BASE = '/api/housing';

export class QuotaExhaustedError extends Error {
  constructor() {
    super('quota_exhausted');
    this.name = 'QuotaExhaustedError';
  }
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

export interface PurgeResponse {
  deleted: boolean;
}

/**
 * ツイートが削除済みなら物件を soft delete するようサーバーに依頼する。
 * 削除の真偽はサーバーが syndication 404 を再確認してから判定する（家主以外でも安全）。
 * 失敗・対象外は { deleted: false } を返す（呼び出し側で握りつぶせるよう投げない）。
 */
export async function purgeIfTweetGone(listingId: string): Promise<PurgeResponse> {
  try {
    const headers = await buildHeaders(true);
    const res = await fetch(`${API_BASE}?action=purge-if-tweet-gone`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ listingId }),
    });
    if (!res.ok) return { deleted: false };
    const body = (await res.json().catch(() => ({}))) as Partial<PurgeResponse>;
    return { deleted: body.deleted === true };
  } catch {
    return { deleted: false };
  }
}

export interface ConfirmListingResponse {
  success: boolean;
  lastConfirmedAt: number;
}

/**
 * 家主が「今もあります」 ボタンで listing を現役確認する (2026-05-27 Phase 2-2)。
 * サーバが lastConfirmedAt を Date.now() で更新する。
 * 認可: 家主 (= ownerUid 一致) のみ。 失敗時は body.error にコードを乗せて throw。
 * - not_found: listing が無い or 既に削除済み
 * - forbidden: 自分の listing じゃない
 * - forbidden_hidden: 通報で非表示中 (= resolve-report 経由で復帰する設計、 confirm 不可)
 */
export async function confirmListing(listingId: string): Promise<ConfirmListingResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=confirm-listing`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ listingId }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `confirm-listing failed: ${res.status}`);
  }
  return (await res.json()) as ConfirmListingResponse;
}

export interface UploadThumbnailResponse {
  success: boolean;
  thumbnailPath: string;
  thumbnailPaths?: string[];
}

/**
 * 物件サムネ画像を Firebase Storage にアップロード (2026-05-26 新設、 multi-image 対応)。
 * クライアント側でリサイズ + AVIF 圧縮 + EXIF 削除済の base64 を送る前提。
 *
 * index: 0..3 の整数 (省略時 0)。 backend が thumbnailPaths[index] にセット。
 * 同じ index への再呼び出しは上書き (画像の入れ替えに利用可)。
 *
 * Throws: error.message に backend のエラーコード ('too_large', 'forbidden' 等) を含む。
 */
export async function uploadListingThumbnail(params: {
  listingId: string;
  base64: string;
  mimeType: string;
  index?: number;
}): Promise<UploadThumbnailResponse> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=upload-thumbnail`, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `upload-thumbnail failed: ${res.status}`);
  }
  return (await res.json()) as UploadThumbnailResponse;
}
