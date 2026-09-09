import React from 'react';

/**
 * MIL-SPEC のツール/HUD ボタン(mockup .tool-btn / .hud-btn)の中身。
 * 四隅ビス + インジケータ球 + アイコン枠 + EN/JP 2 段ラベル。
 * 標準コンポーネント(ImportMenu 等)へ `children` として流し込み、外観だけをモックに寄せる。
 * 正典: milspec-mockup.html DOM 1974-1977 / 2067-2079。
 */
export const MilspecTileInner: React.FC<{
  icon: React.ReactNode;
  en: string;
  jp: string;
}> = ({ icon, en, jp }) => (
  <>
    <span className="milspec-bolt tl" />
    <span className="milspec-bolt br" />
    <span className="milspec-lamp" />
    <span className="icf">{icon}</span>
    <span className="lbl">
      <span className="en">{en}</span>
      <span className="jp">{jp}</span>
    </span>
  </>
);
