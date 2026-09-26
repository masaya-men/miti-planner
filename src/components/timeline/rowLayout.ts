/**
 * 行の配置係 — タイムラインの縦方向の位置を 1 か所で決める。
 *
 * 各秒の行の「上端・高さ」と表全体の高さを、攻撃の数・「空の行を隠す」設定・1 段の高さ(PC/スマホ)から計算する。
 * 表・軽減アイコンのドラッグ・効果時間の帯・範囲選択・フェーズ/ラベルの帯・ジャンプ・競合の矢印・リキャスト行は、
 * 縦位置をすべてここから得る(独自に秒数 × px の割り算・掛け算をしない)。
 *
 * 行の高さ = 1 段 × max(1, その秒の攻撃数)。空の行を隠す設定で隠れた秒は高さ 0。
 * 設計書: docs/superpowers/specs/2026-09-26-multi-attack-rows-design.md
 */

/** 1 段の高さ(px)。PC = 攻撃 1 つ分(旧「2 つ並び」の 1 段)/ スマホ = カード 1 枚 */
export const ROW_UNIT_PX = { pc: 25, mobile: 60 } as const;

/** PC の軽減アイコンの大きさ(px)。見た目を調整するときはここだけ変える(横方向のレーン幅は別管理) */
export const MITI_ICON_PX = 24;

export interface RowLayoutInput {
    /** グリッドの秒(昇順・連続)。Timeline の gridLines */
    times: readonly number[];
    eventCountAt: (time: number) => number;
    /** autoHidden を除く軽減の開始がある秒か */
    hasMitigationStartAt: (time: number) => boolean;
    hideEmptyRows: boolean;
    /** 攻撃・軽減の最大時刻(空の行を隠すときの「最後の空行」= この +1 の判定用。無ければ -11) */
    maxPopulatedTime: number;
    /** 空でも必ず表示する秒(チュートリアル用) */
    forceVisibleTimes?: ReadonlySet<number>;
    unitPx: number;
}

export interface RowBox {
    time: number;
    /** 行の上端。隠れた秒は次の可視行の上端 */
    top: number;
    /** 行の高さ。隠れた秒は 0 */
    height: number;
    visible: boolean;
}

export interface RowLayout {
    unitPx: number;
    rows: readonly RowBox[];
    totalHeight: number;
    /** 秒 → 行の上端(旧 timeToYMap と同じ意味。メモ・リモートカーソルの座標変換もこれを使う) */
    timeToY: Map<number, number>;
    /** [秒, 上端] を上端の昇順(同じ上端は秒の昇順)に並べたもの */
    sortedTimeY: [number, number][];
    /** その秒の行の上端。グリッドより前は 0、後ろは最後の行の下端から 1 段ずつ */
    topOf(time: number): number;
    /** その秒の行の下端(隠れた秒は直前の可視行の下端) */
    bottomOf(time: number): number;
    /** y を含む可視行の秒(上端を含み下端を含まない)。範囲外は最初 / 最後の可視行 */
    timeAtY(y: number): number;
}

export function computeRowLayout(input: RowLayoutInput): RowLayout {
    const { times, eventCountAt, hasMitigationStartAt, hideEmptyRows, maxPopulatedTime, forceVisibleTimes, unitPx } = input;
    const rows: RowBox[] = [];
    const timeToY = new Map<number, number>();
    const heightByTime = new Map<number, number>();
    let y = 0;
    for (const time of times) {
        const count = eventCountAt(time);
        const visible = !hideEmptyRows
            || count > 0
            || hasMitigationStartAt(time)
            || time === maxPopulatedTime + 1
            || (forceVisibleTimes?.has(time) ?? false);
        const height = visible ? unitPx * Math.max(1, count) : 0;
        rows.push({ time, top: y, height, visible });
        timeToY.set(time, y);
        heightByTime.set(time, height);
        y += height;
    }
    const totalHeight = y;
    const sortedTimeY = Array.from(timeToY.entries()).sort((a, b) => a[1] - b[1]);
    const visibleRows = rows.filter((r) => r.visible);
    const firstTime = times.length > 0 ? times[0] : 0;
    const lastTime = times.length > 0 ? times[times.length - 1] : 0;

    const topOf = (time: number): number => {
        const exact = timeToY.get(time);
        if (exact !== undefined) return exact;
        if (times.length === 0 || time < firstTime) return 0;
        if (time > lastTime) return totalHeight + (time - lastTime - 1) * unitPx;
        // グリッド内の小数秒: その秒の行の中を比例で進める
        const base = Math.floor(time);
        return (timeToY.get(base) ?? 0) + (time - base) * (heightByTime.get(base) ?? 0);
    };

    const bottomOf = (time: number): number => {
        const h = heightByTime.get(time);
        if (h !== undefined) return (timeToY.get(time) ?? 0) + h;
        if (times.length === 0 || time < firstTime) return 0;
        if (time > lastTime) return topOf(time) + unitPx;
        const base = Math.floor(time);
        return (timeToY.get(base) ?? 0) + (heightByTime.get(base) ?? 0);
    };

    const timeAtY = (yPx: number): number => {
        if (visibleRows.length === 0) return times.length > 0 ? times[0] : 0;
        if (yPx < visibleRows[0].top) return visibleRows[0].time;
        // 上端が yPx 以下の最後の可視行(可視行は隙間なく並ぶので、それが yPx を含む行)
        let lo = 0;
        let hi = visibleRows.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (visibleRows[mid].top <= yPx) lo = mid; else hi = mid - 1;
        }
        return visibleRows[lo].time;
    };

    return { unitPx, rows, totalHeight, timeToY, sortedTimeY, topOf, bottomOf, timeAtY };
}

/** ref の初期値など、まだ計算していないとき用の空のレイアウト */
export const EMPTY_ROW_LAYOUT: RowLayout = computeRowLayout({
    times: [],
    eventCountAt: () => 0,
    hasMitigationStartAt: () => false,
    hideEmptyRows: false,
    maxPopulatedTime: -11,
    unitPx: ROW_UNIT_PX.pc,
});

/** 行の上端から軽減アイコンの上端まで(アイコンは最上段 = 1 つ目の攻撃の段の縦中央)。PC: (25 − 24) / 2 = 0.5 */
export const mitiIconOffset = (unitPx: number): number => (unitPx - MITI_ICON_PX) / 2;

/** 効果時間の帯の始点 = 最上段の中央(= アイコンの中央) */
export const barStartY = (layout: RowLayout, time: number): number => layout.topOf(time) + layout.unitPx / 2;

/** 帯の終点 = その秒の行の下端の 1px 上(効果がかかる最後の秒 / バリア使い切り / 上書き負けで使う) */
export const barEndY = (layout: RowLayout, time: number): number => layout.bottomOf(time) - 1;

/** 親の帯を子アイコン(ホロスコープの発動・アーサリースターの変化・WD)の位置で止める点 = 子アイコンの上端 + 4px */
export const childIconCutY = (layout: RowLayout, childTime: number): number =>
    layout.topOf(childTime) + mitiIconOffset(layout.unitPx) + 4;
