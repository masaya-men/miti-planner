/**
 * FFLogs レポート URL から reportId と fightId を抽出する純粋関数。
 * ユーザー側 FFLogsImportModal.handleUrlChange（旧 L89-90）の正規表現をそのまま正本として再現する。
 * 受理 URL 集合を狭めないため、管理側 FflogsTranslationModal の厳しい正規表現には寄せない。
 */
export function parseFflogsUrl(
  url: string,
): { reportId: string; fightId: string | null } | null {
  const reportMatch = url.match(/reports\/([a-zA-Z0-9]+)/);
  if (!reportMatch || !reportMatch[1]) return null;
  const fightMatch = url.match(/[#?]fight=([^&]+)/);
  return { reportId: reportMatch[1], fightId: fightMatch ? fightMatch[1] : null };
}
