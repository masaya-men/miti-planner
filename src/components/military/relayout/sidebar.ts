/** サイドバーの開閉(ヘッダー・通気口・フッターを継ぎ目で切り分け、左の板と台車を滑らせる) */
import { HDR_BANDS, RAIL_MARGIN, SIDEBAR_SPAN, VENT_PLATE_X } from '../headerGeometry';
import { CARRIAGE_DUR, CARRIAGE_LAG, OUT, PHASE_DUR, PHASE_GAP, edgeFrames, frames, zoneOf, zonesOf } from './motion';
import { boxOf, splitZone, swapRight } from './split';
import type { Seam } from './split';
import { canStart, cancelAll, captureProbes, doChange, doneFlag, finish, held, hsOf, launch, later, play, startOf, whenDone, whenHidden, whenSettled } from './run';
import type { Run } from './run';
import { boxClips, pinWorkspaceEdge, shadowFollow, slidePlates } from './plates';
import type { EdgePin } from './plates';

/** 通気口の左の板の右端(溝 chanL の左端・ventLayout の chanL.x) */
const VENT_SEAM = VENT_PLATE_X;
/** フッターの継ぎ目: 左寄せの文字(著作権の 1 行)の右端から 12px 右(右のリンクとの間の無地) */
const FOOTER_TEXT = '.milspec-flink.static';
const FOOTER_SEAM_GAP = 12;

/** そのままの形で滑る区画(workspace は右端の縁を pinWorkspaceEdge で留める) */
const SLIDE_ZONES = ['rail', 'workspace'] as const;
/** サイドバーの開閉で切り分ける区画(閉じたヘッダーは見えないので切らない) */
function splitTargets(app: HTMLElement): HTMLElement[] {
  const h = zoneOf(app, 'header'), v = zoneOf(app, 'vent'), f = zoneOf(app, 'footer');
  return [h && !h.hasAttribute('data-collapsed') ? h : null, v, f].filter((z): z is HTMLElement => !!z);
}
/** 継ぎ目(区画の左端から・画面 px)。左寄せの部品は開閉の前後で区画の左端からの位置が同じなので、どちらの配置で測ってもよい。
 *  ヘッダーは上の板の切れ目の帯ごとの階段(HDR_BANDS × 縮小率。x も y も内箱と一緒に縮む) */
function seamOf(app: HTMLElement, z: HTMLElement): Seam {
  const name = z.getAttribute('data-ms-zone');
  if (name === 'footer') {
    const t = z.querySelector(FOOTER_TEXT), zr = z.getBoundingClientRect();
    return t ? t.getBoundingClientRect().right - zr.left + FOOTER_SEAM_GAP : zr.width / 2;
  }
  const hs = hsOf(app);
  if (name === 'vent') return VENT_SEAM * hs;
  return HDR_BANDS.map((b) => ({ x: b.cut * hs, y0: b.y0 * hs, y1: b.y1 * hs }));
}

/** 台車の画面上の走行量 = レールの長さ − 台車の幅 − 両端の余白(狭い画面では headerGeometry の ventCarriageRun で縮む)。
 *  レールは開閉で画面上不動なので、どちらの状態で測っても同じ。測れなければサイドバーぶんの半分 */
function carriageTravel(app: HTMLElement): number {
  const v = zoneOf(app, 'vent');
  const rail = v?.querySelector('[data-vent-rail]'), car = v?.querySelector('[data-vent-carriage]');
  const w = rail && car ? rail.getBoundingClientRect().width - car.getBoundingClientRect().width - 2 * RAIL_MARGIN * hsOf(app) : 0;
  return w > 0.5 ? w : SIDEBAR_SPAN / 2;
}

