import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { MapBubbleCard } from './MapBubbleCard';
import mistWard from '../../../data/housing/mistWard.generated.json';
// Figma で作った Mist マップ (家の模型 / 道路(Stroke) / エーテライト / Node / ナビ赤線 全部入り) を inline 展開。
// 赤線 (path stroke="#FF0000") = ナビゲーション用道路 + Node 19 個 は housing.css で display:none し
// 経路計算用 data だけ裏で使う。
import mistSvgRaw from '../../../data/housing/mist.generated.svg?raw';

export interface MapViewProps {
    onCardClick: (listing: MockListing) => void;
}

const W = mistWard.viewBox.w;
const H = mistWard.viewBox.h;

type Node = { id: string; x: number; y: number };
type House = { kind: string; plot: number; x: number; y: number; node: string | null };

const NODES = mistWard.nodes as Node[];
const HOUSES = mistWard.houses as House[];
const nodeById = new Map(NODES.map((n) => [n.id, n]));

// --- デモ物件 (適当な住所). 実データ未投入のエリアを体感するためのサンプル ---
const DEMO_PLOTS = [1, 7, 12, 19, 27, 30];
function demoListing(plot: number): MockListing {
    return {
        id: `demo-mist-${plot}`,
        ownerUid: 'demo',
        dc: 'Mana',
        server: 'Anima',
        region: 'JP',
        area: 'Mist',
        ward: 5,
        plot,
        size: 'M',
        imageMode: 'none',
        tags: ['demo'],
        createdAt: Date.now(),
    } as MockListing;
}

// --- BFS で start ノード → goal ノードの経路を求める ---
type EdgeData = { a: string; b: string; polyline: [number, number][] };
const EDGES = mistWard.edges as unknown as EdgeData[];
const ADJ = (() => {
    const m = new Map<string, string[]>();
    for (const e of EDGES) {
        (m.get(e.a) ?? m.set(e.a, []).get(e.a)!).push(e.b);
        (m.get(e.b) ?? m.set(e.b, []).get(e.b)!).push(e.a);
    }
    return m;
})();
function routeNodes(startId: string, goalId: string): string[] {
    const prev: Record<string, string | null> = { [startId]: null };
    const q = [startId];
    while (q.length) {
        const cur = q.shift()!;
        if (cur === goalId) break;
        for (const nx of ADJ.get(cur) ?? []) if (!(nx in prev)) { prev[nx] = cur; q.push(nx); }
    }
    if (!(goalId in prev)) return [];
    const path: string[] = [];
    let c: string | null = goalId;
    while (c) { path.unshift(c); c = prev[c]; }
    return path;
}

// 出発点 (デモ): エーテライト相当として node_1 を仮置き (本番はスプレッドシートの最寄りエーテライト)
const START_NODE = 'node_1';

