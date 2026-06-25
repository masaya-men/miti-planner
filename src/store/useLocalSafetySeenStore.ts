import { create } from 'zustand';
import { isLocalSafetySeen, markLocalSafetySeen } from '../utils/localSafetySeen';

/**
 * ローカルデータ安全性の案内（赤バッジ＝要確認）を一度開いたかの共有状態。
 * サイドバー展開時のバーと、折りたたみ時のハンドルアイコンの両方が購読し、
 * どちらから開いても即座に赤バッジが消えるようにする（localStorage に永続）。
 */
interface LocalSafetySeenState {
  seen: boolean;
  markSeen: () => void;
}

export const useLocalSafetySeenStore = create<LocalSafetySeenState>((set) => ({
  seen: isLocalSafetySeen(),
  markSeen: () => {
    markLocalSafetySeen();
    set({ seen: true });
  },
}));
