// node 環境のテストでブラウザグローバル `self` を参照するコード
// （例: Firebase App Check 初期化）のためのポリフィル。
if (typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
}

// zustand persist が localStorage を呼ぶのでインメモリ版をポリフィル。
if (typeof (globalThis as any).localStorage === 'undefined') {
    const store = new Map<string, string>();
    (globalThis as any).localStorage = {
        getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
        clear: () => { store.clear(); },
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
    };
}
