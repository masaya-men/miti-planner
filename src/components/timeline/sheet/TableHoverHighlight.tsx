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
        const move = (e: PointerEvent) => {
            if (e.pointerType === 'touch') { hide(); return; }
            const g = geomRef.current;
            const rect = container.getBoundingClientRect();
            const box = hoverBox(g.mode, e.clientX - rect.left, e.clientY - rect.top, g.bands, g.columnMap, g.layout);
            if (!box) { hide(); return; }
            el.style.display = 'block';
            el.style.transform = `translate(${box.left}px, ${box.top}px)`;
            el.style.width = `${box.width}px`;
            el.style.height = `${box.height}px`;
        };
        container.addEventListener('pointermove', move);
        container.addEventListener('pointerleave', hide);
        return () => {
            container.removeEventListener('pointermove', move);
            container.removeEventListener('pointerleave', hide);
        };
    }, [containerRef, geomRef]);

    return <div ref={elRef} data-table-hover="" className="table-hover-hl" style={{ display: 'none' }} />;
};
