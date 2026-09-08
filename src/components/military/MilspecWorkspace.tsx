import React from 'react';

/** モック .workspace = 浮いた raised 大装甲板。中の .milspec-ws-screen に既存 Timeline(SP1) を埋め込む。
 *  SP2 でこの中身を MilspecTable に差し替える。
 *  正典: docs/.private/theme-refs/milspec-mockup.html — .workspace(1048-1057) / .ws-screen(1063-1068) / DOM(2123-2213)。 */
export const MilspecWorkspace: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="milspec-ws milspec-chan">
    <span className="milspec-bolt tl" /><span className="milspec-bolt tr" />
    <span className="milspec-bolt bl" /><span className="milspec-bolt br" />
    <span className="milspec-sc tl milspec-ws-code-l">WKS-07</span>
    <span className="milspec-sc br milspec-ws-code-r">RAID OPERATIONS PLOT · MITIGATION ARRAY</span>
    <span className="milspec-hash" style={{ bottom: 8, top: 'auto', left: 16, right: 'auto' }} />
    <div className="milspec-ws-screen">{children}</div>
  </div>
);
