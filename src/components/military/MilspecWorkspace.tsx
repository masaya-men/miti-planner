import React from 'react';
import { MilspecArmor } from './MilspecArmor';
import { MilspecMark } from './MilspecDecor';
import type { PlacedPanel, StretchFrame } from './armor/types';
import './table/milspecTable.css';

/** 見本 v11 js:965-967 の表の装甲。区画の基準幅 tw=1189・高さ th=483(=657-3-171)。
 *  横は x>600 の点・縦は y>300 の点が動く(右下の切り欠きと下辺が区画の実寸に追従する)。 */
const TW = 1189;
const TH = 483;
const TABLE_FRAME: StretchFrame = { w0: TW, h0: TH, sx: 600, sy: 300 };
const TABLE_PANELS: PlacedPanel[] = [{
  x: 0, y: 0, w: TW, h: TH,
  spec: {
    tone: 'pri', b: 4,
    pts: [[0, 0], [TW, 0], [TW, TH - 28], [TW - 28, TH], [18, TH], [0, TH - 18]],
    pockets: [{ b: 2.2, fill: 'var(--ma-screen-bg)', pts: [[7, 7], [TW - 7, 7], [TW - 7, TH - 31], [TW - 31, TH - 7], [21, TH - 7], [7, TH - 21]] }],
    wx: { chips: 0.7, grime: 0.5 },
  },
}];

/**
 * 表の区画(見本 v11 js:963-984 の zb)。
 * 装甲は「操作列の下端 + 4px 〜 区画の下端」に敷く(上の 44px = 操作列 40 + すき間 4 は
 * Timeline の外枠が占める)。表本体は Timeline がそのまま持つので、横スクロールは
 * 操作列・見出しと一緒に動き、装甲は区画の幅に固定される。
 */
export const MilspecWorkspace: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <div className="milspec-tbl-armor">
      <MilspecArmor id="tbl" frame={TABLE_FRAME} panels={TABLE_PANELS} />
      {/* 画面の縁の暗がり・四隅の印・刻印(見本 js:974-976 / css:543-546) */}
      <div className="milspec-vig" aria-hidden="true" />
      <span className="milspec-scr-mark tl" aria-hidden="true" />
      <span className="milspec-scr-mark tr" aria-hidden="true" />
      <span className="milspec-scr-mark bl" aria-hidden="true" />
      <span className="milspec-tbl-id" aria-hidden="true">
        <MilspecMark text="T-DISP" style={{ position: 'static' }} />
        <span className="milspec-dc">SCOPE 1 · TL-FEED</span>
      </span>
    </div>
    <div className="milspec-tbl-wrap">{children}</div>
  </>
);