/** サイドバーを閉じる: サイドバーだけ左へ抜ける → 下地 → 他の区画と左の板が滑り込む(台車はレールを走る) */
export function sidebarClose(app: HTMLElement, run: Run, sb: HTMLElement) {
  const a = app.getBoundingClientRect(), s = sb.getBoundingClientRect();
  const slides = zonesOf(app, SLIDE_ZONES);
  const before = new Map(slides.map((z) => [z, z.getBoundingClientRect().left]));
  const targets = splitTargets(app);
  const seams = new Map(targets.map((z) => [z, seamOf(app, z)]));
  const ws = zoneOf(app, 'workspace');
  const probes = captureProbes(ws ? [...targets, ws] : targets);
  const travel = carriageTravel(app);
  const p1 = [play(run, sb, frames(0, 0, -(s.right - a.left + OUT), 0), { duration: PHASE_DUR, fill: 'forwards' })];

  let base: number | null = null, D = 0, settled = false, gapOver = false, started = false;
  let wait: Animation[] = [], plates: ReturnType<typeof slidePlates>[] = [];
  const edges: Animation[] = [];
  let pin: EdgePin | null = null;
  const go = () => {
    if (!run.changed || !settled || started || !canStart(gapOver, base)) return;
    started = true;
    const all = [...wait, ...edges, ...plates.flatMap((p) => p.anims)];
    const w = launch(run, all, base, PHASE_DUR + PHASE_GAP, () => plates.forEach((p) => p.moving()));
    whenDone(run, all, w + Math.max(PHASE_DUR, CARRIAGE_LAG + CARRIAGE_DUR), () => finish(app, run));
  };
  // サイドバーが画面の外へ抜けきったら change。ヘッダー・通気口は change 前の配置で切り分けて押さえる
  // (左の板・台車はこの複製のまま 2 段目で動かす。右の複製だけ、描き直しが済んでから新しい配置で作り直す)
  whenHidden(run, PHASE_DUR * 0.4, PHASE_DUR, () => sb.getBoundingClientRect().right <= app.getBoundingClientRect().left + 0.5, () => {
    const boxes = targets.map(boxOf);
    // 表の区画は右端の縁を留める(change 前の配置で。DOM を変える前に読むので切り分けより先)
    if (ws) { pin = pinWorkspaceEdge(ws); run.restores.push(pin.restore); }
    const splits = targets.map((z, i) => splitZone(z, seams.get(z)!, boxes[i]));
    run.restores.push(...splits.map((sp) => sp.restore));
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    slides.forEach((z) => { D = Math.max(D, before.get(z)! - z.getBoundingClientRect().left); });
    if (D < 0.5) D = SIDEBAR_SPAN;
    // rail / workspace / footer は新しい配置で +D(= 元の画面位置)に止めておき、2 段目の開始で一斉に動かす
    wait = slides.map((z) => held(run, z, frames(D, 0, 0, 0), { duration: PHASE_DUR, fill: 'both' }));
    if (pin) wait.push(...boxClips(run, pin, D, 0, true, 'both'));
    plates = splits.map((sp) => slidePlates(run, sp, 0, -D, 0, -travel, true));
    whenSettled(run, probes, () => {
      const bx = targets.map(boxOf);
      targets.forEach((z, i) => {
        const seam = seams.get(z)!;
        swapRight(splits[i], z, seam, bx[i]);
        // 継ぎ目が移動量より左(通気口): 右の複製(溝)の見える左端を板の左端と一緒に動かす。新しい配置では D → 0
        if (typeof seam === 'number' && seam < D - 0.5) edges.push(held(run, splits[i].right, edgeFrames(D, 0), { duration: PHASE_DUR, fill: 'both' }));
        // ヘッダー: 上の板の縁の影が左の板の縁に付いて動く(新しい配置の窓の位置が基準。D → 0)
        if (Array.isArray(seam)) { const sh = shadowFollow(app, z, run, D, 0, true); if (sh) edges.push(sh); }
      });
      pin?.swap(D);
      settled = true;
      go();
    });
  });
  later(run, PHASE_DUR + PHASE_GAP, () => { gapOver = true; go(); });
}

/** サイドバーを開く: 他の区画と左の板が右へよける(台車も走る) → 下地 → サイドバーが左から入る */
export function sidebarOpen(app: HTMLElement, run: Run) {
  // change 前なので、動く量は「開いたときのサイドバーの幅 + 隙間」
  const D = SIDEBAR_SPAN;
  const targets = splitTargets(app);
  const ws = zoneOf(app, 'workspace');
  const probes = captureProbes(ws ? [...targets, ws] : targets);
  const travel = carriageTravel(app);
  const pin = ws ? pinWorkspaceEdge(ws) : null;
  if (pin) run.restores.push(pin.restore);
  const p1 = zonesOf(app, SLIDE_ZONES).map((z) => play(run, z, frames(0, 0, D, 0), { duration: PHASE_DUR, fill: 'forwards' }));
  if (pin) p1.push(...boxClips(run, pin, 0, D, false, 'forwards'));
  const plateAnims = targets.flatMap((z) => {
    const seam = seamOf(app, z);
    const sp = splitZone(z, seam);
    run.restores.push(sp.restore);
    if (typeof seam === 'number' && seam < D - 0.5) sp.edge = [0, D];
    const anims = slidePlates(run, sp, 0, D, 0, travel, false).anims;
    // ヘッダー: 上の板の縁の影が左の板の縁に付いて動く(いまの配置 = 窓が開いた位置が基準。0 → D)
    if (Array.isArray(seam)) { const sh = shadowFollow(app, z, run, 0, D, false); if (sh) anims.push(sh); }
    return anims;
  });
  const phase1End = Math.max(PHASE_DUR, CARRIAGE_LAG + CARRIAGE_DUR);

  let base: number | null = null, entry: Animation | null = null, gapOver = false, started = false, settled = false, ended = false;
  const end = () => { if (settled && ended) finish(app, run); };
  const go = () => {
    if (!run.changed || started || !canStart(gapOver, base)) return;
    started = true;
    const list = entry ? [entry] : [];
    const w = launch(run, list, base, phase1End + PHASE_GAP);
    whenDone(run, list, w + PHASE_DUR, () => { ended = true; end(); });
  };
  // rail / workspace / footer が 1 段目の行き先に着いたら change(新しい配置 = 行き先なので、止めても画面上は動かない)
  const p1Done = doneFlag(p1);
  whenHidden(run, PHASE_DUR, phase1End + PHASE_GAP, () => p1Done.v, () => {
    base = startOf(p1[0]);
    doChange(run);
    cancelAll(p1);
    const sb = zoneOf(app, 'sidebar');
    if (sb) {
      const a = app.getBoundingClientRect(), s = sb.getBoundingClientRect();
      entry = held(run, sb, frames(-(s.right - a.left + OUT), 0, 0, 0), { duration: PHASE_DUR, fill: 'both' });
    }
    // ヘッダー・通気口は、描き直しが済み、左の板・台車が着ききってから本物に戻す(複製は新しい配置と同じ位置に止まる)
    whenSettled(run, probes, () => whenDone(run, plateAnims, 0, () => { settled = true; run.restores.forEach((r) => r()); end(); }));
    go();
  });
  later(run, phase1End + PHASE_GAP, () => { gapOver = true; go(); });
}
