import { create } from 'zustand';

interface LocalImportDialogState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
}

export const useLocalImportDialog = create<LocalImportDialogState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
}));
