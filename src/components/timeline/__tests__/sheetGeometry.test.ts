import { describe, it, expect, beforeEach } from 'vitest';
import { MITIGATIONS } from '../../../data/mockData';
import type { Mitigation, AppliedMitigation } from '../../../types';
import { useMitigationStore } from '../../../store/useMitigationStore';
import { computeRowLayout, ROW_UNIT_PX } from '../rowLayout';
import { resolveSheetTap } from '../sheet/sheetTap';
import { sheetIconLeft, cooldownSpans, cooldownLineBox } from '../sheet/sheetGeometry';

const t = (_k: string, o?: any) => (typeof o === 'string' ? o : o?.defaultValue ?? _k);
const def = (id: string): Mitigation => {
  const m = MITIGATIONS.find(x => x.id === id);
  if (!m) throw new Error(`no def ${id}`);
  return m;
};
const placed = (m: Mitigation, time: number, ownerId: string): AppliedMitigation => ({
  id: `p_${m.id}_${time}`, mitigationId: m.id, time, duration: m.duration, ownerId,
});

const reprisal = def('reprisal_pld'); // dur 15 / rc 60
const assize = def('assize'); // dur 1 / rc 40
const benison = def('divine_benison'); // max 2 / rc 30 / chargeMinLevel 88

beforeEach(() => useMitigationStore.setState({ currentLevel: 100 }));

describe('cooldownSpans', () => {
  it('前提: テストに使う技の値', () => {
    expect([reprisal.duration, reprisal.recast]).toEqual([15, 60]);
    expect([assize.duration, assize.recast]).toEqual([1, 40]);
    expect([benison.maxCharges, benison.recast]).toEqual([2, 30]);
  });

  it('非チャージ: 帯の終点から recast まで', () => {
    expect(cooldownSpans(reprisal, [10], 10)).toEqual([[24, 70]]);
  });

  it('効果 1 秒以下は置いた秒から', () => {
    expect(cooldownSpans(assize, [10], 10)).toEqual([[10, 50]]);
  });

  it('recast 0 以下は線なし', () => {
    expect(cooldownSpans({ ...assize, recast: 0 } as Mitigation, [10], 10)).toEqual([]);
  });

  it('2 チャージ技: 1 回目は線なし、2 回目(0 になる)は次の回復まで', () => {
    expect(cooldownSpans(benison, [0], 0)).toEqual([]);
    expect(cooldownSpans(benison, [0, 5], 5)).toEqual([[5, 30]]); // 0 で消費開始→30 で 1 つ戻る
  });

  it('2 チャージ技: 回復は最初の消費から数える・回復後に再び 0 になれば次の回復まで', () => {
    expect(cooldownSpans(benison, [0, 1], 1)).toEqual([[1, 30]]);
    // 回復後にまた 0 になるケース: 0,5 で 0 → 30 で 1 → 40 で 0 → 60 で回復
    expect(cooldownSpans(benison, [0, 5, 40], 40)).toEqual([[40, 60]]);
  });

  it('後ろの使用は placedTime の線に影響しない', () => {
    expect(cooldownSpans(benison, [0, 5, 31], 5)).toEqual([[5, 30]]);
  });

  it('Lv88 未満は実効 1 チャージ: 1 回目で 0 → recast まで', () => {
    useMitigationStore.setState({ currentLevel: 80 });
    expect(cooldownSpans(benison, [10], 10)).toEqual([[10, 40]]);
  });

  it('requires 窓方式は線なし', () => {
    const m = { ...benison, id: 'zz_win', requires: 'something' } as Mitigation;
    expect(cooldownSpans(m, [0, 5], 5)).toEqual([]);
  });

  it('resolveSheetTap と矛盾しない: 線のある秒は blocked、無い秒は place', () => {
    const own = [placed(benison, 0, 'H1'), placed(benison, 5, 'H1')];
    const [[s, e]] = cooldownSpans(benison, [0, 5], 5);
    // 線の内側(置いた秒そのものは remove なので除く)
    expect(20 > s && 20 < e).toBe(true);
    expect(resolveSheetTap(benison, 20, own, [], t).kind).toBe('blocked');
    // 線の外側: 対象技なので selectTarget(= blocked ではない)
    expect(31 > e).toBe(true);
    expect(resolveSheetTap(benison, 31, own, [], t).kind).toBe(benison.scope === 'target' ? 'selectTarget' : 'place');
    // 1 回目だけ(線なし)のときも blocked にならない
    expect(cooldownSpans(benison, [0], 0)).toEqual([]);
    expect(resolveSheetTap(benison, 3, [placed(benison, 0, 'H1')], [], t).kind).not.toBe('blocked');
  });

  it('非チャージの線の内側は blocked、終点以降は置ける', () => {
    const own = [placed(reprisal, 10, 'MT')];
    const [[s, e]] = cooldownSpans(reprisal, [10], 10);
    expect(resolveSheetTap(reprisal, s + 1, own, [], t).kind).toBe('blocked');
    expect(resolveSheetTap(reprisal, e - 1, own, [], t).kind).toBe('blocked');
    expect(resolveSheetTap(reprisal, e, own, [], t).kind).toBe('place');
  });
});

