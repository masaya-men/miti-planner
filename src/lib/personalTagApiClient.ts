/**
 * /api/housing (個人タグ系アクション) クライアント
 *
 * 計画書: docs/superpowers/plans/2026-07-10-housing-tag-overhaul-plan.md Phase B-2/B-3。
 * タグ刷新 Phase B とハウジンガーPF の統合契約1 (spec §3.3) により、 個人タグの作成・更新は
 * upsert-housinger-profile (housingerProfileService.ts の upsertHousingerProfile) に一本化された。
 * 旧 create-personal-tag action とそのクライアント関数は廃止済み。
 * - getMyPersonalTag: 自分のタグ取得 (未作成 / 未公開なら null 相当の isHidden=true)
 * - searchPersonalTags: 個人タグ検索 (探すページのフィルタ用オートコンプリート、 認証不要)
 * - reportPersonalTag: 個人タグ通報
 */
import { buildHousingHeaders as buildHeaders } from './housingAuthHeaders';
import type { PersonalTag } from '../types/housing';

const API_BASE = '/api/housing';

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
