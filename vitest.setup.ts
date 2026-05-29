// @testing-library/jest-dom のカスタムマッチャーを有効化（toBeInTheDocument 等）
import '@testing-library/jest-dom';

// happy-dom では window.confirm が未定義のため、テスト用にポリフィル
if (typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).window.confirm === 'undefined') {
    (globalThis as any).window.confirm = () => true;
}

// node 環境のテストでブラウザグローバル `self` を参照するコード
// （例: Firebase App Check 初期化）のためのポリフィル。
if (typeof (globalThis as any).self === 'undefined') {
    (globalThis as any).self = globalThis;
}

// happy-dom は Web Animations API (Element.animate) を未実装。
// PinterestView のカード FLIP/フェード演出や tutorial の PartyAutoFill が
// el.animate() を呼ぶと throw するため、テスト環境用の最小スタブを当てる
// (本番ブラウザは実装済みなので影響なし)。戻り値の Animation はほぼ未使用だが、
// 念のため finished/onfinish 等を持つダミーを返す。
{
    const ElementCtor = (globalThis as any).Element;
    if (ElementCtor && typeof ElementCtor.prototype.animate !== 'function') {
        ElementCtor.prototype.animate = function () {
            return {
                cancel() {}, finish() {}, play() {}, pause() {}, reverse() {},
                onfinish: null, oncancel: null,
                finished: Promise.resolve(),
                currentTime: 0, playState: 'finished',
                addEventListener() {}, removeEventListener() {},
            };
        };
    }
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
