import React from 'react';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';
import { MilspecArmor } from '../MilspecArmor';
import { MilspecFxLayer } from '../fx/MilspecFxLayer';
import { headerLayout, mwFor, HDR_BASE_MW } from '../headerGeometry';
import { pulse, isFxActive } from '../fx/engine';
import { useMilspecHeaderScale } from '../headerScaleContext';
import { HeaderLogo } from './HeaderLogo';
import { Nameplate } from './Nameplate';
import { useNameplateText } from './useNameplateText';
import { MeterPanel } from './MeterPanel';
import { AuxPanel } from './AuxPanel';
import { PartyOps } from './PartyOps';
// 副作用 import: i18next の初期化(単体テストの安全網。実アプリでは起動時に初期化済み)
import '../../../i18n';

export interface MilspecHeaderV11Props {
  theme: 'dark' | 'light';
  /** 昼夜切替。setTheme を直接呼ぶ関数(走査線ワイプのあとで呼ばれる。runTransition 版ではない) */
  onToggleTheme: () => void;
  partySortOrder: 'light_party' | 'role';
  setPartySortOrder: (o: 'light_party' | 'role') => void;
  onAutoPlan: () => void;
  onImportLogs: () => void;
  statusOpen: boolean;
  setStatusOpen: (open: boolean) => void;
}

/**
 * v11 ヘッダー(見本 js:863-927)。装甲・光の経路・H1〜H5 を、ヘッダー区画の内箱に絶対座標で置く。
 * 区画の実幅 MW は mwFor(実幅 ÷ 縮小率、1189 未満にしない)で求める(縮小率はサイドバー開状態の幅で固定)。
 * LanguageSwitcher が useTransitionOverlay を使うため、TransitionOverlayProvider をここで持つ(ModeLever は電源スイッチで、標準へは powerOff → setThemeStyle で戻る)。
 */
/** 下の板の奥の基板(drw:1〜6)を走る粒。AMB(常時の抽選)には入れず、ここで独自に打つ */
export const DRW_PULSE = { minMs: 900, maxMs: 2200, len: 9, speed: 3.4 };

export function MilspecHeaderV11(props: MilspecHeaderV11Props) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const { scale, sidebarOpen } = useMilspecHeaderScale();
  const [zw, setZw] = React.useState(0);
  const mw = React.useMemo(() => mwFor(zw, scale), [zw, scale]);

  // 区画(内箱の親)の実幅を測る。縮小の内箱の外で測るので、縮小しても MW は変わらない
  React.useLayoutEffect(() => {
    const zone = rootRef.current?.closest('[data-ms-zone="header"]') as HTMLElement | null;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number) => { if (w > 0) setZw(Math.round(w)); };
    apply(zone.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => { const w = es[es.length - 1]?.contentRect.width; if (typeof w === 'number') apply(w); });
    ro.observe(zone);
    return () => ro.disconnect();
  }, []);

  const L = React.useMemo(() => headerLayout(mw, { sidebarOpen, scale }), [mw, sidebarOpen, scale]);
  // headerLayout の panels は MW で伸ばし済み・frame は「伸ばし終わった」印(sx: 9999)。そのまま渡す
  const frame = L.frame;

  // 基板の粒: 窓が開いている(MW が基準より広い)ときだけ、0.9〜2.2 秒おきに 1 本。動きを減らす設定・電源 off・非表示は isFxActive が見る
  const wide = mw > HDR_BASE_MW;
  React.useEffect(() => {
    if (!wide) return;
    let n = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (isFxActive()) pulse(`drw:${1 + (n++ % 6)}`, { len: DRW_PULSE.len, speed: DRW_PULSE.speed, cls: '' });
      timer = setTimeout(tick, DRW_PULSE.minMs + Math.random() * (DRW_PULSE.maxMs - DRW_PULSE.minMs));
    };
    timer = setTimeout(tick, DRW_PULSE.minMs + Math.random() * (DRW_PULSE.maxMs - DRW_PULSE.minMs));
    return () => clearTimeout(timer);
  }, [wide]);
  const { title, sub } = useNameplateText();

  return (
    <TransitionOverlayProvider>
      <div ref={rootRef} className="milspec-hdrx" data-milspec-header>
        <MilspecArmor id="hdr" frame={frame} panels={L.panels} />
        <MilspecFxLayer traces={L.traces} />
        <div className="milspec-hdrx-top">
          <HeaderLogo />
          <Nameplate title={title} sub={sub} />
          <MeterPanel ix={L.meter.ix} iw={L.meter.iw} showClock={L.meter.showClock} />
          <AuxPanel MW={mw} theme={props.theme} onToggleTheme={props.onToggleTheme} />
          <PartyOps
            MW={mw}
            partySortOrder={props.partySortOrder}
            setPartySortOrder={props.setPartySortOrder}
            onAutoPlan={props.onAutoPlan}
            onImportLogs={props.onImportLogs}
            statusOpen={props.statusOpen}
            setStatusOpen={props.setStatusOpen}
          />
        </div>
      </div>
    </TransitionOverlayProvider>
  );
}
