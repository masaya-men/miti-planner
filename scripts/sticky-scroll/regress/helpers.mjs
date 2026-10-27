import { withStore, MIT } from './page.mjs';

// ───────────────────────────── 動作の確認 ─────────────────────────────
export const PROBES = {};

/** ポインタでドラッグ(縦)。 */
export async function dragBy(page, from, dx, dy, { hold = 0, steps = 12 } = {}) {
  if (!from) return false;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
  if (hold) await page.waitForTimeout(hold);
  await page.mouse.up();
  return true;
}
/** 軽減アイコンの中心(ふつう・スプシ・MIL-SPEC 共通)。data 属性は MIL-SPEC にしか無いので、
 *  行の上端(時刻)とメンバー列の横範囲(見出しの並び順)で探す。 */
export const iconCenter = (page, owner, t) => page.evaluate(([o, t]) => {
  const row = document.querySelector(`[data-time-row="${t}"]`);
  if (!row) return null;
  const rb = row.getBoundingClientRect();
  const order = [...document.querySelectorAll('[data-member-id]')]
    .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).map((e) => e.getAttribute('data-member-id'));
  const cols = [...row.querySelectorAll('[data-job-col]')].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const col = cols[order.indexOf(o)];
  if (!col) return null;
  const cb = col.getBoundingClientRect();
  const icon = [...document.querySelectorAll('.timeline-scroll-container .cursor-grab')].find((e) => {
    const b = e.getBoundingClientRect();
    const cy = b.top + b.height / 2;
    return cy >= rb.top && cy <= rb.bottom && b.left + b.width / 2 >= cb.left && b.left + b.width / 2 <= cb.right;
  });
  if (!icon) return null;
  const b = icon.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}, [owner, t]);

export const MOVE_THEN_WAIT = async (page, x, y, ms = 400) => { await page.mouse.move(x, y); await page.waitForTimeout(ms); };

/** メモモードに入る(ボタンの押し方は標準と MIL-SPEC で違う=スイッチ。store で確実に入れて、入ったことを確かめる)。 */
export async function enterMemoMode(page) {
  await withStore(page, MIT, (m) => m.useMitigationStore.getState().setToolMode('memo'));
  await page.waitForTimeout(500);
  const mode = await withStore(page, MIT, (m) => m.useMitigationStore.getState().toolMode);
  if (mode !== 'memo') throw new Error(`メモモードに入れない: ${mode}`);
}
