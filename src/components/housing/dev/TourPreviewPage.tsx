import { useEffect, useState } from 'react';
import type { MockListing } from '../../../data/housing/mockListings';
import { WARD_MAP_LOADERS } from '../../../data/housing/wardMapManifest';
import { PREVIEW_MAPS, buildAllAddressListings } from '../../../lib/housing/devTourPreview';
import { useHousingListingsStore } from '../../../store/useHousingListingsStore';
import { useHousingTourStore } from '../../../store/useHousingTourStore';
import { getPlotEntrance } from '../../../lib/housing/plotEntrance';
import { TourNavPage } from '../pages/TourNavPage';

/**
 * DEV専用: 全住所ツアープレビュー。本番 TourNavPage を無改変で再利用し、
 * 全住所(≈310)の仮ツアーをストアに流して 1 件ずつ目視 QA する。本番 build 非露出。
 */
export const TourPreviewPage: React.FC = () => {
  const [listings, setListings] = useState<MockListing[] | null>(null);
  const [hideBaseline, setHideBaseline] = useState(false); // 本番の見た目(赤ナビ基準線オフ)で確認するトグル
  const currentIndex = useHousingTourStore((s) => s.currentIndex);

  // 10 マップを既存の遅延ローダで読み、全住所の仮 listing を生成。
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      PREVIEW_MAPS.map((m) => WARD_MAP_LOADERS[m.mapKey]().then(({ json }) => ({ area: m.area, isSub: m.isSub, json }))),
    ).then((loaded) => {
      if (!cancelled) setListings(buildAllAddressListings(loaded));
    });
    return () => { cancelled = true; };
  }, []);

  // 生成できたらストアへ注入 (本番アクション無改変・setState 直書き)。離脱時に reset。
  useEffect(() => {
    if (!listings) return;
    useHousingListingsStore.setState({ status: 'ready', listings });
    const tour = useHousingTourStore.getState();
    tour.setListings(listings.map((l) => l.id));
    tour.start();
    return () => {
      useHousingTourStore.getState().reset();
      useHousingListingsStore.setState({ status: 'idle', listings: [] });
    };
  }, [listings]);

  if (!listings) {
    return (
      <div className="housing-dev-tourpreview">
        <div className="housing-dev-tourpreview-bar">全住所を読み込み中…</div>
      </div>
    );
  }

  const total = listings.length;
  const current = listings[currentIndex] ?? null;
  const hasEntrance = current
    ? getPlotEntrance(current.area, current.plot, current.buildingType, current.apartmentBuilding) != null
    : false;
  const goto = (i: number) =>
    useHousingTourStore.setState({ currentIndex: Math.max(0, Math.min(total - 1, i)) });

  return (
    <div className={`housing-dev-tourpreview${hideBaseline ? ' is-hide-baseline' : ''}`}>
      <div className="housing-dev-tourpreview-bar">
        <span className="housing-dev-tourpreview-count">{currentIndex + 1} / {total}</span>
        <span className="housing-dev-tourpreview-label">{current?.title ?? '-'}</span>
        {current && (
          <span className={`housing-dev-tourpreview-badge ${hasEntrance ? 'housing-dev-tourpreview-badge--entrance' : 'housing-dev-tourpreview-badge--geo'}`}>
            {hasEntrance ? '入口補正あり' : '幾何'}
          </span>
        )}
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(currentIndex - 1)} disabled={currentIndex === 0}>前へ</button>
        <button type="button" className="housing-dev-tourpreview-btn" onClick={() => goto(currentIndex + 1)} disabled={currentIndex >= total - 1}>次へ</button>
        <select
          className="housing-dev-tourpreview-btn housing-dev-tourpreview-jump"
          value={currentIndex}
          onChange={(e) => goto(Number(e.target.value))}
          aria-label="住所ジャンプ"
        >
          {listings.map((l, idx) => (
            <option key={l.id} value={idx}>{l.title}</option>
          ))}
        </select>
        <label className="housing-dev-tourpreview-count" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={hideBaseline} onChange={(e) => setHideBaseline(e.target.checked)} />
          赤線を隠す(本番の見た目)
        </label>
      </div>
      {/* key で住所ごとに新規マウント = 完了画面等のローカル状態残りを防ぐ */}
      <TourNavPage key={currentIndex} />
    </div>
  );
};
