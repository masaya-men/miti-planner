import { roundDamageCeil } from '../damageRounding';

describe('roundDamageCeil', () => {
  it('999以下はそのまま返す', () => {
    expect(roundDamageCeil(312)).toBe(312);
    expect(roundDamageCeil(999)).toBe(999);
    expect(roundDamageCeil(0)).toBe(0);
    expect(roundDamageCeil(1)).toBe(1);
  });

  it('負の値はそのまま返す', () => {
    expect(roundDamageCeil(-100)).toBe(-100);
  });

  it('4桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(8523)).toBe(8530);
    expect(roundDamageCeil(1000)).toBe(1000);
    expect(roundDamageCeil(1001)).toBe(1010);
  });

  it('5桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(42876)).toBe(42900);
    expect(roundDamageCeil(10000)).toBe(10000);
    expect(roundDamageCeil(10001)).toBe(10100);
  });

  it('6桁: 3有効桁で切り上げ', () => {
    expect(roundDamageCeil(156234)).toBe(157000);
    expect(roundDamageCeil(150000)).toBe(150000);
    expect(roundDamageCeil(100001)).toBe(101000);
  });

  it('ちょうど割り切れる値は変わらない', () => {
    expect(roundDamageCeil(5000)).toBe(5000);
    expect(roundDamageCeil(12300)).toBe(12300);
    expect(roundDamageCeil(456000)).toBe(456000);
  });
});
