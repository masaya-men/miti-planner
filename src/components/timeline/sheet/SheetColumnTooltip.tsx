// スプシ表示の本体: マウスがある列の技(アイコン+名前)を出し続けるツールチップ。
// 1 個だけ作り、本体の pointermove(Timeline)で列が変わったときに中身を差し替える。マス 1 つずつに DOM は作らない。
// 見た目と位置は LoPo の Tooltip と同じ(TOOLTIP_BOX_CLASS・placeTooltipPopup。MIL-SPEC はテーマ側で同じ箱が着替える)。
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Mitigation } from '../../../types';
import { getPhaseName } from '../../../types';
import { useThemeStore } from '../../../store/useThemeStore';
import { TOOLTIP_BOX_CLASS } from '../../ui/Tooltip';
import { placeTooltipPopup } from '../../ui/tooltipPlacement';

interface Props {
    def: Mitigation;
    /** 最初に出すときのカーソル位置(以降は document の pointermove で追従) */
    x: number;
    y: number;
}

export const SheetColumnTooltip: React.FC<Props> = ({ def, x, y }) => {
    const contentLanguage = useThemeStore(s => s.contentLanguage);
    const ref = useRef<HTMLDivElement>(null);
    const cursor = useRef({ x, y });
    const raf = useRef(0);

    // 列が変わって中身(幅)が変わったら、描画前に置き直す
    useLayoutEffect(() => {
        if (ref.current) placeTooltipPopup(ref.current, cursor.current.x, cursor.current.y);
    }, [def.id]);

    // カーソルに追従(React の再描画なし)
    useEffect(() => {
        const move = (e: PointerEvent) => {
            cursor.current = { x: e.clientX, y: e.clientY };
            cancelAnimationFrame(raf.current);
            raf.current = requestAnimationFrame(() => { if (ref.current) placeTooltipPopup(ref.current, cursor.current.x, cursor.current.y); });
        };
        document.addEventListener('pointermove', move);
        return () => { document.removeEventListener('pointermove', move); cancelAnimationFrame(raf.current); };
    }, []);

    const name = getPhaseName(def.name, contentLanguage);
    return createPortal(
        <div
            ref={ref}
            data-sheet-col-tooltip={def.id}
            className={`${TOOLTIP_BOX_CLASS} flex items-center gap-2`}
            style={{ position: 'fixed', zIndex: 99999, pointerEvents: 'none', left: x + 16, top: y }}
        >
            <img referrerPolicy="no-referrer" src={def.icon} alt="" draggable={false} className="w-5 h-5 object-contain shrink-0" />
            <span>{name}</span>
        </div>,
        document.body,
    );
};
