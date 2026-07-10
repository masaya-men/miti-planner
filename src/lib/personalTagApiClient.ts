/**
 * /api/housing (個人タグ系アクション) クライアント
 *
 * 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md Phase B-2/B-3。
 * - createPersonalTag: 自分のタグ作成 (1 ユーザー 1 個)
 * - getMyPersonalTag: 自分のタグ取得 (未作成なら null)
 * - searchPersonalTags: 個人タグ検索 (探すページのフィルタ用オートコンプリート、 認証不要)
 * - reportPersonalTag: 個人タグ通報
 */
import { buildHousingHeaders as buildHeaders } from './housingAuthHeaders';
import type { PersonalTag } from '../types/housing';

const API_BASE = '/api/housing';

export class PersonalTagLimitReachedError extends Error {
  constructor() {
    super('limit_reached');
    this.name = 'PersonalTagLimitReachedError';
  }
}

export class PersonalTagAlreadyExistsError extends Error {
  existingTag: PersonalTag;
  constructor(existingTag: PersonalTag) {
    super('already_exists');
    this.name = 'PersonalTagAlreadyExistsError';
    this.existingTag = existingTag;
  }
}

export async function createPersonalTag(displayName: string): Promise<PersonalTag> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=create-personal-tag`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ displayName }),
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    if (body.error === 'already_exists' && body.tag) {
      throw new PersonalTagAlreadyExistsError(body.tag as PersonalTag);
    }
    throw new PersonalTagLimitReachedError();
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `create-personal-tag failed: ${res.status}`);
  }
  const body = (await res.json()) as { tag: PersonalTag };
  return body.tag;
}

export async function getMyPersonalTag(): Promise<PersonalTag | null> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=my-personal-tag`, { method: 'GET', headers });
  if (!res.ok) throw new Error(`my-personal-tag failed: ${res.status}`);
  const body = (await res.json()) as { tag: PersonalTag | null };
  return body.tag;
}

export async function searchPersonalTags(query: string): Promise<PersonalTag[]> {
  const headers = await buildHeaders(false);
  const res = await fetch(`${API_BASE}?action=search-personal-tags&q=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers,
  });
  if (!res.ok) throw new Error(`search-personal-tags failed: ${res.status}`);
  const body = (await res.json()) as { tags: PersonalTag[] };
  return body.tags;
}

export async function reportPersonalTag(tagId: string, comment?: string): Promise<void> {
  const headers = await buildHeaders(true);
  const res = await fetch(`${API_BASE}?action=report-personal-tag`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tagId, ...(comment ? { comment } : {}) }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `report-personal-tag failed: ${res.status}`);
  }
}
