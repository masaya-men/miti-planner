import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicGallery } from '../../lib/housing/publicHousingWindow';
import { colorsFromImageUrl } from '../../lib/housing/color/housingColorFromUrl';
import { patchHousingColors } from '../../lib/housing/color/adminHousingColorsApi';
import {
    pendingForBackfill,
    runBackfill,
    type BackfillProgress,
    type BackfillTarget,
} from '../../lib/housing/color/housingColorBackfill';

/** 画面の段階: loading=一覧を読み込み中 / idle=始める前 / running=計算中 / paused=止めた・全部終わった / publishing=反映中 / published=反映済み / error */
export type BackfillPhase = 'loading' | 'idle' | 'running' | 'paused' | 'publishing' | 'published' | 'error';

/** 色の取り直しの状態と操作。画面は見た目だけ持つ。 */
export function useHousingColorBackfill() {
    const [phase, setPhase] = useState<BackfillPhase>('loading');
    const [listings, setListings] = useState<BackfillTarget[]>([]);
    const [progress, setProgress] = useState<BackfillProgress>({ done: 0, total: 0, unreadable: 0 });
    const [unreadable, setUnreadable] = useState<{ id: string }[]>([]);
    const [error, setError] = useState<string | null>(null);
    // 公開一覧は「反映する」まで更新されないので、この画面で済ませた家と読めなかった家を覚えておく
    const doneRef = useRef<Set<string>>(new Set());
    const unreadableRef = useRef<Set<string>>(new Set());
    const stopRef = useRef(false);
    const [doneTotal, setDoneTotal] = useState(0);

    const load = useCallback(async () => {
        setPhase('loading');
        setError(null);
        try {
            setListings(await fetchPublicGallery());
            setPhase('idle');
        } catch (e) {
            setError((e as Error).message);
            setPhase('error');
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const pending = pendingForBackfill(listings, doneRef.current);
    // 「始める」の対象: まだ試していない家(読めなかった家は「もう一度試す」で別に扱う)
    const fresh = pending.filter((l) => !unreadableRef.current.has(l.id));
    const retryTargets = pending.filter((l) => unreadableRef.current.has(l.id));

    const run = useCallback(async (targets: BackfillTarget[]) => {
        stopRef.current = false;
        setPhase('running');
        setError(null);
        try {
            const result = await runBackfill({
                targets,
                compute: colorsFromImageUrl,
                send: async (items, final) => {
                    const res = await patchHousingColors(items, final);
                    const rejected = new Set(res.rejected.map((r) => r.id));
                    items.forEach((i) => { if (!rejected.has(i.id)) doneRef.current.add(i.id); });
                    return res;
                },
                shouldStop: () => stopRef.current,
                onProgress: setProgress,
            });
            const retried = new Set(targets.map((t) => t.id));
            const stillBad = new Set(result.unreadable.map((u) => u.id));
            retried.forEach((id) => unreadableRef.current.delete(id));
            stillBad.forEach((id) => unreadableRef.current.add(id));
            setUnreadable([...unreadableRef.current].map((id) => ({ id })));
            setDoneTotal(doneRef.current.size);
            setPhase('paused');
        } catch (e) {
            setDoneTotal(doneRef.current.size);
            setError((e as Error).message);
            setPhase('error');
        }
    }, []);

    const start = useCallback(() => run(fresh), [run, fresh]);
    const retry = useCallback(() => run(retryTargets), [run, retryTargets]);
    const stop = useCallback(() => { stopRef.current = true; }, []);

    /** 最後に 1 回だけ。公開データの版を進め、全件ファイルを作り直す。 */
    const publish = useCallback(async () => {
        setPhase('publishing');
        setError(null);
        try {
            await patchHousingColors([], true);
            doneRef.current = new Set();
            setPhase('published');
            await load();
            setPhase('published');
        } catch (e) {
            setError((e as Error).message);
            setPhase('error');
        }
    }, [load]);

    return {
        phase, error, progress, unreadable, doneTotal,
        pendingCount: pending.length, freshCount: fresh.length, retryCount: retryTargets.length,
        start, retry, stop, publish, reload: load,
    };
}
