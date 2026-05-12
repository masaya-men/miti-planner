import { useEffect, useState } from 'react';

/**
 * 開発時専用 — 軽減アイコン列の幅を動的に調整するスライダー UI。
 * `import.meta.env.DEV` のときだけ MitiPlannerPage に mount される。
 *
 * 使い方:
 * - スライダーを動かすと `--col-th-w` / `--col-dps-w` がリアルタイムで変わる
 * - 同時に「タンク列の幅」 と「軽減 5 個並べたときの右余白」 (現在 viewport の実値) を表示
 * - 視覚的に最適値を見つけたら、 その数値を src/index.css に反映
 */
const DEFAULT_TH = 126;
const DEFAULT_DPS = 53;
const ICON_WIDTH = 24;
const VISUAL_OFFSET = 2;
const T_H_MAX_ICONS = 5;
const DPS_MAX_ICONS = 2;

type IconMeasure = {
    outerL: number;  // viewport-x of outer container left
    outerR: number;
    innerImgL: number;  // viewport-x of inner img element left (visible icon left)
    innerImgR: number;
};

type Probe = {
    tankL: number;        // Tank box left
    tankR: number;        // Tank box right
    tankBorderR: number;  // Tank の border-right width
    prevSiblingR: number; // 前列の right (= Tank の左罫線の "右端")
    prevSiblingBorderR: number;
    icons: IconMeasure[];
};

