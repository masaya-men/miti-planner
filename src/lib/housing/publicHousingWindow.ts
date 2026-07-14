/**
 * 公開読み窓口 (api/housing/public) の client fetch (2026-07-14 P1)。
 *
 * - App Check / Authorization を付けない素の fetch (窓口は公開・Cloudflare キャッシュ対象)。
 * - version → data の 2 段。内容変更で version が変わる=URL が変わる=旧キャッシュ自然失効。
 * - 返却は Firestore `HousingListing` 形 (窓口が projectPublicListing で整形済)。呼び出し側は
 *   従来どおり firestoreToGalleryListing で view-model に変換する。
 */
import type { HousingListing } from '../../types/housing';

const BASE = '/api/housing/public';

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`public window ${res.status}`);
  return (await res.json()) as T;
}

/** 現在の公開データ版番号 (30 秒キャッシュ)。失敗時は 0 に縮退。 */
async function fetchVersion(): Promise<number> {
  try {
    const { version } = await getJson<{ version: number }>(`${BASE}?action=version`);
    return typeof version === 'number' ? version : 0;
  } catch {
    return 0;
  }
}

export async function fetchPublicGallery(): Promise<HousingListing[]> {
  const v = await fetchVersion();
  const { listings } = await getJson<{ listings: HousingListing[] }>(`${BASE}?action=gallery&v=${v}`);
  return Array.isArray(listings) ? listings : [];
}

export async function fetchPublicHousinger(uid: string): Promise<HousingListing[]> {
  const v = await fetchVersion();
  const { listings } = await getJson<{ listings: HousingListing[] }>(
    `${BASE}?action=housinger&uid=${encodeURIComponent(uid)}&v=${v}`,
  );
  return Array.isArray(listings) ? listings : [];
}

/**
 * 詳細の peers (同住所の他の登録) を窓口から取得する。
 * 詳細 main 自体は useHousingDetail の getDoc 据え置き (P1 では get を締めないため)。
 * 取得失敗 / 404 (非公開・非表示) は空配列 (peers はあくまで補助表示)。
 */
export async function fetchPublicListingPeers(id: string): Promise<HousingListing[]> {
  try {
    const v = await fetchVersion();
    const { peers } = await getJson<{ peers: HousingListing[] }>(
      `${BASE}?action=listing&id=${encodeURIComponent(id)}&v=${v}`,
    );
    return Array.isArray(peers) ? peers : [];
  } catch {
    return [];
  }
}
