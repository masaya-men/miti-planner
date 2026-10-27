/** @type {{ stepNum: number, results: any[], page: import('playwright').Page | undefined, rec: {fatal:string[], whitelisted:string[]} | undefined }} */
export const state = { stepNum: 0, results: [], page: undefined, rec: undefined };

/** 実装済みステップ総数 (ファイル頭の手順コメントと一致させること)。 */
export const TOTAL_STEPS = 30;

/** viewport ごとにモジュールレベル状態をリセット (複数幅で回すと stepNum が累積し
 *  results も混ざって出力が読みにくくなるため、各幅の実行前に必ず呼ぶ)。 */
export function resetState() {
  state.stepNum = 0;
  state.results.length = 0;
  state.page = undefined;
  state.rec = undefined;
}

export function fail(msg) {
  throw new Error(msg);
}

export async function step(label, fn) {
  state.stepNum += 1;
  const tag = `step ${state.stepNum}: ${label}`;
  const fatalBefore = state.rec.fatal.length;
  let note = '';
  try {
    note = (await fn()) || '';
  } catch (err) {
    state.results.push({ tag, ok: false, note: String(err && err.message ? err.message : err) });
    throw err;
  }
  const newFatal = state.rec.fatal.slice(fatalBefore);
  if (newFatal.length) {
    state.results.push({ tag, ok: false, note: `console errors:\n    ${newFatal.join('\n    ')}` });
    fail(`${tag}: 非 whitelist の console/pageerror が発生:\n  ${newFatal.join('\n  ')}`);
  }
  state.results.push({ tag, ok: true, note });
  console.log(`  ✓ ${tag}${note ? ` — ${note}` : ''}`);
}

/** ブラウザ内 store getState ヘルパ */
export const getState = (store, path) =>
  state.page.evaluate(
    async ({ store, path }) => {
      const mod = await import(store);
      const key = Object.keys(mod).find((k) => k.startsWith('use'));
      const s = mod[key].getState();
      return path ? path.split('.').reduce((o, k) => (o == null ? o : o[k]), s) : s;
    },
    { store, path },
  );

export const MITI = './_fixture.mjs'; // not used directly; store paths below
export const MITI_STORE = '/src/store/useMitigationStore.ts';
