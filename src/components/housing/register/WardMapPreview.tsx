import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WARD_MAP_LOADERS, type WardMapJson } from '../../../data/housing/wardMapManifest';
import { resolveWardMapRef } from '../../../lib/housing/resolveWardMapRef';
import { getAreaName } from '../../../lib/housing/areaName';
import { housingSizeMasterData } from '../../../data/masterData';
import type { HousingSize } from '../../../types/housing';

interface Props {
  area?: string;
  plot?: number;
  apartmentBuilding?: 1 | 2;
  buildingType?: 'house' | 'apartment';
  ward?: number;
  size?: HousingSize;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; json: WardMapJson; svg: string }
  | { status: 'error' };

/**
 * 登録ページ右カラムの土地ミニマップ (spec パートC)。
 * 住所が確定していない/不明な area は静かなプレースホルダに留め、地図の動的 import を発火させない。
 * 確定後は WARD_MAP_LOADERS で該当マップだけ遅延ロードし、中心点に発光マーカーを重ねる。
 */
export const WardMapPreview: React.FC<Props> = ({
  area,
  plot,
  apartmentBuilding,
  buildingType,
  ward,
  size,
}) => {
  const { t, i18n } = useTranslation();
  const ref = resolveWardMapRef(area ?? '', plot ?? null, apartmentBuilding ?? null, buildingType);
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    setState({ status: 'loading' });
    WARD_MAP_LOADERS[ref.mapKey]()
      .then(({ json, svg }) => {
        if (cancelled) return;
        setState({ status: 'ready', json, svg });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
    // ref は resolveWardMapRef の戻り値オブジェクトなので mapKey/highlightPlot/highlightKind を明示依存に
  }, [ref?.mapKey, ref?.highlightPlot, ref?.highlightKind]);

  if (!ref) {
    return (
      <div className="housing-ward-preview housing-ward-preview-placeholder" data-testid="housing-ward-preview-placeholder">
        <p className="housing-ward-preview-placeholder-text">
          {t('housing.register.map_preview.placeholder')}
        </p>
      </div>
    );
  }

  const summary = buildSummaryText(t, i18n.language, area, ward, plot, apartmentBuilding, buildingType, size);

  return (
    <div className="housing-ward-preview" data-testid="housing-ward-preview">
      {state.status === 'loading' && (
        <div className="housing-ward-preview-skeleton" data-testid="housing-ward-preview-skeleton" aria-hidden="true">
          <div className="housing-ward-preview-skeleton-block" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="housing-ward-preview-skeleton" data-testid="housing-ward-preview-error" aria-hidden="true">
          <div className="housing-ward-preview-skeleton-block" />
        </div>
      )}

      {state.status === 'ready' && (
        <WardMapPreviewMap json={state.json} svg={state.svg} highlightPlot={ref.highlightPlot} highlightKind={ref.highlightKind} />
      )}

      {summary && <p className="housing-ward-preview-summary">{summary}</p>}
    </div>
  );
};

interface MapProps {
  json: WardMapJson;
  svg: string;
  highlightPlot: number;
  highlightKind: 'plot' | 'apart';
}

const WardMapPreviewMap: React.FC<MapProps> = ({ json, svg, highlightPlot, highlightKind }) => {
  const { t } = useTranslation();
  const w = json.viewBox.w;
  const h = json.viewBox.h;
  const target = json.houses.find((house) => house.kind === highlightKind && house.plot === highlightPlot);

  return (
    <div className="housing-ward-preview-map-host" data-testid="housing-ward-preview-map">
      {/* Figma 書き出しのワードマップを inline 展開 (MapView.tsx と同パターン) */}
      <div
        className="housing-ward-preview-svg-host"
        role="img"
        aria-label={t('housing.register.map_preview.map_alt')}
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      {/* ハイライト用オーバーレイ (中心点発光マーカーのみ・区画形状はデータに無いため描画しない) */}
      <svg
        className="housing-ward-preview-overlay"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {target && (
          <g className="housing-ward-preview-marker">
            <circle
              className="housing-ward-preview-marker-pulse"
              cx={target.x * w}
              cy={target.y * h}
              r="16"
            />
            <circle
              className="housing-ward-preview-marker-core"
              cx={target.x * w}
              cy={target.y * h}
              r="7"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

function buildSummaryText(
  t: (key: string, opts?: Record<string, unknown>) => string,
  lang: string,
  area: string | undefined,
  ward: number | undefined,
  plot: number | undefined,
  apartmentBuilding: 1 | 2 | undefined,
  buildingType: 'house' | 'apartment' | undefined,
  size: HousingSize | undefined,
): string | null {
  if (!area) return null;
  const areaName = getAreaName(area as Parameters<typeof getAreaName>[0], lang) || area;
  const parts: string[] = [areaName];
  if (ward != null) parts.push(t('housing.register.map_preview.summary_ward', { ward }));

  if (buildingType === 'apartment') {
    parts.push(t(
      apartmentBuilding === 2
        ? 'housing.register.apartment_building.sub'
        : 'housing.register.apartment_building.main',
    ));
  } else if (plot != null) {
    parts.push(t('housing.register.map_preview.summary_plot', { plot }));
    if (size) {
      const label = housingSizeMasterData.find((m) => m.id === size)?.label ?? size;
      parts.push(label);
    }
  }

  return parts.join(t('housing.register.map_preview.summary_separator'));
}
