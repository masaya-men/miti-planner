import { create } from 'zustand';

/**
 * 共有ツアーの「参加中」状態をアプリ全体で保持する軽量ストア (#1・案い)。
 *
 * 参加の実体は招待リンクの token。JoinTourPage が viewing 中に setToken で記録し、
 * 参加者が探す等へ移動しても token を覚えておくことで、ヘッダーに「ツアーに戻る」ピルを出せる。
 * sessionStorage に載せてタブ内リロードでも保持する (タブを閉じれば自然に消える)。
 * 「ツアーから出る」/ピルの ✕ / ツアー終了 で clear する。
 */
const STORAGE_KEY = 'lopo_joined_tour_token';

function readInitial(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

interface JoinedTourState {
  /** 参加中の共有ツアーの token。null=参加していない。 */
  token: string | null;
  /** 参加を記録する (JoinTourPage が viewing で呼ぶ・冪等)。 */
  setToken: (token: string) => void;
  /** 参加を解除する (退出・ピル✕・ツアー終了)。 */
  clear: () => void;
}

export const useJoinedTourStore = create<JoinedTourState>((set) => ({
  token: readInitial(),
  setToken: (token) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch {
      /* sessionStorage 不可 (プライベート等) でも state は更新する */
    }
    set({ token });
  },
  clear: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    set({ token: null });
  },
}));
