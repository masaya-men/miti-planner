import { useEffect, useState } from 'react';
import { useThemeStore } from '../../store/useThemeStore';

/** 調整対象の --ms-tune-* 変数。military.css の初期値・モックアップの #tune と一致させる。 */
const TUNABLES: { key: string; label: string; min: number; max: number; step: number }[] = [
  { key: '--ms-tune-grain-all',  label: '全面グレイン(粒状感)',            min: 0, max: 1.2, step: 0.02 },
  { key: '--ms-tune-frame',      label: '枠線・ブラケットの明るさ',        min: 0, max: 4,   step: 0.05 },
  { key: '--ms-tune-relief',     label: '★パネルの厚み・ベベル(立体感)',  min: 0, max: 6,   step: 0.05 },
  { key: '--ms-tune-shadow',     label: 'パネル背後のボケ落ち影',          min: 0, max: 8,   step: 0.05 },
  { key: '--ms-tune-glow',       label: 'アクセントの発光',                min: 0, max: 4,   step: 0.05 },
  { key: '--ms-tune-panelline',  label: 'スジ彫りの濃さ',                  min: 0, max: 5,   step: 0.05 },
  { key: '--ms-tune-channel',    label: 'ゾーン間の溝の深さ',              min: 0, max: 3,   step: 0.05 },
  { key: '--ms-tune-weather',    label: 'ウェザリング(汚れ)',              min: 0, max: 3,   step: 0.05 },
  { key: '--ms-tune-wear',       label: '摩耗(手置きの傷・チップ・雨だれ)', min: 0, max: 3,   step: 0.05 },
];

/** 開発専用。?tune クエリ or localStorage 'milspec-tune'==='1' かつ DEV かつ military のときだけ出る。
 *  --ms-tune-* を実機でドラッグ調整するためのパネル。Phase 3 で撤去。 */
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

  const set = (key: string, v: number) => {
    setVals((p) => ({ ...p, [key]: v }));
    document.documentElement.style.setProperty(key, String(v));
  };

  const copyCss = () => {
    const body = TUNABLES.map((t) => `  ${t.key}: ${vals[t.key]};`).join('\n');
    navigator.clipboard.writeText(`.theme-military.theme-dark {\n${body}\n}`);
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
                <span>{t.label}</span><span>{vals[t.key]}</span>
              </span>
              <input type="range" min={t.min} max={t.max} step={t.step}
                     value={vals[t.key] ?? 0}
                     onChange={(e) => set(t.key, parseFloat(e.target.value))}
                     style={{ width: '100%' }} />
            </label>
          ))}
          <button onClick={copyCss} style={{ marginTop: 8, width: '100%' }}>CSS をコピー</button>
        </>
      )}
    </div>
  );
};
