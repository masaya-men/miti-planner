import React from 'react';
import { usePlanStore } from '../../store/usePlanStore';
import { matchesMobile } from '../../hooks/useIsMobile';

/** PC サイドバーの開閉。プラン未選択なら強制オープン、それ以外は localStorage に記憶する。 */
export function useSidebarOpenState() {
    const plans = usePlanStore(s => s.plans);
    const currentPlanId = usePlanStore(s => s.currentPlanId);
    // サイドバー開閉: プラン未選択なら強制オープン、それ以外はlocalStorage記憶
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(() => {
        if (typeof window === 'undefined') return true;
        if (matchesMobile(window)) return false;
        const stored = localStorage.getItem('lopo_sidebar_open');
        return stored !== null ? stored === 'true' : true;
    });
    // 開閉を記憶
    const handleToggleSidebar = () => {
        const next = !isSidebarOpen;
        setIsSidebarOpen(next);
        localStorage.setItem('lopo_sidebar_open', String(next));
    };
    // 開閉して記憶(キーボード操作用。軍事レイアウト中は動き付きの setter に差し替わる)
    const setSidebarPersisted = (open: boolean) => {
        setIsSidebarOpen(open);
        localStorage.setItem('lopo_sidebar_open', String(open));
    };
    const closeSidebar = () => { setIsSidebarOpen(false); localStorage.setItem('lopo_sidebar_open', 'false'); };
    // プラン0件なら強制的に開く
    React.useEffect(() => {
        if (plans.length === 0 || !currentPlanId) setIsSidebarOpen(true);
    }, [plans.length, currentPlanId]);

    return { isSidebarOpen, setIsSidebarOpen, handleToggleSidebar, setSidebarPersisted, closeSidebar };
}
