import React from 'react';
import { MilspecLed, MilspecStencil, MilspecMark } from '../MilspecDecor';
import { headerLayout } from '../headerGeometry';
import { useTurbineCluster } from '../useTurbineCluster';
import { pulse, setFxSignalListener } from '../fx/engine';
import { usePlanStore } from '../../../store/usePlanStore';
import { useAuthStore } from '../../../store/useAuthStore';

// H3 計器(見本 js:880-889 の部品群)。タービン 2 基・TRB・ランプ 4 個・ドラム時計・刻印。
// 親は「ヘッダー区画」(position:absolute の座標系)。座標は headerLayout の decor.h3。

type LedState = 'off' | 'on' | 'warn' | 'dng';

/** SYNC ランプの状態(決定事項): 保存済み = 緑 / 保存中・未保存 = 琥珀 / エラー = 赤 / 未ログイン = 消灯 */
export function syncLampState(s: { loggedIn: boolean; status: 'idle' | 'syncing' | 'synced' | 'error'; dirty: boolean }): LedState {
  if (!s.loggedIn) return 'off';
  if (s.status === 'error') return 'dng';
  if (s.status === 'syncing' || s.dirty) return 'warn';
  return 'on';
}

const isPowered = () => document.documentElement.dataset.msPower !== 'off';
const pad2 = (n: number) => String(n).padStart(2, '0');
/** 経過秒 → 6 桁(時 2 + 分 2 + 秒 2。見本 tick) */
const digitsOf = (s: number): number[] =>
  (pad2(Math.floor(s / 3600) % 100) + pad2(Math.floor(s / 60) % 60) + pad2(s % 60)).split('').map(Number);
// 時計の起点 = 画面を開いた時刻(幅の変化などで MeterPanel が作り直されても 0 に戻らない)
let T0 = Date.now();
/** テスト用: 時計の起点を今に戻す */
export const resetMissionClock = () => { T0 = Date.now(); };
const DRUM_NUMS = Array.from({ length: 10 }, (_, n) => n);

/** ドラム時計(MSN CLOCK)。画面を開いてからの経過時間。1 秒ごと・タブ非表示で止め、戻ったら追いつく */
function MissionClock({ x, y }: { x: number; y: number }) {
  const [d, setD] = React.useState<number[]>(() => digitsOf(0));
  React.useEffect(() => {
    let id: number | null = null;
    const tick = () => {
      const s = Math.max(0, Math.floor((Date.now() - T0) / 1000));
      setD(isPowered() ? digitsOf(s) : digitsOf(0)); // 見本: 電源 off では全部 0
    };
    const run = () => { if (id == null) { tick(); id = window.setInterval(tick, 1000); } };
    const halt = () => { if (id != null) { window.clearInterval(id); id = null; } };
    const onVis = () => { if (document.hidden) halt(); else run(); };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) run();
    return () => { document.removeEventListener('visibilitychange', onVis); halt(); };
  }, []);
  const drum = (k: number) => (
    <span className="milspec-dr" key={k}>
      <i style={{ ['--v' as string]: d[k] } as React.CSSProperties}>{DRUM_NUMS.map((n) => <span key={n}>{n}</span>)}</i>
    </span>
  );
  return (
    <div className="milspec-drums" style={{ left: x, top: y }} aria-hidden="true">
      {drum(0)}{drum(1)}<span className="milspec-colon" />{drum(2)}{drum(3)}<span className="milspec-colon" />{drum(4)}{drum(5)}
    </div>
  );
}

function Lamp({ id, state, label, blink }: { id: string; state: LedState; label: string; blink?: boolean }) {
  return (
    <span className="milspec-h3-lamp" data-lamp={id}>
      <MilspecLed state={state} size={8} blink={blink} />
      <MilspecStencil en={label} hi />
    </span>
  );
}

/** ix, iw = H3 の左端と幅(headerLayout の meter)。showClock = 幅 300 以上のときだけ時計を出す */
export function MeterPanel({ iw, showClock }: { ix: number; iw: number; showClock: boolean }) {
  // 区画の実幅 MW = iw + 879(headerGeometry と同じ関係)から座標表を引く
  const h3 = React.useMemo(() => headerLayout(iw + 879).decor.h3, [iw]);
  const turbine = useTurbineCluster(2, { motion: 'v11', onBeat: () => { pulse('h3', { cls: 'warn', len: 10 }); } });

  // SYNC: SyncButton と同じ store の値(クラウド状態・ログイン)+ 未保存の有無
  const loggedIn = useAuthStore((s) => !!s.user);
  const status = usePlanStore((s) => s._cloudStatus);
  const dirty = usePlanStore((s) => s._dirtyPlanIds.size > 0 || s._deletedPlanIds.size > 0);
  const sync = syncLampState({ loggedIn, status, dirty });

  // NET: 光が走るたびに 60ms 点灯(見本 netBlink)。購読はアンマウントで解除
  const [netOn, setNetOn] = React.useState(false);
  React.useEffect(() => {
    let t: number | null = null;
    setFxSignalListener(() => {
      setNetOn(true);
      if (t != null) window.clearTimeout(t);
      t = window.setTimeout(() => { t = null; setNetOn(false); }, 60);
    });
    return () => { setFxSignalListener(null); if (t != null) window.clearTimeout(t); };
  }, []);

  return (
    <>
      <button type="button" className="milspec-tsw" aria-label="タービン起動" style={{ left: h3.trb.x, top: h3.trb.y }} onClick={turbine.start} disabled={turbine.active}>
        <span className="milspec-tsw-cap">
          <MilspecLed state={turbine.active ? 'warn' : 'off'} size={5} />
          <em>TRB</em>
        </span>
      </button>
      {h3.turbines.map((p, i) => (
        <div className="milspec-tpk" key={i} ref={turbine.frameRefs[i]} style={{ left: p.x, top: p.y }} aria-hidden="true">
          <span className="milspec-h3-turbine"><span className="milspec-h3-vanes" ref={turbine.vaneRefs[i]} /><span className="milspec-h3-hub" /></span>
        </div>
      ))}
      <div className="milspec-h3-lamps" style={{ left: h3.lamps.x, top: h3.lamps.y }}>
        <Lamp id="sys" state="on" label="SYS" />
        <Lamp id="sync" state={sync} label="SYNC" />
        <Lamp id="net" state={netOn ? 'on' : 'off'} label="NET" />
        <Lamp id="rec" state="warn" label="REC" blink />
      </div>
      <MilspecStencil en="⚠ ROTATING" style={{ left: h3.rotating.x, top: h3.rotating.y }} />
      {showClock && h3.clock && h3.clockLabel && (
        <>
          <MissionClock x={h3.clock.x} y={h3.clock.y} />
          <MilspecStencil en="MSN CLOCK" style={{ left: h3.clockLabel.x, top: h3.clockLabel.y }} />
        </>
      )}
      <MilspecMark text="H3" style={{ left: h3.id.x, top: h3.id.y }} />
    </>
  );
}
