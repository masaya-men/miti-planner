import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// vitest は environment: 'node' で動くため sessionStorage は未定義。
// useHousingViewStore は persist middleware で sessionStorage を参照するので、
// import 前にインメモリポリフィルを globalThis に注入する。
beforeAll(() => {
    if (typeof (globalThis as any).sessionStorage === 'undefined') {
        const store = new Map<string, string>();
        (globalThis as any).sessionStorage = {
            getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
            setItem: (k: string, v: string) => { store.set(k, v); },
            removeItem: (k: string) => { store.delete(k); },
            clear: () => { store.clear(); },
            key: (i: number) => Array.from(store.keys())[i] ?? null,
            get length() { return store.size; },
        };
    }
});

import { useHousingViewStore } from '../../store/useHousingViewStore';

describe('useHousingViewStore', () => {
    beforeEach(() => {
        useHousingViewStore.getState().reset();
    });

    it('defaults to pinterest (list) view, both panels open, browse mode', () => {
        const s = useHousingViewStore.getState();
        expect(s.viewMode).toBe('pinterest');
        expect(s.leftPanelOpen).toBe(true);
        expect(s.rightPanelOpen).toBe(true);
        expect(s.mode).toBe('browse');
    });

    it('toggles view mode', () => {
        useHousingViewStore.getState().setViewMode('map');
        expect(useHousingViewStore.getState().viewMode).toBe('map');
    });

    it('toggles left panel', () => {
        useHousingViewStore.getState().setLeftPanelOpen(false);
        expect(useHousingViewStore.getState().leftPanelOpen).toBe(false);
    });

    it('switches to tour mode and forces right panel open', () => {
        useHousingViewStore.getState().setRightPanelOpen(false);
        useHousingViewStore.getState().enterTourMode();
        expect(useHousingViewStore.getState().mode).toBe('tour');
        expect(useHousingViewStore.getState().rightPanelOpen).toBe(true);
    });

    it('reset returns to defaults', () => {
        useHousingViewStore.getState().setViewMode('map');
        useHousingViewStore.getState().enterTourMode();
        useHousingViewStore.getState().reset();
        expect(useHousingViewStore.getState().viewMode).toBe('pinterest');
        expect(useHousingViewStore.getState().mode).toBe('browse');
    });
});
