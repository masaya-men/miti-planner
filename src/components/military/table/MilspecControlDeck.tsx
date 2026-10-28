import React from 'react';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { MilspecArmor } from '../MilspecArmor';
import { MilspecKey } from '../MilspecKey';
import { MilspecStencil } from '../MilspecDecor';
import { MilspecFxLayer } from '../fx/MilspecFxLayer';
import { trafficBp } from '../fx/engine';
import { MsIcon } from '../milspecIcons';
import { bbox } from '../armor/geom';
import type { CapSpec } from '../armor/types';
import { MilspecHRocker, MilspecHSlide } from './MilspecSwitches';
import {
  BOARD_FRAME, DECK_ACC, DECK_COLS, DECK_FRAME, DECK_H, DECK_W, aaCaps, boardPanel, deckPanel, trCaps, urCaps,
} from './deckGeometry';
import './milspecDeck.css';
// 副作用 import: i18next の初期化(単体テストの安全網。実アプリでは起動時に初期化済み)
import '../../../i18n';
import { leakTrace } from './milspecControlDeckTraces';
import './MilspecControlDeck.css';

// 表の操作列(見本 v11 js:942-962)。Timeline の controlBar 内側のうち「表を展開 〜 軽減の削除メニュー」を
// 軍事テーマの装甲・横スライド・横ロッカー・キーに置き換える。状態は持たず、値と関数は Timeline から受け取る
// (標準の操作列のボタンと同じストア操作)。ジョブ行(JobPickerRow)は Timeline が続けて置く。

export interface MilspecControlDeckProps {
  /** 表を展開(横スライド)。押された状態 = 空行も出している = !hideEmptyRows */
  hideEmptyRows: boolean;
  onToggleHideEmpty: () => void;
  isMemoMode: boolean;
  onToggleMemo: () => void;
  showRowBorders: boolean;
  onToggleRowBorders: () => void;
  /** PiP(表示切替)。未対応のブラウザでは出さない */
  pipSupported: boolean;
  /** PiP 窓が開いている */
  pipActive: boolean;
  /** PiP メニューの開き位置の基準(ロッカーの枠) */
  pipMenuRef: RefObject<HTMLDivElement | null>;
  onPipEnter: () => void;
  onPipLeave: () => void;
  onPipClick: () => void;
  recastRowVisible: boolean;
  onToggleRecast: () => void;
  isAaModeEnabled: boolean;
  onAaClick: () => void;
  /** AA 設定ポップオーバーの基準(キーの button) */
  aaKeyRef: RefObject<HTMLButtonElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearClick: () => void;
  /** 軽減の削除メニューの基準(キーの button) */
  clearKeyRef: RefObject<HTMLButtonElement | null>;
}

/** キーは cap の bbox の位置に置く(列の箱は幅高さ 0) */
const capPos = (cap: CapSpec): React.CSSProperties => {
  const b = bbox(cap.pts);
  return { left: b.x, top: b.y };
};

