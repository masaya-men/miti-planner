import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { isTourExpired } from './lifecycle';
import { getOrCreateSessionId } from './presence';
import { joinSharedTour } from '../housingApiClient';
import type { SharedTourMeta, SharedTourLiveState } from '../../types/sharedTour';

/** useJoinTour の状態種別。connecting=接続中、notfound=存在しない/読めない、full=満員、ended=終了済み、viewing=閲覧中 */
export type JoinTourKind = 'connecting' | 'notfound' | 'full' | 'ended' | 'viewing';

export interface JoinTourState {
  kind: JoinTourKind;
  meta: SharedTourMeta | null;
  live: SharedTourLiveState | null;
}

const HEARTBEAT_INTERVAL_MS = 60_000;

/**
 * 参加者(未ログイン・匿名)が招待リンクを開いたときに使うフック。
 * shared_tours/{tourToken} を1回 getDoc → join-shared-tour API で入場ゲート(300人ソフト上限)を
 * 通過 → 通過できたときだけ .../live/current を onSnapshot 購読して幹事の現在位置に追従する。
 * 満員時は onSnapshot を一切張らない(コストを発生させない)。
 * Phase 0 で確定した方式(a)=匿名 onSnapshot 直読み(Firestore App Check = Unenforced)。
 */
export function useJoinTour(tourToken: string): JoinTourState {
  const [kind, setKind] = useState<JoinTourKind>('connecting');
  const [meta, setMeta] = useState<SharedTourMeta | null>(null);
  const [live, setLive] = useState<SharedTourLiveState | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let cancelled = false;
    let reachedServer = false;

    (async () => {
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

      const sessionId = getOrCreateSessionId();
      try {
        const joinResult = await joinSharedTour(tourToken, sessionId);
        if (cancelled) return;
        if (!joinResult.ok) {
          setKind(joinResult.reason === 'full' ? 'full' : 'notfound');
          return;
        }
      } catch (err) {
        console.error('[useJoinTour] join-shared-tour に失敗', err);
        if (!cancelled) setKind('notfound');
        return;
      }

      setMeta(snap.data() as SharedTourMeta);

      // 60秒毎に heartbeat(presence の lastSeenAt を更新し続ける)。失敗は無視(既に入場済みなので
      // 一時的な heartbeat 失敗で閲覧を中断させない)。
      heartbeat = setInterval(() => {
        void joinSharedTour(tourToken, sessionId).catch(() => {});
      }, HEARTBEAT_INTERVAL_MS);

      unsub = onSnapshot(
        doc(db, 'shared_tours', tourToken, 'live', 'current'),
        { includeMetadataChanges: true },
        (liveSnap) => {
          if (cancelled) return;

          if (liveSnap.metadata.fromCache && !reachedServer) {
            return;
          }
          reachedServer = true;

          if (!liveSnap.exists()) {
            setKind('ended');
            setLive(null);
            return;
          }

          const data = liveSnap.data() as SharedTourLiveState;
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
      if (heartbeat) clearInterval(heartbeat);
    };
  }, [tourToken]);

  return { kind, meta, live };
}
