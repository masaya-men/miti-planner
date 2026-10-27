import type { MitigationState, SliceContext } from './types';

export const createViewSlice = ({ set }: SliceContext): Pick<MitigationState,
    'setMyMemberId' | 'setMyJobHighlight' | 'setHideEmptyRows' | 'setShowRowBorders' | 'setSheetRowBorders' | 'toggleHiddenPartyMember' | 'setHiddenPartyMemberIds' | 'setClipboardEvent' | 'setTimelineSortOrder'
> => ({
    setMyMemberId: (memberId) => {
        set({ myMemberId: memberId });
        // (チュートリアルイベント削除済み: myjob:set)
    },
    setMyJobHighlight: (enabled) => set({ myJobHighlight: enabled }),
    setHideEmptyRows: (hide) => set({ hideEmptyRows: hide }),
    setShowRowBorders: (show) => set({ showRowBorders: show }),
    setSheetRowBorders: (show) => set({ sheetRowBorders: show }),
    toggleHiddenPartyMember: (id) => set((state) => ({
        hiddenPartyMemberIds: state.hiddenPartyMemberIds.includes(id)
            ? state.hiddenPartyMemberIds.filter((mid) => mid !== id)
            : [...state.hiddenPartyMemberIds, id],
    })),
    setHiddenPartyMemberIds: (ids) => set({ hiddenPartyMemberIds: ids }),
    setClipboardEvent: (event) => set({ clipboardEvent: event }),
    setTimelineSortOrder: (order) => set({ timelineSortOrder: order }),
});
