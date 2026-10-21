import React from 'react';
import { TransitionOverlayProvider } from '../../ui/TransitionOverlay';
import { MilspecArmor } from '../MilspecArmor';
import { MilspecFxLayer } from '../fx/MilspecFxLayer';
import { headerLayout, layoutMW } from '../headerGeometry';
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
 * 区画の実幅 MW は layoutMW で 1189 以上に丸める(それ未満は内箱の縮小で見せる)。
 * LanguageSwitcher が useTransitionOverlay を使うため、TransitionOverlayProvider をここで持つ(ModeLever は電源スイッチで、標準へは powerOff → setThemeStyle で戻る)。
 */
export function MilspecHeaderV11(props: MilspecHeaderV11Props) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [mw, setMw] = React.useState(layoutMW(0));

  // 区画(内箱の親)の実幅を測る。縮小の内箱の外で測るので、縮小しても MW は変わらない
  React.useLayoutEffect(() => {
    const zone = rootRef.current?.closest('[data-ms-zone="header"]') as HTMLElement | null;
    if (!zone || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number) => { if (w > 0) setMw((p) => { const n = layoutMW(Math.round(w)); return n === p ? p : n; }); };
    apply(zone.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => { const w = es[es.length - 1]?.contentRect.width; if (typeof w === 'number') apply(w); });
    ro.observe(zone);
    return () => ro.disconnect();
  }, []);

  const L = React.useMemo(() => headerLayout(mw), [mw]);
  // headerLayout の panels は MW で伸ばし済み。装甲は親の実寸でもう一度伸ばすので、基準幅を今の MW にして二重に伸ばさない
  const frame = React.useMemo(() => ({ ...L.frame, w0: mw }), [L, mw]);
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
