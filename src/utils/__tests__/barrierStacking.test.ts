import { describe, it, expect } from 'vitest';
import {
  resolveBarrierConflict,
  resolveContextShields,
  type ContextShieldEntry,
  type ContextShieldState,
} from '../barrierStacking';

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

const freshState = (): ContextShieldState => ({
  remaining: new Map(), stacks: new Map(), overwritten: new Set(),
});
const entry = (o: Partial<ContextShieldEntry> & { appMitId: string }): ContextShieldEntry => ({
  group: undefined, priority: Number.MAX_SAFE_INTEGER, castTime: 0, maxVal: 0,
  ...o,
});

describe('resolveContextShields', () => {
  it('二重削りしない: 60,000 被弾 vs 別グループ 40,000 バリア2枚 → 2枚目に 20,000 残る', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'a', maxVal: 40000, priority: 13 }), // 先に消費
      entry({ appMitId: 'b', maxVal: 40000, priority: 20 }),
    ];
    const r = resolveContextShields(entries, 60000, st);
    expect(r.totalAbsorbed).toBe(60000);
    expect(st.remaining.get('a')).toBe(0);
    expect(st.remaining.get('b')).toBe(20000);
    expect(r.newlyExhausted).toEqual(['a']);
  });

  it('鼓舞系どうしは大きい方だけ残り、小さい方は上書き負け（吸収に参加しない）', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'big', group: 'galvanize', priority: 25, maxVal: 100000, castTime: 0 }),
      entry({ appMitId: 'small', group: 'galvanize', priority: 25, maxVal: 40000, castTime: 10 }),
    ];
    const r = resolveContextShields(entries, 30000, st);
    expect(r.newlyOverwritten).toEqual(['small']);
    expect(st.overwritten.has('small')).toBe(true);
    expect(st.remaining.get('big')).toBe(70000); // big だけが 30,000 吸収
    expect(st.remaining.has('small')).toBe(false); // small は触られない
    expect(r.totalAbsorbed).toBe(30000);
  });

  it('優先順位順に消費: 星天交差(30k,p13)+ディヴァインヴェール(30k,p20)+鼓舞(100k,p25) に 150k → 鼓舞に 10k 残る', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'gal', group: 'galvanize', priority: 25, maxVal: 100000 }),
      entry({ appMitId: 'inter', priority: 13, maxVal: 30000 }),
      entry({ appMitId: 'veil', priority: 20, maxVal: 30000 }),
    ];
    const r = resolveContextShields(entries, 150000, st);
    expect(st.remaining.get('inter')).toBe(0);
    expect(st.remaining.get('veil')).toBe(0);
    expect(st.remaining.get('gal')).toBe(10000);
    expect(r.newlyExhausted).toEqual(['inter', 'veil']); // 優先順位 昇順に消費 → 尽きた順
  });

  it('非推移的な連鎖でも全滅しない: 大鼓舞→プログノシス→小鼓舞 で 小鼓舞だけ残る', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'bigGal', group: 'galvanize', priority: 25, maxVal: 100000, castTime: 0 }),
      entry({ appMitId: 'prog', group: 'eukrasian_prognosis', priority: 15, maxVal: 30000, castTime: 2 }),
      entry({ appMitId: 'smallGal', group: 'galvanize', priority: 25, maxVal: 40000, castTime: 4 }),
    ];
    const r = resolveContextShields(entries, 10000, st);
    expect(st.overwritten.has('bigGal')).toBe(true);
    expect(st.overwritten.has('prog')).toBe(true);
    expect(st.overwritten.has('smallGal')).toBe(false);
    expect(st.remaining.get('smallGal')).toBe(30000); // smallGal だけが 10,000 吸収
    expect(r.totalAbsorbed).toBe(10000);
    expect(r.newlyOverwritten).toEqual(['bigGal', 'prog']); // 詠唱時刻昇順
  });

  it('スタック制(ハイマ): 1スタック割れても newlyExhausted に入らない', () => {
    const st = freshState();
    const entries = [
      entry({ appMitId: 'haima', priority: 5, maxVal: 10000, maxStacks: 5, reapplyOnAbsorption: true }),
    ];
    const r = resolveContextShields(entries, 99999, st);
    expect(st.stacks.get('haima')).toBe(4);
    expect(st.remaining.get('haima')).toBe(10000); // 貼り直し
    expect(r.newlyExhausted).toEqual([]);
  });

  it('overwritten にあるバリアは最初から吸収に参加しない', () => {
    const st = freshState();
    st.overwritten.add('dead');
    const entries = [
      entry({ appMitId: 'dead', group: 'galvanize', priority: 25, maxVal: 999999 }),
      entry({ appMitId: 'live', priority: 20, maxVal: 30000 }),
    ];
    const r = resolveContextShields(entries, 50000, st);
    expect(r.totalAbsorbed).toBe(30000); // live だけ
    expect(st.remaining.has('dead')).toBe(false);
  });
});
