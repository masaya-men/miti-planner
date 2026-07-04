import { useEffect, useState } from 'react';
import { WARD_MAP_LOADERS, type WardMapJson } from '../../data/housing/wardMapManifest';

export type WardMapAssetState =
  | { status: 'idle' } | { status: 'loading' }
  | { status: 'ready'; json: WardMapJson; svg: string } | { status: 'error' };

/** mapKey → WARD_MAP_LOADERS で該当ワード地図(json+inline svg)だけ遅延ロード。mapKey=null は idle。 */
export function useWardMapAsset(mapKey: string | null): WardMapAssetState {
  const [state, setState] = useState<WardMapAssetState>({ status: 'idle' });
  useEffect(() => {
    if (!mapKey) { setState({ status: 'idle' }); return; }
    const loader = WARD_MAP_LOADERS[mapKey];
    if (!loader) { setState({ status: 'error' }); return; }
    let cancelled = false; setState({ status: 'loading' });
    loader().then(({ json, svg }) => { if (!cancelled) setState({ status: 'ready', json, svg }); })
            .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [mapKey]);
  return state;
}
