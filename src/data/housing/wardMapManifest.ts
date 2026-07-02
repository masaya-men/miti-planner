export interface WardMapJson {
  area: string;
  viewBox: { w: number; h: number };
  nodes: Array<{ id: string; x: number; y: number }>;
  edges: Array<{ a: string; b: string; polyline: number[][] }>;
  houses: Array<{ kind: 'plot' | 'apart'; plot: number; x: number; y: number; node: string | null }>;
  roadPath: string;
  // 一部エリア (Lavender/Shirogane/Empyreum の main/sub) は SVG に赤線ナビ表示要素が無く null。
  visibleRoadPath: string | null;
}

type WardMapAsset = { json: WardMapJson; svg: string };

/** mapKey → 遅延ローダ。Vite の動的 import + ?raw で該当マップだけ読む。 */
export const WARD_MAP_LOADERS: Record<string, () => Promise<WardMapAsset>> = {
  mist: async () => ({
    json: (await import('./mistWard.generated.json')).default as WardMapJson,
    svg: (await import('./mist.generated.svg?raw')).default,
  }),
  'mist-sub': async () => ({
    json: (await import('./mistSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./mistSub.generated.svg?raw')).default,
  }),
  goblet: async () => ({
    json: (await import('./gobletWard.generated.json')).default as WardMapJson,
    svg: (await import('./goblet.generated.svg?raw')).default,
  }),
  'goblet-sub': async () => ({
    json: (await import('./gobletSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./gobletSub.generated.svg?raw')).default,
  }),
  lavender: async () => ({
    json: (await import('./lavenderWard.generated.json')).default as WardMapJson,
    svg: (await import('./lavender.generated.svg?raw')).default,
  }),
  'lavender-sub': async () => ({
    json: (await import('./lavenderSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./lavenderSub.generated.svg?raw')).default,
  }),
  shirogane: async () => ({
    json: (await import('./shiroganeWard.generated.json')).default as WardMapJson,
    svg: (await import('./shirogane.generated.svg?raw')).default,
  }),
  'shirogane-sub': async () => ({
    json: (await import('./shiroganeSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./shiroganeSub.generated.svg?raw')).default,
  }),
  empyreum: async () => ({
    json: (await import('./empyreumWard.generated.json')).default as WardMapJson,
    svg: (await import('./empyreum.generated.svg?raw')).default,
  }),
  'empyreum-sub': async () => ({
    json: (await import('./empyreumSubWard.generated.json')).default as WardMapJson,
    svg: (await import('./empyreumSub.generated.svg?raw')).default,
  }),
};
