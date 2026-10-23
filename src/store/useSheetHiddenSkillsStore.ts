// スプシ表示で「列見出しの技アイコンを押して隠した技」。設定は全体で 1 つ(プランごとではない)・キーは技 ID。
// 同じ技 ID を持つジョブはどのメンバー・どのプランでも同じように隠れる。ブラウザに保存(persist)。
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SheetHiddenSkillsState {
    hiddenIds: string[];
    hide: (id: string) => void;
    show: (id: string) => void;
    showMany: (ids: readonly string[]) => void;
}

export const useSheetHiddenSkillsStore = create<SheetHiddenSkillsState>()(
    persist(
        (set) => ({
            hiddenIds: [],
            hide: (id) => set((s) => (s.hiddenIds.includes(id) ? s : { hiddenIds: [...s.hiddenIds, id] })),
            show: (id) => set((s) => (s.hiddenIds.includes(id) ? { hiddenIds: s.hiddenIds.filter((x) => x !== id) } : s)),
            showMany: (ids) => set((s) => {
                const drop = new Set(ids);
                return s.hiddenIds.some((x) => drop.has(x)) ? { hiddenIds: s.hiddenIds.filter((x) => !drop.has(x)) } : s;
            }),
        }),
        { name: 'sheet-hidden-skills', version: 1 },
    ),
);
