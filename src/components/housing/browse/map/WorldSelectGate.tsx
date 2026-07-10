import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ALL_DCS, DC_SERVER_MAP } from '../../../../data/housing/dcServerMap';
import { useHousingFilterStore } from '../../../../store/useHousingFilterStore';

/**
 * 探すページ 地図表示モードのワールド選択ゲート (spec §3.2)。
 * 地図はワールドごとの表示のため、servers が1件に絞られるまでここで止める。
 * DC 選択 → その DC のワールド一覧 → ワールド選択で setDC + setServerExclusive を確定する。
 * 既に dc が選択済みの場合は、その DC のワールド一覧から表示を開始する。
 */
export const WorldSelectGate: React.FC = () => {
  const { t } = useTranslation();
  const dc = useHousingFilterStore((s) => s.dc);
  const setDC = useHousingFilterStore((s) => s.setDC);
  const setServerExclusive = useHousingFilterStore((s) => s.setServerExclusive);

  const [pendingDC, setPendingDC] = useState<string | null>(dc);
  const worlds = pendingDC ? DC_SERVER_MAP[pendingDC]?.servers ?? [] : [];

  const handleSelectWorld = (world: string) => {
    if (!pendingDC) return;
    setDC(pendingDC);
    setServerExclusive(world);
  };

  return (
    <div className="housing-world-gate" data-testid="housing-world-gate">
      <div className="housing-world-gate-title">{t('housing.map.gate.title')}</div>
      <div className="housing-world-gate-desc">{t('housing.map.gate.description')}</div>

      <div className="housing-world-gate-section">
        <span className="housing-world-gate-label">{t('housing.map.gate.dc_label')}</span>
        <div className="housing-world-gate-grid">
          {ALL_DCS.map((d) => (
            <button
              key={d}
              type="button"
              className="housing-world-gate-chip"
              data-selected={pendingDC === d ? 'true' : 'false'}
              onClick={() => setPendingDC(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {worlds.length > 0 && (
        <div className="housing-world-gate-section">
          <span className="housing-world-gate-label">{t('housing.map.gate.world_label')}</span>
          <div className="housing-world-gate-grid">
            {worlds.map((world) => (
              <button
                key={world}
                type="button"
                className="housing-world-gate-chip"
                onClick={() => handleSelectWorld(world)}
              >
                {world}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
