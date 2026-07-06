import type { MockListing } from '../../data/housing/mockListings';
import type { WardMapJson } from '../../data/housing/wardMapManifest';
import type { HousingArea } from '../../store/useHousingFilterStore';

/** DEV専用ツアープレビューの対象 10 マップ。WARD_MAP_LOADERS のキー順(エリアごとに 本街→拡張)。 */
export const PREVIEW_MAPS: ReadonlyArray<{ mapKey: string; area: HousingArea; isSub: boolean }> = [
  { mapKey: 'mist', area: 'Mist', isSub: false },
  { mapKey: 'mist-sub', area: 'Mist', isSub: true },
  { mapKey: 'goblet', area: 'Goblet', isSub: false },
  { mapKey: 'goblet-sub', area: 'Goblet', isSub: true },
  { mapKey: 'lavender', area: 'LavenderBeds', isSub: false },
  { mapKey: 'lavender-sub', area: 'LavenderBeds', isSub: true },
  { mapKey: 'shirogane', area: 'Shirogane', isSub: false },
  { mapKey: 'shirogane-sub', area: 'Shirogane', isSub: true },
  { mapKey: 'empyreum', area: 'Empyreum', isSub: false },
  { mapKey: 'empyreum-sub', area: 'Empyreum', isSub: true },
];

const AREA_LABEL: Record<HousingArea, string> = {
  Mist: 'ミスト', Goblet: 'ゴブレット', LavenderBeds: 'ラベンダーベッド', Shirogane: 'シロガネ', Empyreum: 'エンピレアム',
};

/**
 * 全ワード地図の実在住所を仮 MockListing 列にする(DEV専用ツアープレビュー用の純関数)。
 * 並び = loaded の順(エリアごとに 本街→拡張)、各地図内は plot 昇順 → アパート。
 * area/plot/apartmentBuilding/buildingType は本物、写真/メモ無し、title はサンプルラベル。
 */
export function buildAllAddressListings(
  loaded: Array<{ area: HousingArea; isSub: boolean; json: WardMapJson }>,
): MockListing[] {
  const out: MockListing[] = [];
  let i = 0;
  for (const m of loaded) {
    const plots = m.json.houses.filter((h) => h.kind === 'plot').sort((a, b) => a.plot - b.plot);
    const aparts = m.json.houses.filter((h) => h.kind === 'apart');
    for (const h of plots) {
      out.push(makeListing(i++, m.area, m.isSub, 'house', m.isSub ? h.plot + 30 : h.plot, null));
    }
    for (const _h of aparts) {
      out.push(makeListing(i++, m.area, m.isSub, 'apartment', null, m.isSub ? 2 : 1));
    }
  }
  return out;
}

function makeListing(
  i: number, area: HousingArea, isSub: boolean,
  buildingType: 'house' | 'apartment', plot: number | null, apartmentBuilding: 1 | 2 | null,
): MockListing {
  const createdAt = 1715000000000 - i * 1000;
  const label = buildingType === 'apartment'
    ? `${AREA_LABEL[area]} アパルトメント棟${apartmentBuilding}`
    : `${AREA_LABEL[area]}${isSub ? '拡張' : ''} ${plot}番地`;
  const listing: MockListing = {
    id: buildingType === 'apartment' ? `preview-${area}-apart-${apartmentBuilding}` : `preview-${area}-plot-${plot}`,
    ownerUid: 'preview',
    dc: 'PreviewDC', server: 'PreviewWorld', region: 'JP',
    area, ward: (i % 30) + 1,
    buildingType,
    imageMode: 'none',
    tags: [],
    title: label,
    visibility: 'public',
    createdAt, lastConfirmedAt: createdAt,
    addressKey: `preview|${area}|${buildingType}|${plot ?? `apart${apartmentBuilding}`}`,
  };
  if (buildingType === 'apartment') {
    listing.apartmentBuilding = apartmentBuilding ?? 1;
    listing.roomNumber = 1;
  } else {
    listing.plot = plot ?? 1;
    listing.size = 'M';
  }
  return listing;
}
