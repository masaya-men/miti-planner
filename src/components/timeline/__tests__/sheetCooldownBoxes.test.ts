import { describe, it, expect, beforeEach } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation, AppliedMitigation } from '../../../types';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { computeRowLayout, ROW_UNIT_PX } from '../rowLayout';
import { buildSheetColumns, SHEET_COL_W } from '../sheet/sheetColumns';
import { sheetCooldownBoxes } from '../sheet/sheetCooldown';
import { resolveSheetTap } from '../sheet/sheetTap';

const defs = MITIGATIONS as Mitigation[];
const t = (_k: string, o?: object) => (typeof o === 'string' ? o : (o as { defaultValue?: string } | undefined)?.defaultValue ?? _k);
const def = (id: string): Mitigation => {
  const m = defs.find(x => x.id === id);
  if (!m) throw new Error(`no def ${id}`);
  return m;
};
const placed = (id: string, time: number, ownerId = 'H1'): AppliedMitigation => ({
  id: `p_${id}_${time}`, mitigationId: id, time, duration: def(id).duration, ownerId,
});
const layout = computeRowLayout({
  times: Array.from({ length: 301 }, (_, i) => i),
  eventCountAt: () => 1,
  hasMitigationStartAt: () => false,
  hideEmptyRows: false,
  maxPopulatedTime: 300,
  unitPx: ROW_UNIT_PX.pc,
});
const visible = () => true;
const colOf = (cols: ReturnType<typeof buildSheetColumns>, id: string) => cols.findIndex(c => c.mitigationId === id);
const leftOf = (ci: number) => ci * SHEET_COL_W + SHEET_COL_W / 2 - 1;
/** 線の箱 → 秒の区間(行 25px・1 段なので top/height から逆算) */
const secs = (b: { top: number; height: number }) => [Math.round((b.top - 12.5) / 25), Math.round((b.top + b.height - 12.5) / 25)];

beforeEach(() => useMitigationStore.setState({ currentLevel: 100 }));

describe('sheetCooldownBoxes', () => {
  it('非チャージ: 自分の列だけに帯の終点〜recast の線(リプライザル 15s / 60s)', () => {
    const cols = buildSheetColumns('pld', defs, 100);
    const ci = colOf(cols, 'reprisal_pld');
    const items = [placed('reprisal_pld', 10, 'MT')];
    const boxes = sheetCooldownBoxes(items, items, cols, defs, 0, layout, 300, visible);
    expect(boxes.length).toBe(1);
    expect(boxes[0].left).toBe(leftOf(ci));
    expect(secs(boxes[0])).toEqual([24, 70]);
  });

  it('共有リキャスト(原初の血気 群): 相手の列にも置いた秒から線。線の途中は相手の列も押せない', () => {
    const cols = buildSheetColumns('war', defs, 100);
    const bw = colOf(cols, 'bloodwhetting');
    const nf = colOf(cols, 'nascent_flash');
    expect(bw).toBeGreaterThanOrEqual(0);
    expect(nf).toBeGreaterThanOrEqual(0);
    const items = [placed('bloodwhetting', 0, 'MT')];
    const boxes = sheetCooldownBoxes(items, items, cols, defs, 0, layout, 300, visible);
    const partner = boxes.find(b => b.left === leftOf(nf))!;
    expect(partner).toBeTruthy();
    expect(secs(partner)).toEqual([0, def('nascent_flash').recast]);
    // 線の途中 = 押せない / 線の後 = 押せる(線と判定が一致)
    const mid = Math.floor(def('nascent_flash').recast / 2);
    expect(resolveSheetTap(cols[nf].def, mid, items, items, t).kind).toBe('blocked');
    expect(resolveSheetTap(cols[nf].def, def('nascent_flash').recast, items, items, t).kind).not.toBe('blocked');
  });

  it('チャージ技(ディヴァインベニゾン): 1 回目は線なし、2 回目から次の回復まで', () => {
    const cols = buildSheetColumns('whm', defs, 100);
    const ci = colOf(cols, 'divine_benison');
    const one = [placed('divine_benison', 0)];
    expect(sheetCooldownBoxes(one, one, cols, defs, 0, layout, 300, visible)).toEqual([]);
    expect(resolveSheetTap(cols[ci].def, 5, one, one, t).kind).not.toBe('blocked');
    const two = [placed('divine_benison', 0), placed('divine_benison', 5)];
    const boxes = sheetCooldownBoxes(two, two, cols, defs, 0, layout, 300, visible);
    expect(boxes.length).toBe(1);
    expect(secs(boxes[0])).toEqual([5, 30]);
    expect(resolveSheetTap(cols[ci].def, 20, two, two, t).kind).toBe('blocked');
  });

  it('列がチャージ技で、置いたのが旧版(別 id・非チャージ)なら線なし(判定も同じ id しか数えない)', () => {
    // ガンブレイカーのオーロラ: Lv84 以上は aurora_v2(2 チャージ)の列。旧 aurora は同じアイコンなので同じ列に描かれる
    const cols = buildSheetColumns('gnb', defs, 100);
    const ci = colOf(cols, 'aurora_v2');
    expect(ci).toBeGreaterThanOrEqual(0);
    const items = [placed('aurora', 0, 'ST')];
    expect(sheetCooldownBoxes(items, items, cols, defs, 0, layout, 300, visible)).toEqual([]);
    expect(resolveSheetTap(cols[ci].def, 10, items, items, t).kind).not.toBe('blocked');
  });

  it('maxTime で切り詰め、終点より後ろに可視行が無ければ描かない', () => {
    const cols = buildSheetColumns('pld', defs, 100);
    const items = [placed('reprisal_pld', 10, 'MT')];
    const clipped = sheetCooldownBoxes(items, items, cols, defs, 0, layout, 40, visible);
    expect(secs(clipped[0])).toEqual([24, 40]);
    expect(sheetCooldownBoxes(items, items, cols, defs, 0, layout, 24, visible)).toEqual([]);
  });
});
