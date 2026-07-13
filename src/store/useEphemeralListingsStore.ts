import { create } from 'zustand';
import type { MockListing } from '../data/housing/mockListings';
import { EPHEMERAL_POOL_LIMIT } from '../lib/housing/ephemeralListing';

/**
 * 一時 listing (`ephemeral-` prefix の `MockListing`) 専用 store。
 *
 * persist なし = リロードで消えるのが仕様 (計画書 §2-4)。 Firestore にも保存しない。
 * `add` は `EPHEMERAL_POOL_LIMIT` (30件) を超えると追加せず `false` を返す
 * (呼び出し側でユーザーに上限到達を通知する想定)。
 */
interface EphemeralListingsState {
    ephemeralListings: MockListing[];
    add: (l: MockListing) => boolean;
    remove: (id: string) => void;
    clear: () => void;
}

export const useEphemeralListingsStore = create<EphemeralListingsState>((set, get) => ({
    ephemeralListings: [],
    add: (l) => {
        if (get().ephemeralListings.length >= EPHEMERAL_POOL_LIMIT) return false;
        set((s) => ({ ephemeralListings: [...s.ephemeralListings, l] }));
        return true;
    },
    remove: (id) => set((s) => ({ ephemeralListings: s.ephemeralListings.filter((x) => x.id !== id) })),
    clear: () => set({ ephemeralListings: [] }),
}));
