// 行ごとの被ダメージ情報(damageMap の値)の参照を、中身が同じなら前回と同じにする。
// damageMap は軽減を 1 件置くたびに全イベントぶん作り直され、値のオブジェクトが毎回新しくなる。
// すると TimelineRow の memo 比較(damages 配列の各要素を Object.is)が全行で外れ、全行が再描画される(置く・消すが重い原因)。
// 中身が同じ値は前回の参照を返し、変わった行だけが再描画されるようにする。

interface DamageLike {
    unmitigated?: number;
    mitigated: number;
    mitigationPercent: number;
    shieldTotal: number;
    isInvincible?: boolean;
    mitigationStates?: Record<string, { stacks?: number }>;
}

function sameStates(a: DamageLike['mitigationStates'], b: DamageLike['mitigationStates']): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    const ka = Object.keys(a);
    if (ka.length !== Object.keys(b).length) return false;
    return ka.every(k => k in b && a[k]?.stacks === b[k]?.stacks);
}

export function sameDamage(a: DamageLike, b: DamageLike): boolean {
    return a.unmitigated === b.unmitigated
        && a.mitigated === b.mitigated
        && a.mitigationPercent === b.mitigationPercent
        && a.shieldTotal === b.shieldTotal
        && a.isInvincible === b.isInvincible
        && sameStates(a.mitigationStates, b.mitigationStates);
}

/** next の各値を、prev に同じ中身の値があれば prev のもの(同じ参照)に差し替えた Map を返す。 */
export function reuseEqualDamages<T extends DamageLike>(prev: ReadonlyMap<string, T> | undefined, next: ReadonlyMap<string, T>): Map<string, T> {
    const out = new Map<string, T>();
    next.forEach((v, k) => {
        const p = prev?.get(k);
        out.set(k, p && sameDamage(p, v) ? p : v);
    });
    return out;
}
