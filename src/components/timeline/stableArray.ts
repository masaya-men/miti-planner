// 配列の中身(各要素が Object.is で同じ)が前回と同じなら、前回と同じ参照を返す。
// 行(TimelineRow)へ渡す「挑発マーカー一覧」の参照を、挑発の増減がない限り変えないために使う
// (軽減を置く・消すたびに filter で新配列ができ、全行の memo 比較が外れるのを防ぐ)。
export function reuseEqualArray<T>(prev: readonly T[] | undefined, next: readonly T[]): readonly T[] {
    if (!prev || prev.length !== next.length) return next;
    for (let i = 0; i < next.length; i++) {
        if (!Object.is(prev[i], next[i])) return next;
    }
    return prev;
}
