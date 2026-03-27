/**
 * ブドウ染色パターンプレビュー — 一時的なコンポーネント
 * 確認後に削除する
 */

// 六角形の頂点を生成
function hex(cx: number, cy: number, r: number, rot = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2 + (rot * Math.PI) / 180;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

const BERRIES: Array<[number, number, number, number]> = [
  [42, 38, 10, 0], [58, 38, 10, 15],
  [34, 52, 10, 5], [50, 50, 11, 0], [66, 52, 10, 10],
  [36, 66, 10, 8], [52, 65, 10, 0], [66, 67, 9, 12],
  [42, 78, 9, 5], [56, 79, 9, 0],
  [48, 90, 8, 10],
];

// 茎と葉のパーツ（共通）
function StemAndLeaves({ strokeColor, fillColor }: { strokeColor: string; fillColor: string }) {
  return (
    <>
      <line x1="50" y1="28" x2="46" y2="8" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="50" y1="28" x2="56" y2="10" stroke={strokeColor} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="46" y1="8" x2="40" y2="3" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="56" y1="10" x2="62" y2="5" stroke={strokeColor} strokeWidth="1.2" strokeLinecap="round" />
      <polygon points="40,3 22,8 18,20 28,26 38,18" stroke={strokeColor} strokeWidth="1.2" fill={fillColor} strokeLinejoin="miter" />
      <line x1="40" y1="3" x2="26" y2="18" stroke={strokeColor} strokeWidth="0.5" />
      <line x1="28" y1="10" x2="24" y2="20" stroke={strokeColor} strokeWidth="0.4" />
      <polygon points="62,5 78,8 80,18 72,24 64,16" stroke={strokeColor} strokeWidth="1.2" fill={fillColor} strokeLinejoin="miter" />
      <line x1="62" y1="5" x2="74" y2="16" stroke={strokeColor} strokeWidth="0.5" />
      <line x1="72" y1="10" x2="76" y2="18" stroke={strokeColor} strokeWidth="0.4" />
    </>
  );
}

interface PatternProps {
  label: string;
  berryFill: (i: number) => string;
  berryStroke: (i: number) => string;
  berryStrokeWidth: (i: number) => number;
  innerLines: boolean;
  innerStroke: (i: number) => string;
  stemStroke: string;
  leafFill: string;
  bg: string;
}

function GrapePattern({ label, berryFill, berryStroke, berryStrokeWidth, innerLines, innerStroke, stemStroke, leafFill, bg }: PatternProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl overflow-hidden border border-white/10" style={{ background: bg, width: 200, height: 260 }}>
        <svg viewBox="0 0 100 100" className="w-full h-full" fill="none">
          <StemAndLeaves strokeColor={stemStroke} fillColor={leafFill} />
          {BERRIES.map(([cx, cy, r, rot], i) => (
            <g key={i}>
              <polygon
                points={hex(cx, cy, r, rot)}
                stroke={berryStroke(i)}
                strokeWidth={berryStrokeWidth(i)}
                fill={berryFill(i)}
                strokeLinejoin="miter"
              />
              {innerLines && [0, 2, 4].map(j => {
                const a = (Math.PI / 3) * j - Math.PI / 2 + (rot * Math.PI) / 180;
                return (
                  <line key={j} x1={cx} y1={cy}
                    x2={(cx + r * Math.cos(a)).toFixed(1)}
                    y2={(cy + r * Math.sin(a)).toFixed(1)}
                    stroke={innerStroke(i)} strokeWidth="0.4" />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      <div className="text-[11px] text-white/60 text-center max-w-[200px]">{label}</div>
    </div>
  );
}

export function GrapePreview() {
  const depth = (i: number) => i / BERRIES.length;

  return (
    <div className="fixed inset-0 z-[200000] bg-black/95 flex items-center justify-center overflow-auto p-8">
      <div>
        <h2 className="text-white text-lg font-bold mb-6 text-center">ブドウ染色パターン — どれがいい？</h2>
        <div className="grid grid-cols-3 gap-8">

          {/* A: 現在（白線 + 薄い白塗り on 黒背景） */}
          <GrapePattern
            label="A: 現在（白線 + 薄塗り）"
            bg="#000"
            stemStroke="white"
            leafFill="rgba(255,255,255,0.15)"
            berryFill={(i) => `rgba(255,255,255,${0.08 + depth(i) * 0.08})`}
            berryStroke={(i) => `rgba(255,255,255,${0.6 + (1 - depth(i)) * 0.4})`}
            berryStrokeWidth={(i) => 1.0 + (1 - depth(i)) * 0.6}
            innerLines={true}
            innerStroke={(i) => `rgba(255,255,255,${(0.6 + (1 - depth(i)) * 0.4) * 0.3})`}
          />

          {/* B: 白塗り + 黒線 */}
          <GrapePattern
            label="B: 白塗り + 黒線"
            bg="#000"
            stemStroke="white"
            leafFill="rgba(255,255,255,0.7)"
            berryFill={() => `rgba(255,255,255,0.85)`}
            berryStroke={() => `rgba(0,0,0,0.8)`}
            berryStrokeWidth={() => 1.2}
            innerLines={true}
            innerStroke={() => `rgba(0,0,0,0.3)`}
          />

          {/* C: 白塗り + 黒線 + 内部線なし */}
          <GrapePattern
            label="C: 白塗り + 黒線（内部線なし）"
            bg="#000"
            stemStroke="white"
            leafFill="rgba(255,255,255,0.7)"
            berryFill={(i) => `rgba(255,255,255,${0.7 + (1 - depth(i)) * 0.25})`}
            berryStroke={() => `rgba(0,0,0,0.7)`}
            berryStrokeWidth={() => 1.0}
            innerLines={false}
            innerStroke={() => ''}
          />

          {/* D: 黒塗り + 白線（反転） */}
          <GrapePattern
            label="D: 黒塗り + 白線"
            bg="#000"
            stemStroke="white"
            leafFill="rgba(255,255,255,0.1)"
            berryFill={() => `rgba(0,0,0,0.9)`}
            berryStroke={(i) => `rgba(255,255,255,${0.5 + (1 - depth(i)) * 0.5})`}
            berryStrokeWidth={(i) => 1.0 + (1 - depth(i)) * 0.8}
            innerLines={true}
            innerStroke={(i) => `rgba(255,255,255,${0.15 + (1 - depth(i)) * 0.15})`}
          />

          {/* E: グラデーション塗り + 白線 */}
          <GrapePattern
            label="E: 明暗グラデ塗り + 白線"
            bg="#000"
            stemStroke="white"
            leafFill="rgba(255,255,255,0.2)"
            berryFill={(i) => `rgba(255,255,255,${0.3 + (1 - depth(i)) * 0.5})`}
            berryStroke={(i) => `rgba(255,255,255,${0.4 + (1 - depth(i)) * 0.4})`}
            berryStrokeWidth={() => 0.8}
            innerLines={true}
            innerStroke={(i) => `rgba(255,255,255,${0.1 + (1 - depth(i)) * 0.15})`}
          />

          {/* F: 白塗り（べた）+ 太い黒線 + 内部線あり */}
          <GrapePattern
            label="F: べた白 + 太い黒線"
            bg="#000"
            stemStroke="white"
            leafFill="white"
            berryFill={() => `white`}
            berryStroke={() => `rgba(0,0,0,0.9)`}
            berryStrokeWidth={() => 1.8}
            innerLines={true}
            innerStroke={() => `rgba(0,0,0,0.4)`}
          />

        </div>
        <p className="text-white/30 text-xs text-center mt-6">※ 実際のカーソルでは mix-blend-mode: difference で色が反転します</p>
      </div>
    </div>
  );
}
