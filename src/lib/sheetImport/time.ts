/** "M:SS"（負値対応）→ 秒。パースできなければ null。既存 parseMitigationSheet と同仕様。 */
export function mmssToSec(v: string | undefined): number | null {
  if (v == null) return null;
  const m = v.trim().match(/^(-?)(\d+):([0-5]?\d)$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}
