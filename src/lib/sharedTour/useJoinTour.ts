import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isTourExpired } from './lifecycle';
import type { SharedTourMeta, SharedTourLiveState } from '../../types/sharedTour';

/** useJoinTour の状態種別。connecting=接続中、notfound=存在しない/読めない、ended=終了済み、viewing=閲覧中 */
export type JoinTourKind = 'connecting' | 'notfound' | 'ended' | 'viewing';

export interface JoinTourState {
  kind: JoinTourKind;
  meta: SharedTourMeta | null;
  live: SharedTourLiveState | null;
}

/**
 * 参加者（未ログイン・匿名）が招待リンクを開いたときに使うフック。
 * shared_tours/{tourToken} を1回 getDoc（家スナップショット等の不変メタ）→
 * .../live/current を onSnapshot 購読して幹事の現在位置に追従する。
 * Phase 0 で確定した方式(a)=匿名 onSnapshot 直読み（Firestore App Check = Unenforced）。
 */
export function useJoinTour(tourToken: string): JoinTourState {
  const [kind, setKind] = useState<JoinTourKind>('connecting');
  const [meta, setMeta] = useState<SharedTourMeta | null>(null);
  const [live, setLive] = useState<SharedTourLiveState | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    // persistentLocalCache はキャッシュ発火→サーバー到達の順で onNext が呼ばれうる。
    // サーバー到達前のキャッシュ発火では確定扱いにしないためのフラグ。
    let reachedServer = false;

    (async () => {
      // tourToken が変わるたびに初期化し直す
      setKind('connecting');
      setMeta(null);
      setLive(null);

      let snap;
      try {
        snap = await getDoc(doc(db, 'shared_tours', tourToken));
      } catch (err) {
        console.error('[useJoinTour] shared_tours の取得に失敗', err);
        if (!cancelled) setKind('notfound');
        return;
      }
      if (cancelled) return;

      if (!snap.exists()) {
        setKind('notfound');
        return;
      }

      setMeta(snap.data() as SharedTourMeta);

      unsub = onSnapshot(
        doc(db, 'shared_tours', tourToken, 'live', 'current'),
        (liveSnap) => {
          if (cancelled) return;

          if (!liveSnap.exists()) {
            // live doc が消えた（GC 等）→ 終了扱い
            setKind('ended');
            setLive(null);
            return;
          }

          const data = liveSnap.data() as SharedTourLiveState;

          if (liveSnap.metadata.fromCache && !reachedServer) {
            // まだサーバー未到達のキャッシュ発火。kind は connecting を維持する
            return;
          }

          reachedServer = true;
          setLive(data);
          setKind(isTourExpired(data, Date.now()) ? 'ended' : 'viewing');
        },
        (err) => {
          console.error('[useJoinTour] live/current の購読に失敗', err);
          if (!cancelled) setKind('notfound');
        },
      );
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [tourToken]);

  return { kind, meta, live };
}
