/**
 * React.memo の第二引数(比較関数)用: props の全キー(和集合)を漏れなく比較する。
 *
 * 素朴な手書き比較関数(必要と思ったキーだけ書く方式)は、新しい prop を追加したときに
 * 比較し忘れる事故を生む(実例: TimelineRow / MobileTimelineRow の memo 比較が
 * showRowBorders 等の一部 props を見ておらず、描き直されない行が古い値を持ち続けていた)。
 * prev/next のキーを機械的に総なめにすることで、追加し忘れを構造的に防ぐ。
 *
 * - arrayKeys に列挙したキーは「配列の中身」(長さ + 各要素を Object.is)で比較する
 *   (配列自体の参照が毎回新しくても、中身が同じなら等しいとみなす)。
 * - それ以外のキーは Object.is で比較する(オブジェクト・関数は参照比較のまま)。
 */
export function rowPropsEqual(
    prev: object,
    next: object,
    arrayKeys: readonly string[],
): boolean {
    const prevRecord = prev as Record<string, unknown>;
    const nextRecord = next as Record<string, unknown>;
    const keys = new Set([...Object.keys(prevRecord), ...Object.keys(nextRecord)]);

    for (const key of keys) {
        const prevValue = prevRecord[key];
        const nextValue = nextRecord[key];

        if (arrayKeys.includes(key)) {
            if (prevValue === nextValue) continue;
            const prevArr = prevValue as unknown[] | undefined;
            const nextArr = nextValue as unknown[] | undefined;
            if (!prevArr || !nextArr) return false;
            if (prevArr.length !== nextArr.length) return false;
            for (let i = 0; i < prevArr.length; i++) {
                if (!Object.is(prevArr[i], nextArr[i])) return false;
            }
            continue;
        }

        if (!Object.is(prevValue, nextValue)) return false;
    }

    return true;
}
