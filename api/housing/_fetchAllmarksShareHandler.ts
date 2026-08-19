/**
 * GET /api/housing?action=fetch-allmarks-share&shareId=xxxxxx
 *
 * Allmarks (マイコラージュ) の共有リンク(/s/<shareId>)の中身(公開JSON API)を取得し、
 * カードの元URL一覧だけをクライアントへ返す。Allmarks側は一切変更しない(既存の
 * タグ絞り込み共有機能をそのまま利用)。
 *
 * Allmarksの `GET /api/share/<id>` は認証不要の公開エンドポイントだが CORS ヘッダーを
 * 返さないため、ブラウザから直接 fetch できない(=このサーバー側の窓口が必要)。
 *
 * shareId は Allmarks 側 `lib/share/kv-id.ts` の isValidShareId と同一形式(英数字6桁)を
 * ここでも検証してから外部URLを組み立てる(固定ドメイン+検証済みIDのみを許可し、
 * 任意URLを叩ける汎用プロキシにはしない)。
 *
 * 認証不要(一時ツアーはログイン不要な既存仕様と揃える)。App Check も課さない
 * (search-housingers 等の匿名公開窓口と同じ判断)、DoW対策は rate limit のみで担う。
 */
import { applyRateLimit } from '../../src/lib/rateLimit.js';

const ALLMARKS_ORIGIN = 'https://allmarks.app';
const SHARE_ID_RE = /^[A-Za-z0-9]{6}$/;
/** Allmarks側 SHARE_LIMITS_V2.MAX_CARDS と同じ (念のための二重防御・信頼できない外部レスポンス対策)。 */
const MAX_CARDS = 100;

interface AllmarksShareCard {
  u?: unknown;
}

/**
 * `GET /api/share/<id>` のレスポンス形。Allmarks側 `KVShareEntry`
 * (`lib/share/types-v2.ts`) と同じ、カード配列は `share.cards` に入っている
 * (トップレベルに直接 `cards` は無い。R2移行の経緯で `share`/`thumb` の
 * 2キー構造になっている。実機で確認済み: 2026-08-19実データで検証)。
 */
interface AllmarksShareResponse {
  share?: {
    cards?: unknown;
  };
}

export default async function handler(req: any, res: any): Promise<void> {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await applyRateLimit(req, res, 10, 60_000))) return;

  const shareId = req.query?.shareId;
  if (typeof shareId !== 'string' || !SHARE_ID_RE.test(shareId)) {
    res.status(400).json({ error: 'invalid_share_id', urls: [] });
    return;
  }

  try {
    const upstream = await fetch(`${ALLMARKS_ORIGIN}/api/share/${shareId}`);
    if (!upstream.ok) {
      // 期限切れ/存在しない共有 (404) 等。 呼び出し側は空配列を「取り出せなかった」として扱う。
      res.status(200).json({ urls: [] });
      return;
    }
    const data = (await upstream.json()) as AllmarksShareResponse;
    const cards = Array.isArray(data.share?.cards) ? (data.share.cards as AllmarksShareCard[]) : [];
    const urls = cards
      .map((c) => c.u)
      .filter((u): u is string => typeof u === 'string' && u.length > 0)
      .slice(0, MAX_CARDS);
    res.status(200).json({ urls });
  } catch (error) {
    console.error('[housing/fetch-allmarks-share] error:', error);
    res.status(200).json({ urls: [] });
  }
}
