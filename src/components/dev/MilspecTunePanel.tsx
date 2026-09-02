import { useEffect, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** 調整対象の --milspec-tune-* 変数。military.css の初期値と一致させる。 */
const TUNABLES: { key: string; label: string; min: number; max: number; step: number; unit?: string }[] = [
  { key: '--milspec-tune-glow', label: '発光の強さ', min: 0, max: 1, step: 0.01 },
  { key: '--milspec-tune-accent-hue', label: 'シアン色相回転', min: -60, max: 60, step: 1, unit: 'deg' },
  { key: '--milspec-tune-accent-sat', label: 'アクセント彩度', min: 0.5, max: 1.5, step: 0.01 },
  { key: '--milspec-tune-corner', label: '切り欠き角サイズ', min: 0, max: 16, step: 1, unit: 'px' },
  { key: '--milspec-tune-scanline', label: '走査線 不透明度', min: 0, max: 0.06, step: 0.002 },
  { key: '--milspec-tune-grid', label: '背景グリッド 不透明度', min: 0, max: 0.12, step: 0.005 },
  { key: '--milspec-tune-panel-line', label: 'パネルライン太さ', min: 0, max: 3, step: 0.5, unit: 'px' },
  { key: '--milspec-tune-decal', label: 'デカール 不透明度', min: 0, max: 1, step: 0.02 },
  { key: '--milspec-tune-hazard', label: 'ハザード帯 不透明度', min: 0, max: 1, step: 0.02 },
];

/** 開発専用。?tune クエリ or localStorage 'milspec-tune'==='1' かつ DEV かつ military のときだけ出る。
 *  --milspec-tune-* を実機でドラッグ調整するためのパネル。Phase 3 で撤去。 */
export const MilspecTunePanel: React.FC = () => {
  const themeStyle = useThemeStore((s) => s.themeStyle);
  const [open, setOpen] = useState(true);
  const [vals, setVals] = useState<Record<string, number>>({});

  const enabled =
    import.meta.env.DEV &&
    themeStyle === 'military' &&
    (new URLSearchParams(location.search).has('tune') ||
      localStorage.getItem('milspec-tune') === '1');

  useEffect(() => {
    if (!enabled) return;
    const cs = getComputedStyle(document.documentElement);
    const init: Record<string, number> = {};
    for (const t of TUNABLES) init[t.key] = parseFloat(cs.getPropertyValue(t.key)) || 0;
    setVals(init);
  }, [enabled]);

  if (!enabled) return null;

  const set = (key: string, v: number, unit?: string) => {
    setVals((p) => ({ ...p, [key]: v }));
    document.documentElement.style.setProperty(key, unit ? `${v}${unit}` : String(v));
  };

  const copyCss = () => {
    const body = TUNABLES.map((t) => `  ${t.key}: ${vals[t.key]}${t.unit ?? ''};`).join('\n');
    navigator.clipboard.writeText(`.theme-military {\n${body}\n}`);
  };

  return (
    <div style={{
      position: 'fixed', right: 8, bottom: 8, zIndex: 100000,
      background: 'rgba(10,16,21,0.95)', color: '#d8e8f4', border: '1px solid #5fd4ff',
      font: '11px ui-monospace, monospace', padding: open ? 10 : 4, maxWidth: 260,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}
           onClick={() => setOpen((o) => !o)}>
        <strong>MIL-SPEC TUNE</strong><span>{open ? '−' : '+'}</span>
      </div>
      {open && (
        <>
          {TUNABLES.map((t) => (
            <label key={t.key} style={{ display: 'block', marginTop: 6 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t.label}</span><span>{vals[t.key]}{t.unit ?? ''}</span>
              </span>
              <input type="range" min={t.min} max={t.max} step={t.step}
                     value={vals[t.key] ?? 0}
                     onChange={(e) => set(t.key, parseFloat(e.target.value), t.unit)}
                     style={{ width: '100%' }} />
            </label>
          ))}
          <button onClick={copyCss} style={{ marginTop: 8, width: '100%' }}>CSS をコピー</button>
        </>
      )}
    </div>
  );
};
