import type * as Y from 'yjs';
import { indexOfMitigation } from './yjsMitigations';

const SERAPH_DURATION = 22;

/** id の配列を順に Y.Array から削除する(毎回 index を取り直すため index ずれに安全)。 */
export function removeByIds(arr: Y.Array<Y.Map<unknown>>, ids: string[]): void {
  for (const id of ids) {
    const j = indexOfMitigation(arr, id);
    if (j >= 0) arr.delete(j, 1);
  }
}

/** セラフィム配置/移動時に重複削除すべき同一学者の転化(dissipation)の id を集める。 */
export function dissipationIdsOverlapping(
  arr: Y.Array<Y.Map<unknown>>,
  ownerId: unknown,
  seraphStart: number,
  excludeId: string | null,
): string[] {
  const seraphEnd = seraphStart + SERAPH_DURATION;
  const ids: string[] = [];
  for (let i = 0; i < arr.length; i++) {
    const ym = arr.get(i);
    if (ym.get('id') === excludeId) continue;
    if (ym.get('mitigationId') === 'dissipation' && ym.get('ownerId') === ownerId) {
      const ds = ym.get('time') as number;
      const de = ds + (ym.get('duration') as number);
      if (!(de <= seraphStart || ds >= seraphEnd)) ids.push(ym.get('id') as string);
    }
  }
  return ids;
}
