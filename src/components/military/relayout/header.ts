/** ヘッダーの開閉(通気口とタイムラインが上下に よける) */
import { HDR_H } from '../headerGeometry';
import { OUT, PHASE_DUR, PHASE_GAP, frames, zonesOf } from './motion';
import { canStart, cancelAll, doChange, doneFlag, finish, held, hsOf, launch, later, play, startOf, whenDone, whenHidden } from './run';
import type { Run } from './run';

/** ヘッダーを開く: 通気口とタイムラインが一緒に下がる → 上に下地 → ヘッダーが上から下りる */
export function headerOpen(app: HTMLElement, run: Run, hdr: HTMLElement) {
  // change 前(行の高さ 0)なので、動く量はヘッダーの高さ(102 × 縮小率)
  const D = HDR_H * hsOf(app);
  const p1 = zonesOf(app, ['vent', 'workspace']).map((z) => play(run, z, frames(0, 0, 0, D), { duration: PHASE_DUR, fill: 'forwards' }));
  let base: number | null = null, entry: Animation | null = null, gapOver = false, started = false;
  const go = () => {
    if (!run.changed || started || !entry || !canStart(gapOver, base)) return;
    started = true;
    const w = launch(run, [entry], base, PHASE_DUR + PHASE_GAP);
    whenDone(run, [entry], w + PHASE_DUR, () => finish(app, run));
  };
  const p1Done = doneFlag(p1);
  whenHidden(run, PHASE_DUR, PHASE_DUR + PHASE_GAP, () => p1Done.v, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    const a = app.getBoundingClientRect(), r = hdr.getBoundingClientRect();
    entry = held(run, hdr, frames(0, -(r.bottom - a.top + OUT), 0, 0), { duration: PHASE_DUR, fill: 'both' });
    go();
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}

/** ヘッダーを閉じる: ヘッダー(本物)が上へ抜ける → 下地 → 通気口とタイムラインが上がる */
export function headerClose(app: HTMLElement, run: Run, hdr: HTMLElement) {
  const a = app.getBoundingClientRect(), r = hdr.getBoundingClientRect();
  const keep = zonesOf(app, ['vent', 'workspace']);
  const before = new Map(keep.map((z) => [z, z.getBoundingClientRect().top]));
  const p1 = [play(run, hdr, frames(0, 0, 0, -(r.bottom - a.top + OUT)), { duration: PHASE_DUR, fill: 'forwards' })];
  let base: number | null = null, gapOver = false, started = false;
  const wait: Animation[] = [];
  const go = () => {
    if (!run.changed || started || !canStart(gapOver, base)) return;
    started = true;
    const w = launch(run, wait, base, PHASE_DUR + PHASE_GAP);
    whenDone(run, wait, w + PHASE_DUR, () => finish(app, run));
  };
  // ヘッダーが画面の上へ抜けきったら change。通気口・タイムラインは新しい配置で元の位置に止めておく
  whenHidden(run, PHASE_DUR * 0.4, PHASE_DUR, () => hdr.getBoundingClientRect().bottom <= app.getBoundingClientRect().top + 0.5, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    keep.forEach((z) => {
      const dy = before.get(z)! - z.getBoundingClientRect().top;
      if (Math.abs(dy) >= 0.5) wait.push(held(run, z, frames(0, dy, 0, 0), { duration: PHASE_DUR, fill: 'both' }));
    });
    go();
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}
