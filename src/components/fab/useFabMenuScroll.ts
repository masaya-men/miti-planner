import React from 'react';

export const useFabMenuScroll = (open: boolean) => {
    // メニューのスクロール可否（端のフェード + ↓ アイコン表示用）
    const menuRef = React.useRef<HTMLDivElement>(null);
    const [canScrollUp, setCanScrollUp] = React.useState(false);
    const [canScrollDown, setCanScrollDown] = React.useState(false);
    const updateScrollState = React.useCallback(() => {
        const el = menuRef.current;
        if (!el) return;
        setCanScrollUp(el.scrollTop > 0);
        setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
    }, []);
    React.useEffect(() => {
        if (!open) return;
        const timer = setTimeout(updateScrollState, 50);
        return () => clearTimeout(timer);
    }, [open, updateScrollState]);
    const menuMaskImage = React.useMemo(() => {
        const top = canScrollUp ? 'transparent 0, black 40px' : 'black 0';
        const bottom = canScrollDown ? 'black calc(100% - 40px), transparent 100%' : 'black 100%';
        return `linear-gradient(to bottom, ${top}, ${bottom})`;
    }, [canScrollUp, canScrollDown]);

    return { menuRef, canScrollDown, updateScrollState, menuMaskImage };
};
