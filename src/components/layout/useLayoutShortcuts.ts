import React from 'react';
import { pickCollapseSetter } from '../military/headerCollapseAnimator';
import { pickSidebarSetter } from '../military/sidebarToggleAnimator';

interface LayoutShortcutsArgs {
    isMobile: boolean;
    isSidebarOpen: boolean;
    isHeaderCollapsed: boolean;
    setSidebarPersisted: (open: boolean) => void;
    setIsHeaderCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

// キーボードショートカット（PCのみ）
// F: フォーカスモード（サイドバー+ヘッダー両方非表示/復元）
// S: サイドバー開閉
// H: ヘッダー開閉
// P/T/L/A: Timeline.tsx側で処理
export function useLayoutShortcuts({ isMobile, isSidebarOpen, isHeaderCollapsed, setSidebarPersisted, setIsHeaderCollapsed }: LayoutShortcutsArgs): void {
    const focusModeRef = React.useRef(false);
    React.useEffect(() => {
        const handleShortcut = (e: KeyboardEvent) => {
            if (isMobile) return;
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key.toLowerCase();
            if (key === 's') {
                e.preventDefault();
                pickSidebarSetter(setSidebarPersisted)(!isSidebarOpen);
            } else if (key === 'h') {
                e.preventDefault();
                pickCollapseSetter(setIsHeaderCollapsed)(prev => !prev);
            } else if (key === 'f') {
                e.preventDefault();
                if (!focusModeRef.current) {
                    // フォーカスモードに入る: サイドバー閉じ＋ヘッダー折りたたみ
                    pickSidebarSetter(setSidebarPersisted)(false);
                    pickCollapseSetter(setIsHeaderCollapsed)(true);
                    focusModeRef.current = true;
                } else {
                    // フォーカスモードから抜ける: 常にサイドバー開＋ヘッダー展開
                    pickSidebarSetter(setSidebarPersisted)(true);
                    pickCollapseSetter(setIsHeaderCollapsed)(false);
                    focusModeRef.current = false;
                }
            }
        };
        const handleExitFocus = () => {
            if (focusModeRef.current) {
                pickSidebarSetter(setSidebarPersisted)(true);
                pickCollapseSetter(setIsHeaderCollapsed)(false);
                focusModeRef.current = false;
            }
        };
        // チュートリアル等でキー操作の代わりにフォーカスモードへ入る (Fキー押下と同じ効果)。
        // タブレット/スマホはキーボードが無いため、タップから本イベントで発火させる。
        // PC/タブレット (非モバイル) のみ実フォーカスモードに入る。
        const handleEnterFocus = () => {
            if (isMobile) return;
            if (!focusModeRef.current) {
                pickSidebarSetter(setSidebarPersisted)(false);
                pickCollapseSetter(setIsHeaderCollapsed)(true);
                focusModeRef.current = true;
            }
        };
        window.addEventListener('keydown', handleShortcut);
        window.addEventListener('shortcut:exit-focus', handleExitFocus);
        window.addEventListener('shortcut:enter-focus', handleEnterFocus);
        return () => {
            window.removeEventListener('keydown', handleShortcut);
            window.removeEventListener('shortcut:exit-focus', handleExitFocus);
            window.removeEventListener('shortcut:enter-focus', handleEnterFocus);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- キー入力の登録は isMobile / サイドバー開閉 / ヘッダー折りたたみが変わった時だけ張り直す(setSidebarPersisted は毎回作り直される関数。入れると毎描画で張り直す)
    }, [isMobile, isSidebarOpen, isHeaderCollapsed]);
}
