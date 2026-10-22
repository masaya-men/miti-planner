import { createContext, useContext } from 'react';

/** ヘッダー縮小率(サイドバー開状態の幅で固定)と、サイドバーの開閉状態。MilspecLayout が配る */
export const MilspecHeaderScaleContext = createContext<{ scale: number; sidebarOpen: boolean }>({ scale: 1, sidebarOpen: true });
export const useMilspecHeaderScale = () => useContext(MilspecHeaderScaleContext);
