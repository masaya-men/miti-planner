import { create } from 'zustand';

/**
 * ハウジング画面のモーダル開閉状態を管理する store。
 *
 * - login / account: 短命なステート (URL に含めない)
 * - register: URL クエリ `?register=open` と双方向 sync (ブラウザバックで閉じる)
 *
 * URL ↔ store の sync は HousingWorkspace 側で navigate + syncFromUrl を呼んで実現する
 * (store 自体は navigate を持たない = test 可能性のため)。
 */

interface LoginState {
    open: boolean;
    fromRegister: boolean;
}

interface RegisterState {
    open: boolean;
}

interface AccountState {
    open: boolean;
}

interface HousingModalState {
    login: LoginState;
    account: AccountState;
    register: RegisterState;

    openLogin: (opts?: { fromRegister?: boolean }) => void;
    closeLogin: () => void;
    openAccount: () => void;
    closeAccount: () => void;
    openRegister: () => void;
    closeRegister: () => void;
    syncFromUrl: (searchParams: URLSearchParams) => void;
}

export const useHousingModalStore = create<HousingModalState>((set, get) => ({
    login: { open: false, fromRegister: false },
    account: { open: false },
    register: { open: false },

    openLogin: (opts) => {
        set({ login: { open: true, fromRegister: opts?.fromRegister ?? false } });
    },

    closeLogin: () => {
        const { login } = get();
        if (login.fromRegister) {
            // 経路 B: 登録モーダル経由で開いていたら、登録モーダルも一緒に閉じる
            set({
                login: { open: false, fromRegister: false },
                register: { open: false },
            });
        } else {
            // 経路 A: TopBar から直接開いたら、login だけ閉じる
            set({ login: { open: false, fromRegister: false } });
        }
    },

    openAccount: () => set({ account: { open: true } }),
    closeAccount: () => set({ account: { open: false } }),

    openRegister: () => set({ register: { open: true } }),
    closeRegister: () => set({ register: { open: false } }),

    syncFromUrl: (searchParams) => {
        const shouldOpenRegister = searchParams.get('register') === 'open';
        set({ register: { open: shouldOpenRegister } });
    },
}));
