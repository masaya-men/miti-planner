// 記録モード store — 到達点記録パネルの開閉 + 記録モード ON/OFF + 記録トースト/直前undo を管理する
import { create } from 'zustand';
import { useMitigationStore } from '../../store/useMitigationStore';
import { classifyRecord, computeProgressPercent } from '../../lib/progressLogic';

export interface ProgressToast {
    kind: 'update' | 'nice';
    pct: number;
    ts: number; // 再生トリガ（同じ kind/pct でも ts 変化で再再生）
}

interface ProgressRecordingState {
    panelOpen: boolean;
    recordMode: boolean;
    toast: ProgressToast | null;
    lastRecordedTs: number | null;
    openPanel: () => void;
    closePanel: () => void;
    startRecordMode: () => void;
    stopRecordMode: () => void;
    /** タイムライン上の時間をクリックしたとき呼ぶ。1点記録 → トースト確定 → パネルを閉じる */
    commitReachedPos: (sec: number) => void;
    /** このセッションで最後に記録した1点だけ取り消す */
    undoLastRecord: () => void;
    clearToast: () => void;
}

function timelineTotal(): number {
    const ev = useMitigationStore.getState().timelineEvents;
    return ev.length ? Math.max(...ev.map((e) => e.time)) : 0;
}

export const useProgressRecording = create<ProgressRecordingState>((set) => ({
    panelOpen: false,
    recordMode: false,
    toast: null,
    lastRecordedTs: null,
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false, recordMode: false }),
    startRecordMode: () => set({ recordMode: true }),
    stopRecordMode: () => set({ recordMode: false }),
    commitReachedPos: (sec) => {
        const mit = useMitigationStore.getState();
        // viewer ブロックは store 側でも効くが、ここでは記録前 progress を読んで種別判定する
        const before = mit.progress;
        const kind = classifyRecord(before, sec);
        mit.recordReachedPoint(sec); // {ts: Date.now(), reachedPos: sec} を append
        const after = useMitigationStore.getState().progress;
        const pct = computeProgressPercent(after, timelineTotal());
        // 追加された点の ts を拾う（recordReachedPoint が実際に追加したか = 末尾の reachedPos 一致で確認）
        const pts = after.points;
        const lastTs = pts.length && pts[pts.length - 1].reachedPos === sec ? pts[pts.length - 1].ts : null;
        set({
            panelOpen: false,
            recordMode: false,
            toast: { kind, pct, ts: Date.now() },
            lastRecordedTs: lastTs,
        });
    },
    undoLastRecord: () => {
        const ts = useProgressRecording.getState().lastRecordedTs;
        if (ts == null) return;
        const mit = useMitigationStore.getState();
        const idx = mit.progress.points.findIndex((p) => p.ts === ts);
        if (idx >= 0) mit.removeProgressPoint(idx);
        set({ lastRecordedTs: null, toast: null });
    },
    clearToast: () => set({ toast: null }),
}));
