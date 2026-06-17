export interface ConflictPoint {
    id: string;
    ownerId: string;
    y: number;            // スクロール領域内での絶対Y(px)
    columnCenterX: number; // その列の中央X(px)
}

export interface ArrowDescriptor {
    key: string;          // React key (`${ownerId}:${direction}`)
    ownerId: string;
    direction: 'up' | 'down';
    x: number;            // 矢印を置くX(列中央)
    targetY: number;      // クリック時にスクロールする先のY
}

/**
 * 競合点のうち、ビューポート外にあるものを「列×方向」ごとに1個へ集約し、
 * 端に最も近い競合を指す矢印記述子を返す。
 */
export function computeConflictArrows(
    points: ConflictPoint[],
    view: { scrollTop: number; viewportHeight: number },
): ArrowDescriptor[] {
    const top = view.scrollTop;
    const bottom = view.scrollTop + view.viewportHeight;
    // key: `${ownerId}:${direction}` → 採用する point
    const best = new Map<string, ConflictPoint>();
    for (const p of points) {
        let direction: 'up' | 'down' | null = null;
        if (p.y < top) direction = 'up';
        else if (p.y > bottom) direction = 'down';
        if (!direction) continue; // 可視
        const key = `${p.ownerId}:${direction}`;
        const cur = best.get(key);
        // 端に近い = up は y 最大 / down は y 最小
        if (!cur) best.set(key, p);
        else if (direction === 'up' && p.y > cur.y) best.set(key, p);
        else if (direction === 'down' && p.y < cur.y) best.set(key, p);
    }
    const out: ArrowDescriptor[] = [];
    for (const [key, p] of best) {
        const direction = key.endsWith(':up') ? 'up' : 'down';
        out.push({ key, ownerId: p.ownerId, direction, x: p.columnCenterX, targetY: p.y });
    }
    return out;
}
