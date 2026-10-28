import type { PartyMember } from '../../../types';
import { pxToXRatio } from '../../Memo/coords';

/** 1 メンバーの列の横位置(シート左端基準 px)。 */
export interface MemberBand { id: string; left: number; width: number }

/** レーン表示の列 CSS 変数の実値(src/styles/base/tokens-columns.css の --col-th-w / --col-dps-w / --col-member-pad-x)。読めなければ既定値。 */
export function readLanesColumnVars(): { thW: number; dpsW: number; padX: number } {
    const read = (name: string, fallback: number): number => {
        if (typeof document === 'undefined') return fallback;
        const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
        return Number.isFinite(v) && v > 0 ? v : fallback;
    };
    return { thW: read('--col-th-w', 151), dpsW: read('--col-dps-w', 53), padX: read('--col-member-pad-x', 2.9) };
}

/** レーン表示の列。幅は getColumnCssVar と同じ(T/H = thW + padX*2、DPS = dpsW + padX*2)。 */
export function lanesBands(
    members: readonly PartyMember[],
    memberStart: number,
    thW: number,
    dpsW: number,
    padX: number,
): MemberBand[] {
    let left = memberStart;
    return members.map((m) => {
        const inner = m.role === 'tank' || m.role === 'healer' ? thW : dpsW;
        const width = inner + padX * 2;
        const band = { id: m.id, left, width };
        left += width;
        return band;
    });
}

/** スプシ表示の列(計測済み memberLayout から)。計測が無いメンバーは含めない。 */
export function sheetBands(
    members: readonly PartyMember[],
    memberLayout: ReadonlyMap<string, { left: number; width: number }>,
): MemberBand[] {
    const out: MemberBand[] = [];
    for (const m of members) {
        const l = memberLayout.get(m.id);
        if (l) out.push({ id: m.id, left: l.left, width: l.width });
    }
    return out;
}

/** x を含む from の帯 → 同じ id の to の帯の同じ割合へ。帯の外・相手に同じ id が無いときは x のまま。 */
export function convertMemberX(x: number, from: readonly MemberBand[], to: readonly MemberBand[]): number {
    for (const f of from) {
        if (x < f.left || x >= f.left + f.width) continue;
        const t = to.find((b) => b.id === f.id);
        if (!t) return x;
        const ratio = f.width > 0 ? (x - f.left) / f.width : 0;
        return t.left + ratio * t.width;
    }
    return x;
}

/**
 * レーン表示で xRatio の分母に使われている幅 = シート容器(sheetContainerRef)の実幅。
 * 容器は md:w-max md:min-w-full だが中身(行・列)は絶対配置なので広がらず、実測では常にスクロール入れ物の clientWidth と同じ
 * (8 人・1489 幅: 容器 1188 / 列の合計 1432 / scrollWidth 1432。列が表示域より広くても容器は 1188 のまま)。
 * なので列の合計幅は使わず、表示域幅(viewportWidth)を返す。未計測(0)のときだけ fallback(= 計測済みの sheetWidth)。
 */
export function lanesSheetWidth(viewportWidth: number, fallback: number): number {
    return viewportWidth > 0 ? viewportWidth : fallback;
}

/** メモ作成時の xRatio(未 clamp)。レーン表示は従来どおり rect.width 基準、スプシ表示だけ列変換を使う。 */
export function memoCreateXRatio(
    xPx: number,
    rectWidth: number,
    isSheetView: boolean,
    sheetToRatio: (px: number) => number,
): number {
    return isSheetView ? sheetToRatio(xPx) : pxToXRatio(xPx, rectWidth);
}
