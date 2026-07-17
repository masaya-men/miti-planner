import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { SharedTourLiveState } from '../../types/sharedTour';

/** live/current の doc 参照を作る（shared_tours/{tourToken}/live/current）。 */
function liveDocRef(tourToken: string) {
  return doc(db, 'shared_tours', tourToken, 'live', 'current');
}

/**
 * 幹事の操作（前へ/見学/次へ）で live state を直書きする。
 * currentIndex / phase / viewStartAt を渡し、lastActivityAt は書き込み時刻で更新。
 * rules で hostUid 本人のみ update 可（Task 1.5）。
 */
export async function pushHostState(
  tourToken: string,
  patch: Pick<SharedTourLiveState, 'currentIndex' | 'phase' | 'viewStartAt'>,
): Promise<void> {
  await updateDoc(liveDocRef(tourToken), {
    ...patch,
    lastActivityAt: Date.now(),
  });
}

/** 幹事の「ツアー終了」で status を ended にする（lastActivityAt も更新）。 */
export async function endHostTour(tourToken: string): Promise<void> {
  await updateDoc(liveDocRef(tourToken), {
    status: 'ended',
    lastActivityAt: Date.now(),
  });
}