export function MilspecControlDeck(p: MilspecControlDeckProps) {
  const { t } = useTranslation();
  const panels = React.useMemo(() => [deckPanel()], []);
  const boardPanels = React.useMemo(() => [boardPanel()], []);

  // 見本の固定寸法(570px)を、表の左 6 列ぶんの実幅へ縮める(狭い画面で右のジョブ行に重ならないように)
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  // 漏れ光は操作列全体(= 親 #timeline-controls-inner)の幅 + 左右の張り出し 10px まで伸ばす
  const [rowW, setRowW] = React.useState(0);
  React.useLayoutEffect(() => {
    const host = wrapRef.current?.parentElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const apply = () => setRowW((prev) => (prev === host.clientWidth ? prev : host.clientWidth));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);
  React.useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const apply = (w: number) => {
      if (w <= 0) return;
      const s = Math.min(1, (w + 10) / DECK_W);
      setScale((prev) => (Math.abs(prev - s) < 0.001 ? prev : s));
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((es) => { const w = es[es.length - 1]?.contentRect.width; if (typeof w === 'number') apply(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** スイッチ(ロッカー): 押すとジョブの基板へ光 */
  const sw = (fn: () => void) => () => { fn(); trafficBp(260); };
  /** キー: 押すとジョブの基板へ光(見本 data-bus="bp") */
  const key = (fn: () => void) => () => { fn(); trafficBp(150); };

  const aaName = t('aa_settings.title');
  const undoName = t('timeline.undo');
  const redoName = t('timeline.redo');
  const clearName = t('timeline.clear_mitigations');
  const recastName = t('timeline.recast_row.label');
  const bordersName = t('milspec.tbl_borders');
  const pipName = t('milspec.tbl_pip');
  const memoName = t('memo.mode_toggle_label');
  const expandName = t('app.fab_expand');

  return (
    <>
      <div className="milspec-deck" ref={wrapRef} data-milspec-deck>
        {/* 装甲の左上 = 見本の区画の原点(表の左端より 10px 左) */}
        <div className="milspec-deck-o" style={{ width: DECK_W, height: DECK_H, transform: scale < 1 ? `scale(${scale})` : undefined }}>
          <MilspecArmor id="deck" frame={DECK_FRAME} panels={panels} />
          <MilspecFxLayer traces={leakTrace(Math.max(DECK_W, (rowW + 10) / scale))} />

          <div className="milspec-grp" style={{ left: 12, top: 2.5, width: 312 }}>
            <MilspecStencil en="TABLE DISPLAY" sub={t('milspec.tbl_display_sub')} hi style={{ position: 'static' }} />
          </div>
          <div className="milspec-deck-at" style={{ left: 14, top: 11 }}>
            <MilspecHSlide label={expandName} ariaLabel={expandName} checked={!p.hideEmptyRows} deckId="expand"
              onToggle={() => { p.onToggleHideEmpty(); trafficBp(560); }} />
          </div>
          <div className="milspec-deck-at" style={{ left: 72, top: 11, display: 'flex', gap: 13 }}>
            <MilspecHRocker label={memoName} ariaLabel={memoName} checked={p.isMemoMode} deckId="memo" onToggle={sw(p.onToggleMemo)} />
            <MilspecHRocker label={bordersName} ariaLabel={bordersName} checked={p.showRowBorders} deckId="borders" onToggle={sw(p.onToggleRowBorders)} />
            {p.pipSupported && (
              <MilspecHRocker label={pipName} ariaLabel={pipName} checked={p.pipActive} deckId="pip" onToggle={sw(p.onPipClick)}
                wrapRef={p.pipMenuRef} onMouseEnter={p.onPipEnter} onMouseLeave={p.onPipLeave} />
            )}
            <MilspecHRocker label={recastName} ariaLabel={recastName} checked={p.recastRowVisible} deckId="recast" onToggle={sw(p.onToggleRecast)} />
          </div>

          <div className="milspec-grp" style={{ left: 342, top: 2.5, width: 216 }}>
            <MilspecStencil en="EDIT" sub={t('milspec.tbl_edit_sub')} hi style={{ position: 'static' }} />
          </div>
          <div className="milspec-deck-kc" style={{ left: DECK_COLS.aa.x, top: DECK_COLS.aa.y }}>
            <MilspecKey cap={aaCaps[0]} style={capPos(aaCaps[0])} ref={p.aaKeyRef} data-deck="aa" aria-label={aaName} title={aaName}
              pressed={p.isAaModeEnabled} label={<>{MsIcon.aa()}<b>{aaName}</b></>} onClick={key(p.onAaClick)} />
          </div>
          <div className="milspec-deck-kc" style={{ left: DECK_COLS.ur.x, top: DECK_COLS.ur.y }}>
            <MilspecKey cap={urCaps[0]} style={capPos(urCaps[0])} className="milspec-key-ic" data-deck="undo" aria-label={undoName} title={undoName}
              disabled={!p.canUndo || p.readOnly} label={MsIcon.undo()} onClick={key(p.onUndo)} />
            <MilspecKey cap={urCaps[1]} style={capPos(urCaps[1])} className="milspec-key-ic" data-deck="redo" aria-label={redoName} title={redoName}
              disabled={!p.canRedo || p.readOnly} label={MsIcon.redo()} onClick={key(p.onRedo)} />
          </div>
          <div className="milspec-deck-kc" style={{ left: DECK_COLS.tr.x, top: DECK_COLS.tr.y }}>
            <MilspecKey cap={trCaps[0]} style={capPos(trCaps[0])} ref={p.clearKeyRef} className="milspec-key-dng milspec-key-ic" data-deck="clear"
              aria-label={clearName} title={clearName} disabled={p.readOnly} label={MsIcon.trash()} onClick={key(p.onClearClick)} />
          </div>
          <span className="milspec-acc" style={{ left: DECK_ACC.x, top: DECK_ACC.y, width: DECK_ACC.w, height: DECK_ACC.h }} aria-hidden="true" />
        </div>
      </div>
      {/* 副装甲: ジョブの基板の床の窪み。ジョブ行(JobPickerRow)の下に敷く */}
      <div className="milspec-deck-bp" aria-hidden="true">
        <MilspecArmor id="deck-bp" frame={BOARD_FRAME} panels={boardPanels} />
      </div>
    </>
  );
}
