import { escapeHtml } from '../../src/lib/ogpPageShell.js';

/** ハウジンガーページのSEOスナップショット (Googlebot向けに<div id="root">へ埋め込む可視テキスト)。 */
export function buildHousingerSeoSnapshotHtml(input: {
  displayName: string;
  bio: string;
  listingCount: number;
}): string {
  const name = input.displayName || 'ハウジンガー';
  const bioHtml = input.bio ? `<p>${escapeHtml(input.bio)}</p>` : '';
  return `<h1>${escapeHtml(name)} のハウジング</h1>${bioHtml}<p>${input.listingCount}件のハウジングを公開中</p>`;
}
