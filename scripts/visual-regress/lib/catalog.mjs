// @ts-check
/**
 * カタログ(撮影対象の一覧)の検査と、撮影条件への展開。純関数のみ。
 */

export const VPS = ['1489', '1920', '390'];
export const THEMES = [
  'standard-dark', 'standard-light', 'military-dark', 'military-light',
  'housing-dark', 'housing-light', 'site-dark', 'site-light',
];
export const LANGS = ['ja', 'en'];

/**
 * @param {any[]} entries
 * @returns {string[]} エラー文の配列(空なら正常)
 */
export function validateCatalog(entries) {
  /** @type {string[]} */
  const errors = [];
  const seen = new Set();
  for (const [i, e] of entries.entries()) {
    const name = e?.id ?? `#${i}`;
    if (!e || typeof e.id !== 'string' || !e.id) { errors.push(`${name}: id がありません`); continue; }
    if (seen.has(e.id)) errors.push(`${e.id}: id が重複しています`);
    seen.add(e.id);
    if (typeof e.route !== 'string' || !e.route) errors.push(`${e.id}: route がありません`);
    if (typeof e.storage !== 'function') errors.push(`${e.id}: storage(関数)がありません`);
    if (typeof e.ready !== 'string' || !e.ready) {
      errors.push(e.clip === 'ready' ? `${e.id}: clip:'ready' なのに ready がありません` : `${e.id}: ready がありません`);
    }
    if (e.clip !== undefined && e.clip !== 'page' && e.clip !== 'ready') errors.push(`${e.id}: clip の値が不正です(${e.clip})`);
    const ax = e.axes;
    if (!ax || !Array.isArray(ax.vp) || !Array.isArray(ax.theme) || !Array.isArray(ax.lang)) {
      errors.push(`${e.id}: axes(vp/theme/lang の配列)がありません`);
      continue;
    }
    if (!ax.vp.length || !ax.theme.length || !ax.lang.length) errors.push(`${e.id}: axes に空の配列があります`);
    for (const v of ax.vp) if (!VPS.includes(v)) errors.push(`${e.id}: 未知の vp '${v}'`);
    for (const t of ax.theme) if (!THEMES.includes(t)) errors.push(`${e.id}: 未知の theme '${t}'`);
    for (const l of ax.lang) if (!LANGS.includes(l)) errors.push(`${e.id}: 未知の lang '${l}'`);
    for (const m of e.mask ?? []) if (!m?.selector || !m?.reason) errors.push(`${e.id}: mask には selector と reason が必要です`);
  }
  return errors;
}

/**
 * vp × theme × lang の直積を撮影条件にする。
 * @param {any[]} entries
 * @param {{ only?: string }} [opts] only: key に含まれる文字で絞る
 * @returns {{ key: string, entry: any, vp: string, theme: string, lang: string }[]}
 */
export function expandConditions(entries, { only } = {}) {
  const out = [];
  for (const entry of entries) {
    for (const vp of entry.axes.vp) {
      for (const theme of entry.axes.theme) {
        for (const lang of entry.axes.lang) {
          const key = `${entry.id}@${vp}-${theme}-${lang}`;
          if (only && !key.includes(only)) continue;
          out.push({ key, entry, vp, theme, lang });
        }
      }
    }
  }
  return out;
}