describe('cooldownLineBox', () => {
  const times = Array.from({ length: 31 }, (_, i) => i); // 0..30
  const plain = computeRowLayout({
    times, eventCountAt: () => 0, hasMitigationStartAt: () => false,
    hideEmptyRows: false, maxPopulatedTime: 100, unitPx: ROW_UNIT_PX.pc,
  });
  const visibleSet = new Set([5, 25]);
  const hidden = computeRowLayout({
    times, eventCountAt: (x) => (visibleSet.has(x) ? 1 : 0), hasMitigationStartAt: () => false,
    hideEmptyRows: true, maxPopulatedTime: 100, unitPx: ROW_UNIT_PX.pc,
  });

  it('始点は barStartY(開始の行の中央)、終点は「置けない最後の行(rawEnd - 1)の下端」= 置ける最初の行 rawEnd の上端', () => {
    // [10,20]: 始点 10*25+12.5=262.5、終点 = 20 の行の上端 500 → 高さ 237.5
    expect(cooldownLineBox(plain, [10, 20], 30, () => true)).toEqual({ top: 262.5, height: 237.5, ended: true });
    expect(plain.topOf(20)).toBe(262.5 + 237.5);
  });

  it('maxTime で切る(maxTime の行の下端・終わりの印は出さない)', () => {
    // 終点 70 → 30 の行の下端 31*25=775
    expect(cooldownLineBox(plain, [10, 70], 30, () => true)).toEqual({ top: 262.5, height: 775 - 262.5, ended: false });
  });

  it('隠れた終点は手前の可視秒の行の下端へ', () => {
    // 5 と 25 だけ可視: 終点 28 → rawEnd-1=27 → 25。始点 5 の中央 12.5 → 25 の行の下端 50
    expect(hidden.rows.filter(r => r.visible).map(r => r.time)).toEqual([5, 25]);
    expect(cooldownLineBox(hidden, [5, 28], 30, (x) => visibleSet.has(x))).toEqual({ top: 12.5, height: 37.5, ended: true });
  });

  it('始点が隠れ行なら手前の可視秒の行の中央から(帯の終点との隙間を作らない)', () => {
    // 6 は隠れ → 5 の中央 12.5 から、終点も 5 の行の下端 25
    expect(cooldownLineBox(hidden, [6, 20], 30, (x) => visibleSet.has(x))).toEqual({ top: 12.5, height: 12.5, ended: true });
  });

  it('終点の行が無い(rawEnd - 1 < 始点)は null', () => {
    expect(cooldownLineBox(plain, [10, 10], 30, () => true)).toBeNull();
  });

  it('1 行だけ(rawEnd = 始点 + 1)は始点の行の下半分', () => {
    expect(cooldownLineBox(plain, [10, 11], 30, () => true)).toEqual({ top: 262.5, height: 12.5, ended: true });
  });
});

describe('sheetIconLeft', () => {
  it('28 列で 18px は左右 5px', () => {
    expect(sheetIconLeft(100, 2)).toBe(100 + 56 + 5);
  });
});
