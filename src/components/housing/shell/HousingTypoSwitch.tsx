import type { HousingTypoMode } from '../../../lib/housing/useHousingTypoPreview';

const MODES: HousingTypoMode[] = ['a', 'b', 'c'];

/** 【一時機能】文字メリハリ見比べの切替 (PC のみ・左下)。案決定後に撤去。 */
export const HousingTypoSwitch: React.FC<{
  mode: HousingTypoMode;
  onChange: (m: HousingTypoMode) => void;
}> = ({ mode, onChange }) => (
  <div className="housing-typo-switch" role="group" aria-label="表示">
    <span className="housing-typo-switch-label">表示</span>
    {MODES.map((m) => (
      <button
        key={m}
        type="button"
        className="housing-typo-switch-btn"
        data-active={m === mode || undefined}
        aria-pressed={m === mode}
        onClick={() => onChange(m)}
      >
        {m.toUpperCase()}
      </button>
    ))}
  </div>
);
