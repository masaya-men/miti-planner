import { describe, it, expect } from 'vitest';
import { resolveBarrierConflict } from '../barrierStacking';

const mk = (o: Partial<Parameters<typeof resolveBarrierConflict>[0]>) =>
  ({ group: undefined, remaining: 0, castTime: 0, id: 'x', ...o });

describe('resolveBarrierConflict', () => {
  it('片方でも group 未設定なら both（自由スタック）', () => {
    expect(resolveBarrierConflict(mk({ group: 'galvanize', remaining: 100 }), mk({ group: undefined }))).toBe('both');
    expect(resolveBarrierConflict(mk({ group: undefined }), mk({ group: undefined }))).toBe('both');
  });

  it('鼓舞系どうし: 残量が大きい方が残る', () => {
    const big = mk({ group: 'galvanize', remaining: 100, castTime: 0, id: 'a' });
    const small = mk({ group: 'galvanize', remaining: 40, castTime: 10, id: 'b' });
    expect(resolveBarrierConflict(big, small)).toBe('a');
    expect(resolveBarrierConflict(small, big)).toBe('b');
  });

  it('鼓舞系どうし同値: 後勝ち', () => {
    const older = mk({ group: 'galvanize', remaining: 50, castTime: 0, id: 'a' });
    const newer = mk({ group: 'galvanize', remaining: 50, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(older, newer)).toBe('b');
  });

  it('鼓舞系 ↔ エウクラシア・プログノシス: 後勝ち（残量無関係）', () => {
    const galBig = mk({ group: 'galvanize', remaining: 100, castTime: 0, id: 'a' });
    const progSmall = mk({ group: 'eukrasian_prognosis', remaining: 30, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(galBig, progSmall)).toBe('b'); // 後に置いた prog が勝つ
    expect(resolveBarrierConflict(progSmall, galBig)).toBe('a');
  });

  it('何か ↔ エウクラシア・ディアグノシス: ディアグノシスが必ず勝つ（後から鼓舞を置いても）', () => {
    const diagOld = mk({ group: 'eukrasian_diagnosis', remaining: 20, castTime: 0, id: 'a' });
    const galNew = mk({ group: 'galvanize', remaining: 100, castTime: 10, id: 'b' });
    expect(resolveBarrierConflict(diagOld, galNew)).toBe('a');
    expect(resolveBarrierConflict(galNew, diagOld)).toBe('b');
  });

  it('エウクラシア・プログノシス ↔ エウクラシア・ディアグノシス: ディアグノシス', () => {
    const prog = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 10, id: 'a' });
    const diag = mk({ group: 'eukrasian_diagnosis', remaining: 20, castTime: 0, id: 'b' });
    expect(resolveBarrierConflict(prog, diag)).toBe('b');
  });

  it('エウクラシア・プログノシスどうし: 後勝ち', () => {
    const a = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 0, id: 'a' });
    const b = mk({ group: 'eukrasian_prognosis', remaining: 50, castTime: 5, id: 'b' });
    expect(resolveBarrierConflict(a, b)).toBe('b');
  });
});
