/** サーバー管理画面 — 入力欄の class とカンマ区切り変換 */

export const inputClass =
  'px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text w-full';
export const labelClass = 'block text-app-base text-app-text-muted mb-0.5';

/** カンマ区切り文字列 ↔ 配列のヘルパー */
export const toCommaSeparated = (arr: string[]) => arr.join(', ');
export const fromCommaSeparated = (str: string) =>
  str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
