import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useWardMapAsset } from '../../../lib/housing/useWardMapAsset';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { computePlotDoor } from '../../../lib/housing/plotDoor';
import { pxToNorm, buildFullExport, type EntranceOverrides } from '../../../lib/housing/entranceAuthoring';
import existingData from '../../../data/housing/wardEntrances.generated.json';

const EXISTING = existingData as Record<string, EntranceOverrides>;
const MAP_KEYS = Object.keys(WARD_MAP_LOADERS);

/** 家1件のキー(plot番号 or 'apart')。 */
function houseKey(h: { kind: string; plot: number }): string {
  return h.kind === 'apart' ? 'apart' : String(h.plot);
}

/**
 * 入口オーサリングページ(開発専用)。
 * 実マップに全区画の入口マーカーを表示し、ドラッグで座標を補正、JSONを書き出す。
 * 本番には繋がない(Task6 で import.meta.env.DEV gate のルートから使う想定)。
 */
export function EntranceAuthoringPage() {
  const [mapKey, setMapKey] = useState(MAP_KEYS[0]);
  const asset = useWardMapAsset(mapKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  // 各マップの上書き点(0..1)。初期は既存JSON。
  const [overrides, setOverrides] = useState<Record<string, EntranceOverrides>>(() => ({ ...EXISTING }));

  const json = asset.status === 'ready' ? asset.json : null;
  const vb = json?.viewBox ?? { w: 0, h: 0 };
  const mapOverrides = useMemo(() => overrides[mapKey] ?? {}, [overrides, mapKey]);

  // 各家の表示座標(px)。上書きあればそれ、なければ幾何、なければ箱中心。
  const markers = useMemo(() => {
    if (!json) return [];
    return json.houses.map((h) => {
      const key = houseKey(h);
      const ov = mapOverrides[key];
      let px: number, py: number;
      if (ov) {
        px = ov[0] * vb.w;
        py = ov[1] * vb.h;
      } else {
        const geo = computePlotDoor(json, h.plot, h.kind);
        if (geo) {
          px = geo.x;
          py = geo.y;
        } else {
          px = h.x * vb.w;
          py = h.y * vb.h;
        }
      }
      return { key, plot: h.plot, kind: h.kind, px, py, corrected: !!ov };
    });
  }, [json, vb.w, vb.h, mapOverrides]);

  function clientToViewBox(clientX: number, clientY: number): { x: number; y: number } | null {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM?.();
    if (!svg || !ctm) return null; // テスト環境(happy-dom は getScreenCTM 不在)は no-op
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!dragKey || !json) return;
    const vbp = clientToViewBox(e.clientX, e.clientY);
    if (!vbp) return;
    const [nx, ny] = pxToNorm(vbp.x, vbp.y, vb);
    setOverrides((prev) => ({ ...prev, [mapKey]: { ...(prev[mapKey] ?? {}), [dragKey]: [nx, ny] } }));
  }

  const exportJson = JSON.stringify(buildFullExport(overrides), null, 2);

  return (
    <div className="housing-workspace housing-shell-root housing-entrance-authoring" data-theme="dark">
      <div style={{ padding: 16 }}>
        <label>
          マップ:{' '}
          <select value={mapKey} onChange={(e) => setMapKey(e.target.value)}>
            {MAP_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => navigator.clipboard?.writeText(exportJson)}>
          JSON書き出し(クリップボード)
        </button>
      </div>
      <div className="housing-tour-map" style={{ height: '70vh' }}>
        <div className="housing-tour-map-stage">
          <div className="housing-tour-map-wrap">
            {asset.status === 'ready' && (
              <>
                <div className="housing-map-svg-host" dangerouslySetInnerHTML={{ __html: asset.svg }} />
                <svg
                  ref={svgRef}
                  className="housing-map-overlay housing-entrance-overlay"
                  viewBox={`0 0 ${vb.w} ${vb.h}`}
                  preserveAspectRatio="xMidYMid meet"
                  onPointerMove={onPointerMove}
                  onPointerUp={() => setDragKey(null)}
                  onPointerLeave={() => setDragKey(null)}
                >
                  {markers.map((m) => (
                    <g key={m.key}>
                      <circle
                        data-testid="entrance-marker"
                        className={`housing-entrance-marker${m.corrected ? ' housing-entrance-marker--corrected' : ''}`}
                        cx={m.px}
                        cy={m.py}
                        r={7}
                        onPointerDown={(e) => {
                          (e.target as Element).setPointerCapture?.(e.pointerId);
                          setDragKey(m.key);
                        }}
                      />
                      <text className="housing-entrance-marker-label" x={m.px + 8} y={m.py}>
                        {m.kind === 'apart' ? 'A' : m.plot}
                      </text>
                    </g>
                  ))}
                </svg>
              </>
            )}
          </div>
        </div>
      </div>
      <pre style={{ maxHeight: 160, overflow: 'auto', padding: 12 }}>{exportJson}</pre>
    </div>
  );
}
