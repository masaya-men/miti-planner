import { useLayoutEffect, useRef, useState } from 'react';

/**
 * 渡した関数の「最新の中身」を呼びながら、返す関数自体の参照はレンダーを跨いでずっと
 * 同じに保つフック。行コンポーネント(TimelineRow 等)に渡すコールバックをこれで包むと、
 * 呼び出し側(親)が毎レンダーで新しい関数を作っていても、子に渡る props の参照は
 * 変わらないため、子の memo 比較で「変わっていない」と判定できる。
 *
 * - ref の更新を useLayoutEffect で行う理由: コミット後に同期させることで、直後に発火する
 *   可能性のあるイベント(クリック等)が古い fn を呼んでしまう窓を作らない
 *   (useEffect だと描画とブラウザ間で非同期になり、その窓ができる)。
 * - 返す関数自体は useState の遅延初期化(初回レンダーだけ実行)で 1 度だけ作る
 *   (レンダー中に ref.current を直接読み書きする「遅延 ref 初期化」は eslint-plugin-react-hooks
 *   の react-hooks/refs に引っかかるため使わない。useState の遅延初期化なら、その中で
 *   fnRef.current を読むのではなく「後で読む関数」を作るだけなので引っかからない)。
 */
export function useStableCallback<T extends (...args: never[]) => unknown>(fn: T): T {
    const fnRef = useRef(fn);
    useLayoutEffect(() => {
        fnRef.current = fn;
    });

    const [stableFn] = useState<T>(
        () => ((...args: Parameters<T>) => fnRef.current(...args)) as T
    );
    return stableFn;
}
