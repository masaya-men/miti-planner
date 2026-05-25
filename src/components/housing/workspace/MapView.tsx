import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { MockListing } from '../../../data/housing/mockListings';
import { MapBubbleCard } from './MapBubbleCard';
import mistWard from '../../../data/housing/mistWard.generated.json';

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
const ADJ = (() => {
    const m = new Map<string, string[]>();
    for (const [a, b] of mistWard.edges as [string, string][]) {
        (m.get(a) ?? m.set(a, []).get(a)!).push(b);
        (m.get(b) ?? m.set(b, []).get(b)!).push(a);
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

// onCardClick は受け取るが、 デモではバブル click は「光ナビの行き先切替」 に使うため未使用。
export const MapView: React.FC<MapViewProps> = () => {
    const { t } = useTranslation();
    const [targetPlot, setTargetPlot] = useState<number>(27);

    // 選択中のデモ物件への「光ナビ」経路を SVG パス文字列にする
    const routePath = useMemo(() => {
        const house = HOUSES.find((h) => h.plot === targetPlot && h.kind === 'plot');
        if (!house || !house.node) return null;
        const ids = routeNodes(START_NODE, house.node);
        if (ids.length === 0) return null;
        const pts = ids.map((id) => nodeById.get(id)!).filter(Boolean);
        let d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x * W).toFixed(1)} ${(p.y * H).toFixed(1)}`).join(' ');
        d += ` L${(house.x * W).toFixed(1)} ${(house.y * H).toFixed(1)}`; // 最後に家へ
        return d;
    }, [targetPlot]);

    return (
        <div className="housing-map-stage" data-region="map-stage">
            <div className="housing-map-canvas">
                <div
                    className="housing-map-wrap"
                    style={{ position: 'relative', width: '100%', maxWidth: 'min(100%, 78vh)', margin: '0 auto', aspectRatio: `${W} / ${H}` }}
                >
                    <svg
                        viewBox={`0 0 ${W} ${H}`}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
                        role="img"
                        aria-label={t('housing.workspace.center.map_alt')}
                    >
                        {/* 道路 */}
                        <path d={mistWard.roadPath} fill="none" stroke="var(--housing-honey)" strokeOpacity="0.28" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />

                        {/* 全 plot の輪郭 (薄く) */}
                        {HOUSES.map((h) => (
                            <rect key={`${h.kind}-${h.plot}`} x={h.x * W - 22} y={h.y * H - 16} width="44" height="32" rx="6"
                                fill="var(--housing-honey)" fillOpacity="0.05" stroke="var(--housing-honey)" strokeOpacity="0.18" strokeWidth="1.5" />
                        ))}

                        {/* ノード (微かに) */}
                        {NODES.map((n) => (
                            <circle key={n.id} cx={n.x * W} cy={n.y * H} r="3" fill="var(--housing-candle)" fillOpacity="0.35" />
                        ))}

                        {/* 道全体を巡るアンビエントの光 (生きたマップ) */}
                        {[0, 2, 4].map((delay) => (
                            <circle key={delay} r="5" fill="var(--housing-candle)" style={{ filter: 'drop-shadow(0 0 6px var(--housing-honey))' }}>
                                <animateMotion dur="9s" begin={`${delay}s`} repeatCount="indefinite" path={mistWard.roadPath} />
                            </circle>
                        ))}

                        {/* 選択物件への光ナビ経路 */}
                        {routePath && (
                            <>
                                <path d={routePath} fill="none" stroke="var(--housing-honey)" strokeOpacity="0.85" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"
                                    style={{ filter: 'drop-shadow(0 0 5px var(--housing-honey))' }} />
                                <circle r="9" fill="var(--housing-map-light)" style={{ filter: 'drop-shadow(0 0 10px var(--housing-candle))' }}>
                                    <animateMotion dur="2.4s" repeatCount="indefinite" path={routePath} rotate="auto" />
                                </circle>
                            </>
                        )}

                        {/* 出発点マーカー (エーテライト相当) */}
                        {nodeById.get(START_NODE) && (
                            <g transform={`translate(${nodeById.get(START_NODE)!.x * W} ${nodeById.get(START_NODE)!.y * H})`}>
                                <circle r="11" fill="none" stroke="var(--housing-aether)" strokeOpacity="0.7" strokeWidth="2" />
                                <circle r="4" fill="var(--housing-aether-soft)" style={{ filter: 'drop-shadow(0 0 8px var(--housing-aether))' }} />
                            </g>
                        )}
                    </svg>

                    {/* デモ物件バブル (クリックで光ナビの行き先を切替) */}
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
