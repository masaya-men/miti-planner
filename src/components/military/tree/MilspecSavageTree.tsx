import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  getSavageForCurrentExpansion,
  getSeriesById,
  getProjectLabel,
} from '../../../data/contentRegistry';
import { MsIcon } from '../milspecIcons';
import { useDrawer } from './useDrawer';
import { MilspecContentGroup } from './MilspecContentGroup';
import type { TreeProps } from './milspecTreeTypes';

// ── 零式タブ: シリーズ見出し(fold ボタン + 文字) + 各層 ──────────────
export const SavageTree: React.FC<TreeProps> = ({ lang, currentContentId, onAdd, select }) => {
  const contents = getSavageForCurrentExpansion();
  const seriesIds = [...new Set(contents.map((c) => c.seriesId))];
  // 初期 = 現在プランのシリーズだけ開く(現在のものが無ければ先頭)
  const currentSeriesId = contents.find((c) => c.id === currentContentId)?.seriesId ?? seriesIds[0];
  return (
    <>
      {seriesIds.map((sid) => {
        const inSeries = contents.filter((c) => c.seriesId === sid);
        if (!inSeries.length) return null;
        const series = getSeriesById(sid);
        const seriesName = series?.name[lang as keyof typeof series.name] || series?.name.ja || sid;
        const proj = getProjectLabel(inSeries[0].level, 'savage');
        const sectionLabel = proj ? `${proj[lang as keyof typeof proj] || proj.ja}：${seriesName}` : String(seriesName);
        return (
          <SeriesBlock key={sid} label={sectionLabel} isCurrent={sid === currentSeriesId}>
            {inSeries.map((c, i) => (
              <MilspecContentGroup
                key={c.id}
                content={c}
                index={i}
                displayName={(c.shortName[lang as keyof typeof c.shortName] || c.shortName.ja || '').replace('\n', ' ')}
                currentContentId={currentContentId}
                onAdd={onAdd}
                select={select}
              />
            ))}
          </SeriesBlock>
        );
      })}
    </>
  );
};

/** シリーズ 1 つ = 見出し(.hd + fold ボタン、見本 js:825-827) + 引き出し(.grp-list) */
const SeriesBlock: React.FC<{ label: string; isCurrent: boolean; children: React.ReactNode }> = ({ label, isCurrent, children }) => {
  const { t } = useTranslation();
  const { open, setOpen, listRef, initialHidden } = useDrawer(isCurrent);
  // 現在のプランがこのシリーズに移ってきたら開く(閉じていて選択中が見えない状態を避ける)
  const prevCurrent = React.useRef(isCurrent);
  React.useEffect(() => {
    if (isCurrent && !prevCurrent.current) setOpen(true);
    prevCurrent.current = isCurrent;
  }, [isCurrent, setOpen]);
  return (
    <>
      <div className="milspec-tr-hd">
        <button
          type="button"
          className="milspec-tr-fold"
          aria-expanded={open}
          aria-label={open ? t('milspec.sb_series_fold') : t('milspec.sb_series_unfold')}
          onClick={() => setOpen(!open)}
        >
          <MsIcon.fold />
        </button>
        <span onClick={() => setOpen(!open)}>{label}</span>
      </div>
      <div className="milspec-tr-list" ref={listRef} hidden={initialHidden}>{children}</div>
    </>
  );
};
