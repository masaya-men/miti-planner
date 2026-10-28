import React from 'react';

// 窓がビューポート(タイムライン)からはみ出さないよう、表示位置を補正する。
export function useAdjustedPanelPosition(
    isOpen: boolean,
    panelRef: React.RefObject<HTMLDivElement | null>,
    position: { x: number; y: number },
    isMobile: boolean,
    isCentered: boolean,
) {
    const [adjustedPos, setAdjustedPos] = React.useState(position);

    // ビューポート内に収めるための計算
    React.useLayoutEffect(() => {
        if (!isOpen || !panelRef.current || isCentered || isMobile) {
            return;
        }

        const rect = panelRef.current.getBoundingClientRect();
        // タイムライン scroll container を基準に「タイムライン内に確実に収まる」位置を計算
        // (フッター高さ等を window.innerHeight から差し引かなくても、 タイムライン rect の
        // bottom がそのまま「フッター上端 = モーダルが置ける限界」になる)
        const timelineEl = document.querySelector('.timeline-scroll-container') as HTMLElement | null;
        const timelineRect = timelineEl?.getBoundingClientRect();
        const xMin = (timelineRect ? timelineRect.left : 0) + 12;
        const xMax = (timelineRect ? timelineRect.right : window.innerWidth) - 12;
        const yMin = (timelineRect ? timelineRect.top : 0) + 12;
        const yMax = (timelineRect ? timelineRect.bottom : window.innerHeight) - 12;

        let nx = position.x;
        let ny = position.y;

        // 右端チェック
        if (nx + rect.width > xMax) {
            nx = Math.max(xMin, xMax - rect.width);
        }
        // 下端チェック
        if (ny + rect.height > yMax) {
            ny = Math.max(yMin, yMax - rect.height);
        }

        // 差分がある場合のみ更新
        if (Math.abs(nx - adjustedPos.x) > 1 || Math.abs(ny - adjustedPos.y) > 1) {
            setAdjustedPos({ x: nx, y: ny });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adjustedPos は差分判定の読み取り専用。依存に入れると自分の setAdjustedPos で再実行されるため、開閉・位置・モバイル・中央表示が変わった時だけ走らせる
    }, [isOpen, position.x, position.y, isMobile, isCentered]);

    return adjustedPos;
}
