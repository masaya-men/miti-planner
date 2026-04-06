// globals: true モード（vitest.config.ts）に従い、describe/it/expect/vi はグローバルで使用。
// calculator.ts は getLevelModifiersFromStore を静的インポートしているが、
// calculatePotencyValue は modifiers を直接引数で受け取るためストアは不要。
// インポートチェーン calculator → useSkillsData → useMasterDataStore → templateLoader
//   → useMasterData → firebase（ブラウザ依存）を vi.mock で断ち切る。
vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: {},
  storage: {},
  analytics: Promise.resolve(null),
  appCheck: null,
}));
vi.mock('../../lib/appCheck', () => ({
  initAppCheck: vi.fn(() => null),
}));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})), getApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  initializeFirestore: vi.fn(() => ({})),
  getFirestore: vi.fn(() => ({})),
  persistentLocalCache: vi.fn(() => ({})),
  persistentMultipleTabManager: vi.fn(() => ({})),
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  collection: vi.fn(),
  getDocs: vi.fn(),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({
  getAnalytics: vi.fn(() => ({})),
  isSupported: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('firebase/app-check', () => ({
  initializeAppCheck: vi.fn(() => ({})),
  ReCaptchaEnterpriseProvider: vi.fn(),
}));

vi.mock('../../hooks/useSkillsData', () => ({
  getLevelModifiersFromStore: vi.fn(() => ({})),
}));

import {
  calculatePotencyValue,
  calculateCriticalValue,
  calculateHpValue,
  getColumnWidth,
  CRIT_MULTIPLIER,
} from '../calculator';

const LV100_MODS = { level: 100, main: 440, sub: 420, div: 2780, hp: 5000 };

const healerStats = {
  mainStat: 4800, det: 2200, crt: 2800, ten: 420, ss: 650, wd: 141,
};

const tankStats = {
  mainStat: 4600, det: 2100, crt: 2700, ten: 900, ss: 500, wd: 141,
};

describe('calculatePotencyValue', () => {
  it('ヒーラーのポテンシー計算が正の整数を返す', () => {
    const result = calculatePotencyValue(healerStats, 300, 'healer', LV100_MODS);
    expect(result).toBeGreaterThan(0);
    expect(Number.isInteger(result)).toBe(true);
  });

  it('タンクのポテンシー計算にテナシティが反映される', () => {
    const withoutTen = calculatePotencyValue(
      { ...tankStats, ten: LV100_MODS.sub }, 300, 'tank', LV100_MODS,
    );
    const withTen = calculatePotencyValue(tankStats, 300, 'tank', LV100_MODS);
    expect(withTen).toBeGreaterThan(withoutTen);
  });

  it('非タンクはテナシティが無効', () => {
    const result1 = calculatePotencyValue(
      { ...healerStats, ten: 420 }, 300, 'healer', LV100_MODS,
    );
    const result2 = calculatePotencyValue(
      { ...healerStats, ten: 9999 }, 300, 'healer', LV100_MODS,
    );
    expect(result1).toBe(result2);
  });

  it('ポテンシーが高いほど値が大きい', () => {
    const low = calculatePotencyValue(healerStats, 100, 'healer', LV100_MODS);
    const high = calculatePotencyValue(healerStats, 500, 'healer', LV100_MODS);
    expect(high).toBeGreaterThan(low);
  });

  it('武器ダメージが高いほど値が大きい', () => {
    const low = calculatePotencyValue({ ...healerStats, wd: 100 }, 300, 'healer', LV100_MODS);
    const high = calculatePotencyValue({ ...healerStats, wd: 200 }, 300, 'healer', LV100_MODS);
    expect(high).toBeGreaterThan(low);
  });
});

describe('calculateCriticalValue', () => {
  it('クリティカル倍率が適用される', () => {
    const base = 10000;
    expect(calculateCriticalValue(base)).toBe(Math.floor(base * CRIT_MULTIPLIER));
  });

  it('0の場合は0', () => {
    expect(calculateCriticalValue(0)).toBe(0);
  });
});

describe('calculateHpValue', () => {
  it('HP割合計算が正しい', () => {
    expect(calculateHpValue(100000, 10)).toBe(10000);
    expect(calculateHpValue(100000, 25)).toBe(25000);
  });

  it('端数は切り捨て', () => {
    expect(calculateHpValue(100001, 10)).toBe(10000);
  });
});

describe('getColumnWidth', () => {
  it('タンク/ヒーラーは125px', () => {
    expect(getColumnWidth('tank')).toBe(125);
    expect(getColumnWidth('healer')).toBe(125);
  });

  it('DPSは50px', () => {
    expect(getColumnWidth('dps')).toBe(50);
  });
});
