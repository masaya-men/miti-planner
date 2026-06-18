// 記録モード store — 到達点記録パネルの開閉 + 記録モードの ON/OFF を管理する
import { create } from 'zustand';
import { useMitigationStore } from '../../store/useMitigationStore';

interface ProgressRecordingState {
    panelOpen: boolean;
    recordMode: boolean;
    openPanel: () => void;
    closePanel: () => void;
    startRecordMode: () => void;
    stopRecordMode: () => void;
    /** タイムライン上の時間をクリックしたとき呼ぶ。recordReachedPoint を実行して記録モードを終了 */
    commitReachedPos: (sec: number) => void;
}

export const useProgressRecording = create<ProgressRecordingState>((set) => ({
    panelOpen: false,
    recordMode: false,
    openPanel: () => set({ panelOpen: true }),
    closePanel: () => set({ panelOpen: false, recordMode: false }),
    startRecordMode: () => set({ recordMode: true }),
    stopRecordMode: () => set({ recordMode: false }),
    commitReachedPos: (sec) => {
        useMitigationStore.getState().recordReachedPoint(sec);
        set({ recordMode: false });
    },
}));
