// 表のホバー強調。要素は 1 個だけ。pointermove で位置を直接書き換える(React の再描画なし・マス 1 つずつの DOM なし)。
// ふつう表示=カーソルのあるジョブのレーン全体 / スプシ表示=セル 1 つ。色は sheet.css の .table-hover-hl(標準 / MIL-SPEC)。
import React, { useEffect, useRef } from 'react';
import type { RowLayout } from '../rowLayout';
import type { SheetColumn } from './sheetColumns';
import { hoverBox } from './hoverBox';

export interface HoverGeom {
    mode: 'lanes' | 'sheet';
    bands: readonly { id: string; left: number; width: number }[];
    columnMap: ReadonlyMap<string, SheetColumn[]> | null;
    layout: RowLayout;
}

interface Props {
    /** 表の容器(位置の基準・pointermove を聞く相手) */
    containerRef: React.RefObject<HTMLElement | null>;
    /** 最新の幾何(毎 render 差し替える ref) */
    geomRef: React.RefObject<HoverGeom>;
}

export const TableHoverHighlight: React.FC<Props> = ({ containerRef, geomRef }) => {
    const elRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        const el = elRef.current;
        if (!container || !el) return;
        const hide = () => { el.style.display = 'none'; };
        let last: { x: number; y: number } | null = null; // 最後のポインタ位置(client 座標)
        let raf = 0;
        const place = () => {
            if (!last) return;
            const g = geomRef.current;
            const rect = container.getBoundingClientRect();
            const box = hoverBox(g.mode, last.x - rect.left, last.y - rect.top, g.bands, g.columnMap, g.layout);
            if (!box) { hide(); return; }
            el.style.display = 'block';
            el.style.transform = `translate(${box.left}px, ${box.top}px)`;
            el.style.width = `${box.width}px`;
            el.style.height = `${box.height}px`;
        };
        const move = (e: PointerEvent) => {
            if (e.pointerType === 'touch') { last = null; hide(); return; }
            last = { x: e.clientX, y: e.clientY };
            place();
        };
        const leave = () => { last = null; hide(); };
        // ポインタを動かさずにスクロールしたとき、同じ画面位置から 1 フレームで再計算する
        const onScroll = () => {
            if (!last || raf) return;
            raf = requestAnimationFrame(() => { raf = 0; place(); });
        };
        container.addEventListener('pointermove', move);
        container.addEventListener('pointerleave', leave);
        // scroll は bubble しないので、入れ物の外側のスクロール領域も拾えるよう capture で聞く
        document.addEventListener('scroll', onScroll, { capture: true, passive: true });
        return () => {
            container.removeEventListener('pointermove', move);
            container.removeEventListener('pointerleave', leave);
            document.removeEventListener('scroll', onScroll, { capture: true });
            if (raf) cancelAnimationFrame(raf);
        };
    }, [containerRef, geomRef]);

    return <div ref={elRef} data-table-hover="" className="table-hover-hl" style={{ display: 'none' }} />;
};
