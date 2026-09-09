import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useMitigationStore } from '../../store/useMitigationStore';

/** モック .workspace = 浮いた raised 大装甲板。中の .milspec-ws-screen に既存 Timeline(SP1) を埋め込む。
 *  SP2 でこの中身を MilspecTable に差し替える。
 *  正典: docs/.private/theme-refs/milspec-mockup.html — .workspace(1048-1057) / .ws-screen(1063-1068) /
 *  .ws-cap/.ws-note(1191-1198) / DOM(2123-2213)。 */
export const MilspecWorkspace: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 可視パーティメンバー数(Timeline.tsx:2595 の visiblePartyMembers と同じ定義)。
  // useShallow で { partyMembers, hiddenPartyMemberIds } を浅く購読 → .filter() は component 内で
  // 計算(bare selector から新配列を返すと毎レンダー再購読 → 無限ループになるため)。
  const { partyMembers, hiddenPartyMemberIds } = useMitigationStore(
    useShallow((s) => ({ partyMembers: s.partyMembers, hiddenPartyMemberIds: s.hiddenPartyMemberIds })),
  );
  const visibleCount = partyMembers.filter((m) => !hiddenPartyMemberIds.includes(m.id)).length;

  return (
    <div className="milspec-ws milspec-chan">
      <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
      <span className="milspec-bolt bl" /><span className="milspec-bolt br" />
      <span className="milspec-sc tl milspec-ws-code-l">WKS-07</span>
      <span className="milspec-sc br milspec-ws-code-r">RAID OPERATIONS PLOT · MITIGATION ARRAY</span>
      <span className="milspec-hash" style={{ bottom: 8, top: 'auto', left: 16, right: 'auto' }} />
      <div className="milspec-ws-screen">{children}</div>
      {/* モック .ws-cap/.ws-note — 表の右端(埋まっていないメンバー枠の分)の空白を機能的に締める
          端末キャップ + テレメトリ。固定英字デカール(i18n 外・SP1 Q6)。 */}
      <span className="milspec-ws-cap" aria-hidden />
      <div className="milspec-ws-note" aria-hidden>
        {`ROSTER ${visibleCount} / 8`}
        <br />
        {visibleCount >= 8 ? 'FULL PARTY' : `SLOTS ${8 - visibleCount} OPEN`}
      </div>
    </div>
  );
};
