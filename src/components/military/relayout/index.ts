/** ヘッダー / サイドバーの開閉で区画を滑らせる動き(設計書 §3 D・見本 v3.html の tgSide / tgHead / clipMv / runCar)。
 *  全ての開閉は 2 段: 1 段目は今の配置のまま動かす → 1 段目の終わり + PHASE_GAP で 2 段目を新しい配置で動かす。
 *  change() は 1 段目が画面から見えなくなった所(抜ける区画が画面の外へ出た / よけた区画が行き先に着いた)で呼び、
 *  2 段目まで動く区画は一時停止した animate で元の画面位置に止めておく(重い再描画を「ずらす間」の中に隠すため)。
 *  サイドバーの開閉では、ヘッダー・通気口を「左の板 / 右に固定 / 台車」の複製に切り分ける(splitZone)。
 *  左の板だけが 1 枚の板として滑り、右端基準の部品(時計・H4・sort・hazR・pnX・レール)は画面上で一度も動かない。
 *  板の動きは全て「少し行き過ぎて戻る」共通の keyframe(frames)。台車はモーターで少し遅れて一定の速さで走る。
 *
 *  ⚠ change() の直後、ヘッダー・通気口の中身(MW)は ResizeObserver 経由の再描画が追いつくまで 1〜数コマ古いまま
 *  (実測: 1489 幅で 2 コマ、レバーが 276px 左にずれる)。そのため区画の幅が変わる間は複製で見た目を押さえ、
 *  右端の部品が元の画面位置に戻った(=描き直しが済んだ)のを確かめてから、新しい配置の複製を作る / 本物に戻す。 */
import { zoneOf } from './motion';
import type { Kind } from './motion';
import { runs } from './run';
import type { Run } from './run';
import { sidebarClose, sidebarOpen } from './sidebar';
import { headerClose, headerOpen } from './header';

export { PHASE_DUR, PHASE_GAP, CARRIAGE_LAG, CARRIAGE_DUR } from './motion';
export { splitZone } from './split';
;
export { cancelRelayout } from './run';

export function relayoutZones(app: HTMLElement, change: () => void, kind: Kind, reduced: boolean): void {
  const cur = runs.get(app);
  if (cur) {
    // 動きの最中: 同じ種類の 2 回目は無視(状態も変えない)。別の種類は 1 つだけ控えて後で行う
    if (cur.kind !== kind && !cur.queued) cur.queued = { change, start: () => relayoutZones(app, change, kind, reduced) };
    return;
  }
  const src = zoneOf(app, kind === 'hdr' ? 'header' : 'sidebar');
  // 動きを減らす / 区画が無い / WAAPI が無い: 即時に切り替えるだけ
  if (reduced || !src || typeof src.animate !== 'function') { change(); return; }

  const run: Run = { kind, change, changed: false, dead: false, timers: [], rafs: [], anims: [], restores: [], queued: null };
  runs.set(app, run);
  app.setAttribute('data-relayout', kind);
  if (kind === 'hdr') {
    if (src.hasAttribute('data-collapsed')) headerOpen(app, run, src); else headerClose(app, run, src);
  } else if (src.hasAttribute('data-open')) sidebarClose(app, run, src);
  else sidebarOpen(app, run);
}
