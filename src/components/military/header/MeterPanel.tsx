import React from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecLed, MilspecStencil, MilspecMark } from '../MilspecDecor';
import { headerLayout } from '../headerGeometry';
import { useTurbineCluster } from '../useTurbineCluster';
import { pulse, setFxSignalListener } from '../fx/engine';
import { usePlanStore } from '../../../store/usePlanStore';
import { useAuthStore } from '../../../store/useAuthStore';
import { onPower } from '../power/power';

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
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** 軍隊式の日時(DTG)。端末のローカル時刻 → 日 2 + 時 2 + 分 2 の 6 桁と、月・曜日の英字 3 文字(言語設定に関係なく英語大文字) */
export function dtgOf(d: Date): { digits: number[]; month: string; dow: string } {
  return {
    digits: (pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes())).split('').map(Number),
    month: MONTHS[d.getMonth()],
    dow: WEEKDAYS[d.getDay()],
  };
}
const ZERO_DTG = { digits: [0, 0, 0, 0, 0, 0], month: '---', dow: '---' };
const DRUM_NUMS = Array.from({ length: 10 }, (_, n) => n);

/** ドラム時計(DTG)。今の日時 211405 OCT TUE。値が変わるのは分が変わるときだけ。1 秒ごとに見て変化時のみ setState・タブ非表示で止め、戻ったら現在値へ */
function MissionClock({ x, y }: { x: number; y: number }) {
  const [dtg, setDtg] = React.useState<{ digits: number[]; month: string; dow: string }>(() => ZERO_DTG);
  const keyRef = React.useRef('');
  // 電源投入の転がり(見本 js:1168-1169): 'zero' = transition なしで 0 / 'run' = 桁ごとに長い transition で現在値へ
  const [roll, setRoll] = React.useState<'zero' | 'run' | null>(null);
  const rollRef = React.useRef<'zero' | 'run' | null>(null);
  React.useEffect(() => {
    let id: number | null = null;
    const tick = () => {
      const v = isPowered() && rollRef.current !== 'zero' ? dtgOf(new Date()) : ZERO_DTG; // 見本: 電源 off・転がり前は全部 0
      const k = v.digits.join('') + v.month + v.dow;
      if (k === keyRef.current) return; // 分が変わるまで setState しない
      keyRef.current = k;
      setDtg(v);
    };
    const run = () => { if (id == null) { tick(); id = window.setInterval(tick, 1000); } };
    const halt = () => { if (id != null) { window.clearInterval(id); id = null; } };
    const onVis = () => { if (document.hidden) halt(); else run(); };
    document.addEventListener('visibilitychange', onVis);
    if (!document.hidden) run();
    const timers: number[] = [];
    const set = (v: 'zero' | 'run' | null) => { rollRef.current = v; setRoll(v); };
    const offPower = onPower((e) => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.length = 0;
      if (e.state === 'off') { set(null); tick(); return; }
      if (e.reduced) return;
      set('zero');
      tick();
      timers.push(window.setTimeout(() => {
        set('run');
        tick();
        timers.push(window.setTimeout(() => set(null), 2200));
      }, 380));
    });
    return () => { offPower(); timers.forEach((t) => window.clearTimeout(t)); document.removeEventListener('visibilitychange', onVis); halt(); };
  }, []);
  const d = dtg.digits;
  const drum = (k: number) => (
    <span className="milspec-dr" key={k}>
      <i style={{ ['--v' as string]: d[k], ...(roll === 'zero' ? { transition: 'none' } : roll === 'run' ? { transition: `transform ${1.1 + k * 0.12}s cubic-bezier(.7,0,.2,1)` } : null) } as React.CSSProperties}>{DRUM_NUMS.map((n) => <span key={n}>{n}</span>)}</i>
    </span>
  );
  return (
    <>
      <div className="milspec-drums" style={{ left: x, top: y }} aria-hidden="true">
        {drum(0)}{drum(1)}<span className="milspec-dr-gap" />{drum(2)}{drum(3)}{drum(4)}{drum(5)}
      </div>
      <div className="milspec-dtg-txt" style={{ left: x + 66, top: y + 2 }} aria-hidden="true">
        <span className="milspec-dtg-mon">{dtg.month}</span>
        <span className="milspec-dtg-dow">{dtg.dow}</span>
      </div>
    </>
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
  const { t } = useTranslation();
  // 電源投入の 1000ms 後に TRB を自動で押す(見本 js:1178)。動きを減らす場合は演出なし
  const turbineRef = React.useRef(turbine);
  turbineRef.current = turbine;
  React.useEffect(() => {
    let id: number | undefined;
    const off = onPower((e) => {
      window.clearTimeout(id);
      if (e.state !== 'on' || e.reduced) return;
      id = window.setTimeout(() => { if (!turbineRef.current.active) turbineRef.current.start(); }, 1000);
    });
    return () => { off(); window.clearTimeout(id); };
  }, []);

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
      <button type="button" className="milspec-tsw" aria-label={t('milspec.hdr_turbine_start')} style={{ left: h3.trb.x, top: h3.trb.y }} onClick={turbine.start} disabled={turbine.active}>
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
          <MilspecStencil en="DTG" style={{ left: h3.clockLabel.x, top: h3.clockLabel.y }} />
        </>
      )}
      <MilspecMark text="H3" style={{ left: h3.id.x, top: h3.id.y }} />
    </>
  );
}