export const MapView: React.FC<MapViewProps> = () => {
    const { t } = useTranslation();
    const [targetPlot, setTargetPlot] = useState<number>(27);

    // 選択中のデモ物件への光ナビ経路 (BFS の node 列を、 各 edge の polyline で道なりに連結)
    const routePath = useMemo(() => {
        const house = HOUSES.find((h) => h.plot === targetPlot && h.kind === 'plot');
        if (!house || !house.node) return null;
        const ids = routeNodes(START_NODE, house.node);
        if (ids.length === 0) return null;
        const pts: Array<[number, number]> = [];
        for (let i = 0; i + 1 < ids.length; i++) {
            const a = ids[i];
            const b = ids[i + 1];
            const e = EDGES.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
            if (!e) {
                // フォールバック (BFS が edge 不在の 2 ノードを返す状況、 通常起きない)
                if (i === 0) {
                    const aN = nodeById.get(a)!;
                    pts.push([aN.x * W, aN.y * H]);
                }
                const bN = nodeById.get(b)!;
                pts.push([bN.x * W, bN.y * H]);
                continue;
            }
            const seg = e.a === a ? e.polyline : e.polyline.slice().reverse();
            const segPx = seg.map(([px, py]) => [px * W, py * H] as [number, number]);
            // 前 edge の終端 = この edge の始端 が重複するため slice(1) で除く (初回 i===0 のみ全部 push)
            if (i === 0) pts.push(...segPx);
            else pts.push(...segPx.slice(1));
        }
        pts.push([house.x * W, house.y * H]); // 最寄りノード → 玄関の最後 1 ホップ
        return pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
    }, [targetPlot]);

    return (
        <div className="housing-map-stage" data-region="map-stage">
            <div className="housing-map-canvas">
                <div className="housing-map-wrap">
                    {/* ① Figma マップを inline 展開 (家 / 道 / エーテライト全部入り) */}
                    <div
                        className="housing-map-svg-host"
                        role="img"
                        aria-label={t('housing.workspace.center.map_alt')}
                        dangerouslySetInnerHTML={{ __html: mistSvgRaw }}
                    />

                    {/* ② 動的レイヤー: 光ナビ + アンビエント (赤線/Node は ① 内で透明化済、 ここに自前の演出だけ重ねる) */}
                    <svg
                        className="housing-map-overlay"
                        viewBox={`0 0 ${W} ${H}`}
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden="true"
                    >
                        {/* 道全体を巡るアンビエント (dash パターンが流れる = subpath 間のテレポートなし。
                            ナビ用 1px 赤線 path をオーバーレイで再利用し、 光る dash として描画) */}
                        <path
                            d={mistWard.roadPath}
                            fill="none"
                            stroke="var(--housing-candle)"
                            strokeOpacity="0.6"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray="14 28"
                            style={{ filter: 'drop-shadow(0 0 6px var(--housing-honey))' }}
                        >
                            <animate attributeName="stroke-dashoffset" from="0" to="-42" dur="2.4s" repeatCount="indefinite" />
                        </path>

                        {/* 選択物件への光ナビ (BFS の node 列を edge polyline 連結で道なりに) */}
                        {routePath && (
                            <>
                                <path d={routePath} fill="none" stroke="var(--housing-honey)" strokeOpacity="0.85" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 5px var(--housing-honey))' }} />
                                <circle r="9" fill="var(--housing-map-light)" style={{ filter: 'drop-shadow(0 0 10px var(--housing-candle))' }}>
                                    <animateMotion dur="2.4s" repeatCount="indefinite" path={routePath} rotate="auto" />
                                </circle>
                            </>
                        )}

                        {/* 目的地アピール (A: 波紋リング 2 重位相 + B: 中心ハイライト矩形の脈打ち) */}
                        {(() => {
                            const target = HOUSES.find((h) => h.plot === targetPlot && h.kind === 'plot');
                            if (!target) return null;
                            const cx = target.x * W;
                            const cy = target.y * H;
                            return (
                                <g aria-hidden="true">
                                    {/* A: 波紋 (位相ずらしで 2 つ、 家サイズ 100px ぐらいに合わせて十分大きく) */}
                                    {[0, 0.9].map((begin) => (
                                        <circle key={begin} cx={cx} cy={cy} r="60" fill="none" stroke="var(--housing-candle)" strokeWidth="6"
                                            style={{ filter: 'drop-shadow(0 0 10px var(--housing-honey))' }}>
                                            <animate attributeName="r" from="60" to="170" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                                            <animate attributeName="stroke-opacity" from="0.95" to="0" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                                            <animate attributeName="stroke-width" from="8" to="2" dur="1.8s" begin={`${begin}s`} repeatCount="indefinite" />
                                        </circle>
                                    ))}
                                    {/* B: 中心ハイライト矩形 (家全体を覆うサイズ・脈打ち) */}
                                    <rect x={cx - 75} y={cy - 55} width="150" height="110" rx="10"
                                        fill="var(--housing-honey)" fillOpacity="0.22"
                                        stroke="var(--housing-honey)" strokeWidth="6"
                                        style={{ filter: 'drop-shadow(0 0 16px var(--housing-honey))' }}>
                                        <animate attributeName="stroke-opacity" values="1;0.45;1" dur="1.4s" repeatCount="indefinite" />
                                        <animate attributeName="fill-opacity" values="0.34;0.16;0.34" dur="1.4s" repeatCount="indefinite" />
                                    </rect>
                                </g>
                            );
                        })()}
                    </svg>

                    {/* ③ デモ物件バブル (クリックで光ナビの行き先を切替) */}
                    {DEMO_PLOTS.map((plot) => {
                        const h = HOUSES.find((x) => x.plot === plot && x.kind === 'plot');
                        if (!h) return null;
                        return (
                            <MapBubbleCard
                                key={plot}
                                listing={demoListing(plot)}
                                x={h.x}
                                y={h.y}
                                onClick={() => setTargetPlot(plot)}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="housing-hud is-top">
                <div className="pill">Mist · demo</div>
                <div className="pill">
                    <span className="accent">●</span>
                    {' '}Route → plot {targetPlot}
                </div>
            </div>
            <div className="housing-hud is-bot">
                <div className="pill">{HOUSES.length} plots · {NODES.length} nodes</div>
                <div className="pill">tap a card to navigate</div>
            </div>

            <svg className="housing-compass" viewBox="0 0 56 56" role="img" aria-label={t('housing.workspace.center.compass_label')}>
                <circle cx="28" cy="28" r="26" />
                <polygon className="needle" points="28,10 31,28 28,46 25,28" opacity="0.85" />
                <text className="n" x="28" y="7">N</text>
                <text x="50" y="29">E</text>
                <text x="28" y="52">S</text>
                <text x="6" y="29">W</text>
            </svg>
        </div>
    );
};
