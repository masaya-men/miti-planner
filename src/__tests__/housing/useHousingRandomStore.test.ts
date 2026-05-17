import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// vitest は environment: 'node' で動くため sessionStorage は未定義。
// useHousingRandomStore は persist middleware で sessionStorage を参照するので、
// import 前にインメモリポリフィルを globalThis に注入する。
// (useHousingViewStore.test.ts と同じパターン)
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

import { useHousingRandomStore } from '../../store/useHousingRandomStore';

describe('useHousingRandomStore', () => {
    beforeEach(() => {
        sessionStorage.clear();
        useHousingRandomStore.getState().reset();
    });

    it('starts with no selection', () => {
        expect(useHousingRandomStore.getState().selectedWardId).toBeNull();
    });

    it('records a selection', () => {
        useHousingRandomStore.getState().selectWard('mana-pandaemonium-shirogane-3');
        expect(useHousingRandomStore.getState().selectedWardId).toBe('mana-pandaemonium-shirogane-3');
    });

    it('reset clears selection', () => {
        useHousingRandomStore.getState().selectWard('x');
        useHousingRandomStore.getState().reset();
        expect(useHousingRandomStore.getState().selectedWardId).toBeNull();
    });
});
