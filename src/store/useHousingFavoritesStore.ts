import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface HousingFavoritesState {
    ids: string[];
    add: (id: string) => void;
    remove: (id: string) => void;
    contains: (id: string) => boolean;
    reset: () => void;
    /** サーバー同期 (favoritesSync) が ids 配列を丸ごと置き換えるための入口。 */
    setAll: (ids: string[]) => void;
}

/** 重複を除去しつつ挿入順 (先勝ち) を維持する (Set は挿入順を保持する仕様)。 */
const dedupeIds = (ids: string[]): string[] => Array.from(new Set(ids));

export const useHousingFavoritesStore = create<HousingFavoritesState>()(
    persist(
        (set, get) => ({
            ids: [],
            add: (id) => set((s) => (s.ids.includes(id) ? s : { ids: [...s.ids, id] })),
            remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
            contains: (id) => get().ids.includes(id),
            reset: () => set({ ids: [] }),
            setAll: (ids) => set({ ids: dedupeIds(ids) }),
        }),
        {
            name: 'housing-favorites',
            storage: createJSONStorage(() => localStorage),
            // バグ修正 (2026-07-17): add() には重複ガードがあるが、それは新規追加にしか効かず、
            // localStorage に何らかの経路で既に紛れ込んだ重複 id は rehydrate 時にそのまま
            // 読み込まれ続けていた (お気に入り件数の水増し/カードの2重表示の一因)。
            // rehydrate のたびに ids を正規化することで、永続データを直接書き換えることなく
            // (次の add/remove 操作時に正規化後の配列が自然に書き戻る) 表示・件数を正しく保つ。
            merge: (persistedState, currentState) => {
                const persisted = persistedState as { ids?: unknown } | null | undefined;
                const ids = Array.isArray(persisted?.ids)
                    ? dedupeIds(persisted.ids as string[])
                    : currentState.ids;
                return { ...currentState, ids };
            },
        }
    )
);
