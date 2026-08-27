import { describe, it, expect } from 'vitest';
import { stepShieldAbsorption } from '../Timeline';

describe('stepShieldAbsorption (バリア1インスタンスの被弾遷移)', () => {
  describe('スタック非対応バリア(ディヴァインヴェール等)', () => {
    const base = { stacksRemaining: undefined, maxVal: 1000, reapplyOnAbsorption: undefined };

    it('吸収量に届かない被弾: 残バリアが減るだけ、尽きていない', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 300 });
      expect(r.absorbed).toBe(300);
      expect(r.finalShield).toBe(700);
      expect(r.exhausted).toBe(false);
    });

    it('残量ちょうどの被弾: 尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 700, incomingDamage: 700 });
      expect(r.absorbed).toBe(700);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);
    });

    it('残量を超える被弾: 残量分だけ吸収して尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 500, incomingDamage: 9999 });
      expect(r.absorbed).toBe(500);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);
    });
  });

  describe('スタック制バリア(ハイマ/パンハイマ, reapplyOnAbsorption)', () => {
    const base = { maxVal: 1000, reapplyOnAbsorption: true };

    it('スタックが残っている状態で壊れても: 貼り直されて尽きていない(棒を切らない)', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 400, incomingDamage: 9999, stacksRemaining: 3 });
      expect(r.absorbed).toBe(400);
      expect(r.finalStacks).toBe(2);       // 1スタック消費
      expect(r.finalShield).toBe(1000);    // maxVal に貼り直し
      expect(r.exhausted).toBe(false);     // ← まだ効いている
    });

    it('最後の1スタックを消費した直後: まだ新品バリアがあるので尽きていない', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 100, incomingDamage: 9999, stacksRemaining: 1 });
      expect(r.finalStacks).toBe(0);
      expect(r.finalShield).toBe(1000);
      expect(r.exhausted).toBe(false);
    });

    it('スタック0で貼り直された新品バリアを壊しきったとき: ついに尽きる', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 9999, stacksRemaining: 0 });
      expect(r.finalStacks).toBe(0);
      expect(r.finalShield).toBe(0);
      expect(r.exhausted).toBe(true);      // ← ここで初めて棒を切ってよい
    });

    it('1スタック消費は1被弾につき1回だけ(大ダメージでも複数スタックを飛ばさない)', () => {
      const r = stepShieldAbsorption({ ...base, shieldRemaining: 1000, incomingDamage: 999999, stacksRemaining: 5 });
      expect(r.finalStacks).toBe(4);
      expect(r.finalShield).toBe(1000);
      expect(r.exhausted).toBe(false);
    });
  });
});