export const ColumnWidthSlider: React.FC = () => {
    const [thW, setThW] = useState(DEFAULT_TH);
    const [dpsW, setDpsW] = useState(DEFAULT_DPS);
    const [actualThW, setActualThW] = useState(0);
    const [probe, setProbe] = useState<Probe | null>(null);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        document.documentElement.style.setProperty('--col-th-w', `${thW}px`);
    }, [thW]);

    useEffect(() => {
        document.documentElement.style.setProperty('--col-dps-w', `${dpsW}px`);
    }, [dpsW]);

    // 実 DOM の計測 (列幅 + 軽減アイコン位置)
    useEffect(() => {
        const measure = () => {
            const tank = document.querySelector('[data-member-role="tank"]') as HTMLElement | null;
            if (!tank) { setActualThW(0); setProbe(null); return; }
            const r = tank.getBoundingClientRect();
            setActualThW(r.width);

            const cs = getComputedStyle(tank);
            const tankBorderR = parseFloat(cs.borderRightWidth || '0');
            const prev = tank.previousElementSibling as HTMLElement | null;
            const prevR = prev ? prev.getBoundingClientRect().right : r.left;
            const prevBorderR = prev ? parseFloat(getComputedStyle(prev).borderRightWidth || '0') : 0;

            // 軽減アイコン: width=24 の absolute div、 列の x 範囲内、 列ヘッダー下
            const allAbs = Array.from(document.querySelectorAll('div')).filter(el => {
                if (getComputedStyle(el).position !== 'absolute') return false;
                const b = el.getBoundingClientRect();
                return Math.abs(b.width - 24) < 0.5
                    && b.left >= r.left - 5 && b.right <= r.right + 5
                    && b.top > r.bottom;
            }) as HTMLElement[];

            if (allAbs.length === 0) { setProbe({ tankL: r.left, tankR: r.right, tankBorderR, prevSiblingR: prevR, prevSiblingBorderR: prevBorderR, icons: [] }); return; }

            const topY = Math.min(...allAbs.map(e => e.getBoundingClientRect().top));
            const row = allAbs.filter(e => Math.abs(e.getBoundingClientRect().top - topY) < 5)
                              .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

            const icons: IconMeasure[] = row.slice(0, 5).map(el => {
                const b = el.getBoundingClientRect();
                const img = el.querySelector('img') as HTMLElement | null;
                const ib = img?.getBoundingClientRect();
                return {
                    outerL: b.left,
                    outerR: b.right,
                    innerImgL: ib?.left ?? b.left,
                    innerImgR: ib?.right ?? b.right,
                };
            });

            setProbe({ tankL: r.left, tankR: r.right, tankBorderR, prevSiblingR: prevR, prevSiblingBorderR: prevBorderR, icons });
        };
        measure();
        const id = window.setInterval(measure, 250);
        return () => window.clearInterval(id);
    }, [thW]);

    // 想定される右余白 (アイコン最大個数を並べたときの計算値)
    const thRightMargin = thW - (VISUAL_OFFSET + T_H_MAX_ICONS * ICON_WIDTH);
    const dpsRightMargin = dpsW - (VISUAL_OFFSET + DPS_MAX_ICONS * ICON_WIDTH);

    if (collapsed) {
        return (
            <button
                onClick={() => setCollapsed(false)}
                style={{
                    position: 'fixed',
                    top: 16,
                    right: 16,
                    zIndex: 99999,
                    padding: '6px 10px',
                    background: '#000',
                    color: '#fff',
                    border: '1px solid #fff',
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: 'monospace',
                    cursor: 'pointer',
                }}
            >
                列幅 SLIDER ▼
            </button>
        );
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 16,
                right: 16,
                zIndex: 99999,
                padding: 12,
                background: 'rgba(0,0,0,0.92)',
                color: '#fff',
                border: '1px solid #fff',
                borderRadius: 6,
                fontSize: 11,
                fontFamily: 'monospace',
                minWidth: 280,
                pointerEvents: 'auto',
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>列幅 動的調整 (DEV)</strong>
                <button
                    onClick={() => setCollapsed(true)}
                    style={{ background: 'transparent', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14 }}
                >
                    ▲
                </button>
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>
                    タンク/ヒーラー列幅: <strong>{thW}px</strong>
                </label>
                <input
                    type="range"
                    min={100}
                    max={250}
                    step={1}
                    value={thW}
                    onChange={(e) => setThW(Number(e.target.value))}
                    style={{ width: '100%', display: 'block' }}
                />
                <div style={{ fontSize: 10, color: '#aaa' }}>
                    実 DOM 幅: {actualThW.toFixed(2)}px / 5 個並べ右余白: <strong style={{ color: thRightMargin >= 2 ? '#0f0' : '#f00' }}>{thRightMargin}px</strong>
                </div>
            </div>

            <div style={{ marginBottom: 10 }}>
                <label>
                    DPS 列幅: <strong>{dpsW}px</strong>
                </label>
                <input
                    type="range"
                    min={40}
                    max={120}
                    step={1}
                    value={dpsW}
                    onChange={(e) => setDpsW(Number(e.target.value))}
                    style={{ width: '100%', display: 'block' }}
                />
                <div style={{ fontSize: 10, color: '#aaa' }}>
                    2 個並べ右余白: <strong style={{ color: dpsRightMargin >= 2 ? '#0f0' : '#f00' }}>{dpsRightMargin}px</strong>
                </div>
            </div>

            <div style={{ fontSize: 10, color: '#aaa', marginTop: 8, borderTop: '1px solid #444', paddingTop: 6 }}>
                viewport: {typeof window !== 'undefined' ? window.innerWidth : '?'} × {typeof window !== 'undefined' ? window.innerHeight : '?'} / DPR {typeof window !== 'undefined' ? window.devicePixelRatio.toFixed(2) : '?'}<br />
                計算式: W = 2L({VISUAL_OFFSET}) + N×ICON({ICON_WIDTH}) + 右余白<br />
                推奨: T/H 126 / DPS 53 (実測対称値)
            </div>

            {/* 実 DOM 計測表示 (軽減アイコン 5 個並べた状態で意味のある値が出る) */}
            {probe && probe.icons.length > 0 && (
                <div style={{ fontSize: 9, color: '#ddd', marginTop: 8, borderTop: '1px solid #f80', paddingTop: 6 }}>
                    <strong style={{ color: '#f80' }}>実 DOM 計測 (Tank 列、 アイコン {probe.icons.length} 個)</strong>
                    <div>Tank box: L={probe.tankL.toFixed(1)} R={probe.tankR.toFixed(1)} (border-r {probe.tankBorderR}px)</div>
                    <div>前列 right: {probe.prevSiblingR.toFixed(1)} (border-r {probe.prevSiblingBorderR}px)</div>
                    <hr style={{ border: 0, borderTop: '1px dotted #555', margin: '4px 0' }} />
                    {probe.icons.map((ic, i) => {
                        if (i !== 0 && i !== probe.icons.length - 1) return null; // 1 個目と最終のみ表示
                        return (
                            <div key={i} style={{ marginBottom: 2 }}>
                                {i === 0 ? '1個目' : `${i + 1}個目(最終)`}: outerL={ic.outerL.toFixed(1)} outerR={ic.outerR.toFixed(1)} imgL={ic.innerImgL.toFixed(1)} imgR={ic.innerImgR.toFixed(1)}
                            </div>
                        );
                    })}
                    {probe.icons.length >= 2 && (() => {
                        const first = probe.icons[0];
                        const last = probe.icons[probe.icons.length - 1];
                        const outerVisualR_a = probe.tankR - probe.tankBorderR;
                        const outerVisualR_b = probe.tankR - probe.tankBorderR / 2;
                        return (
                            <>
                                <hr style={{ border: 0, borderTop: '1px dotted #555', margin: '4px 0' }} />
                                <div><strong style={{ color: '#0f0' }}>距離 (左罫線→1個目 outer L / 最終 outer R→右罫線)</strong></div>
                                <div>罫線=box境界:    左 {(first.outerL - probe.tankL).toFixed(2)} / 右 {(outerVisualR_a - last.outerR).toFixed(2)}</div>
                                <div>罫線=罫線中央:   左 {(first.outerL - (probe.prevSiblingR - probe.prevSiblingBorderR / 2)).toFixed(2)} / 右 {(outerVisualR_b - last.outerR).toFixed(2)}</div>
                                <div><strong style={{ color: '#0f0' }}>絵柄 (img) 基準</strong></div>
                                <div>罫線=罫線中央:   左 {(first.innerImgL - (probe.prevSiblingR - probe.prevSiblingBorderR / 2)).toFixed(2)} / 右 {(outerVisualR_b - last.innerImgR).toFixed(2)}</div>
                            </>
                        );
                    })()}
                </div>
            )}

            <button
                onClick={() => { setThW(DEFAULT_TH); setDpsW(DEFAULT_DPS); }}
                style={{
                    marginTop: 8,
                    padding: '4px 8px',
                    background: '#222',
                    color: '#fff',
                    border: '1px solid #555',
                    borderRadius: 3,
                    cursor: 'pointer',
                    fontSize: 11,
                    width: '100%',
                }}
            >
                デフォルト ({DEFAULT_TH} / {DEFAULT_DPS}) に戻す
            </button>
        </div>
    );
};
