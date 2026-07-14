/**
 * 公開読み系 API の緊急停止フラグ。
 * Vercel env `PUBLIC_READ_API_DISABLED=true` で対象 API を一括 503 にする。
 * 注意: Vercel の env 変更は再デプロイで反映 (数分 + ビルド 1 回消費)。
 * 即時に止めたい場合は Cloudflare でパスをブロックする
 * (手順: docs/.private/2026-07-14-p0-dashboard-ops.md)。
 */
export function isPublicReadApiDisabled(): boolean {
  return process.env.PUBLIC_READ_API_DISABLED === 'true';
}

/** Node 用: 停止中なら 503 を返して true (ハンドラは即 return する) */
export function rejectIfPublicApiDisabled(res: any): boolean {
  if (!isPublicReadApiDisabled()) return false;
  res.status(503).json({ error: 'temporarily unavailable' });
  return true;
}

/** Edge 用: 停止中なら 503 Response、通常時 null */
export function rejectIfPublicApiDisabledWeb(): Response | null {
  if (!isPublicReadApiDisabled()) return null;
  return Response.json({ error: 'temporarily unavailable' }, { status: 503 });
}
