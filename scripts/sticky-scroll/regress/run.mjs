import { args, PROBE_FILTER } from './config.mjs';
import { MITIGATION_FIXTURE } from '../../milspec-sp2/_fixture.mjs';
import { PROBES } from './helpers.mjs';
import { openPage } from './page.mjs';

// ───────────────────────────── main ─────────────────────────────
export const JOBS = Math.max(1, Number(typeof args.jobs === 'string' ? args.jobs : 3));

/** 同時に JOBS 個まで走らせる。 */
export async function pool(tasks) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) { const i = next++; await tasks[i](); }
  };
  await Promise.all(Array.from({ length: Math.min(JOBS, tasks.length) }, worker));
}
export const errMsg = (e) => String(e && e.message ? e.message : e).split('\n')[0];

/** 動作確認の名前を、実際に走らせる単位(別ページ)へ展開する。--probe の絞り込みも適用。 */
export function expandProbes(names) {
  const out = [];
  for (const parent of names) {
    const subs = parent === 'drag' ? ['drag', 'conflict'] : parent === 'memo' ? ['memo', 'memoLimit'] : [parent];
    for (const sub of subs) if (!PROBE_FILTER || PROBE_FILTER.has(sub) || PROBE_FILTER.has(parent)) out.push(sub);
  }
  return [...new Set(out)];
}

/** 条件ごとの動作確認。各確認は新しいページ(状態が混ざらない)。 */
export async function runBehaviorFor(cond, subs) {
  const items = {}, errors = [];
  const over = {
    conflict: { timelineMitigations: [
      ...MITIGATION_FIXTURE.map((m) => ({ ...m })),
      { id: 'rg-c1', mitigationId: 'tactician', ownerId: 'D1', time: 465, duration: 15 }, // 画面の下にある競合(画面外の矢印)
      { id: 'rg-c2', mitigationId: 'tactician', ownerId: 'D1', time: 483, duration: 15 },
      { id: 'rg-c3', mitigationId: 'vengeance', ownerId: 'MT', time: 69, duration: 15 }, // 51 秒の復讐の再使用時間の中(見える位置)
    ] },
    drag: { timelineMitigations: [
      ...MITIGATION_FIXTURE.map((m) => ({ ...m })),
      { id: 'rg-tp', mitigationId: 'temperance', ownerId: 'H2', time: 33, duration: 20 },
      { id: 'rg-dc', mitigationId: 'divine_caress', ownerId: 'H2', time: 51, duration: 10 }, // テンパランスの窓(30 秒)の中
    ] },
    memoLimit: { memos: Array.from({ length: 100 }, (_, i) => ({ id: `rg-lim-${i}`, text: `m${i}`, timeSec: 15 + (i % 30) * 18, xRatio: 0.55 + (i % 10) * 0.03, createdAt: i, updatedAt: i })) },
  };
  for (const sub of subs) {
    const t0 = Date.now();
    let ctx;
    try {
      ctx = await openPage(cond, { over: over[sub] || {} });
      items[`probe.${sub}`] = await PROBES[sub](ctx.page, cond);
    } catch (e) {
      items[`probe.${sub}`] = { error: errMsg(e) };
      errors.push(`${cond.id} ${sub}: ${errMsg(e)}`);
    } finally {
      if (ctx) await ctx.browser.close();
    }
    const bad = items[`probe.${sub}`].error;
    console.log(`  beh ${cond.id} ${sub} (${((Date.now() - t0) / 1000).toFixed(1)}s)${bad ? ' ERROR ' + bad : ''}`);
  }
  return { items, errors };
}
