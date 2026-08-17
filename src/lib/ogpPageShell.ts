/**
 * 動的OGPページハンドラー (api/share/_*PageHandler.ts) 共通のHTML組み立てヘルパー。
 *
 * これらのハンドラーはビルド済み index.html を取得し、<meta> タグの差し替えに加えて
 * <div id="root"> の中に人間可読なテキストを埋め込む (Googlebot のソフト404対策)。
 * src/main.tsx は createRoot().render() (hydrateRoot ではない) を使っているため、
 * ここで埋め込んだ静的テキストは JS 実行後に安全に上書きされる。
 */

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** ビルド済み index.html の空の <div id="root"></div> に snapshotHtml を差し込む。見つからなければ元のhtmlを返す。 */
export function injectSeoSnapshot(html: string, snapshotHtml: string): string {
  const marker = '<div id="root"></div>';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `<div id="root">${snapshotHtml}</div>`);
}
