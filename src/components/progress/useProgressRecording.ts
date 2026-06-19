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
    /** 閉じ演出トリガ（nonce）。0=なし。記録確定時に立て、ドロワー/シートが閉じ演出を再生してから実際に閉じる。 */
    pendingClose: number;
    openPanel: () => void;
    closePanel: () => void;
    startRecordMode: () => void;
    stopRecordMode: () => void;
    /** タイムライン上の時間をクリックしたとき呼ぶ。1点記録 → トースト確定 → パネルを閉じる */
    commitReachedPos: (sec: number) => void;
    /** このセッションで最後に記録した1点だけ取り消す */
    undoLastRecord: () => void;
    /** 共同編集で他参加者が記録したとき、トーストだけ出す（閉じ演出/記録モード/自分のundo対象は触らない・データも変えない）。 */
    showRemoteToast: (kind: 'update' | 'nice', pct: number) => void;
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
    pendingClose: 0,
    openPanel: () => set({ panelOpen: true, pendingClose: 0 }),
    closePanel: () => set({ panelOpen: false, recordMode: false, pendingClose: 0 }),
    startRecordMode: () => set({ recordMode: true }),
    stopRecordMode: () => set({ recordMode: false }),
    commitReachedPos: (sec) => {
        const mit = useMitigationStore.getState();
        // 純粋閲覧者(collab readonly)は記録もトーストもしない（store側でも記録はブロックされるが、トースト誤発火を防ぐ）
        if (mit._collabReadonly && !mit._collabActive) return;
        // viewer ブロックは store 側でも効くが、ここでは記録前 progress を読んで種別判定する
        const before = mit.progress;
        const kind = classifyRecord(before, sec);
        mit.recordReachedPoint(sec); // {ts: Date.now(), reachedPos: sec} を append
        const after = useMitigationStore.getState().progress;
        const pct = computeProgressPercent(after, timelineTotal());
        // 追加された点の ts を拾う（recordReachedPoint が実際に追加したか = 末尾の reachedPos 一致で確認）
        const pts = after.points;
        const lastTs = pts.length && pts[pts.length - 1].reachedPos === sec ? pts[pts.length - 1].ts : null;
        const now = Date.now();
        // パネルはここで閉じない（panelOpen は true のまま）。pendingClose を立てて
        // ドロワー(PC)/シート(モバイル)に閉じ演出を再生させてから実際に閉じる（×/Esc と同じ閉じ方に統一）。
        set({
            recordMode: false,
            toast: { kind, pct, ts: now },
            lastRecordedTs: lastTs,
            pendingClose: now,
        });
    },
    undoLastRecord: () => {
        const ts = useProgressRecording.getState().lastRecordedTs;
        if (ts == null) return;
        const mit = useMitigationStore.getState();
        const pt = mit.progress.points.find((p) => p.ts === ts);
        if (pt) mit.removeProgressPoint(pt.id);
        set({ lastRecordedTs: null, toast: null });
    },
    showRemoteToast: (kind, pct) => set({ toast: { kind, pct, ts: Date.now() } }),
    clearToast: () => set({ toast: null }),
}));
