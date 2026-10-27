// @vitest-environment happy-dom
// 軽減アイコン(MitigationItem)の描き直し回数を測る見張り。
// MitigationItem は描くたびに useSortSlide を 1 回呼ぶ(他では呼ばれない)ので、その呼び出し回数=描き直し回数として数える。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Firebase の実初期化を遮断（他の Timeline 系テストと同じ作法）
vi.mock('../../lib/firebase', () => ({
  db: {}, auth: { currentUser: null }, storage: {},
  analytics: Promise.resolve(null),
  ensureAppCheck: () => null,
  getActiveAppCheck: () => null,
}));
vi.mock('../../lib/appCheck', () => ({
  createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: () => () => {},
  signInWithCustomToken: vi.fn(),
  signOut: vi.fn(),
  deleteUser: vi.fn(),
  getAuth: vi.fn(),
}));
vi.mock('firebase/app-check', () => ({
  getToken: vi.fn(),
  initializeAppCheck: vi.fn(),
  ReCaptchaV3Provider: vi.fn(),
}));
vi.mock('firebase/firestore', () => {
  const passthrough = (...args: unknown[]) =>
    typeof args[args.length - 1] === 'function' ? () => {} : {};
  return new Proxy(
    {
      Timestamp: {
        now: () => ({ toDate: () => new Date(0), toMillis: () => 0, seconds: 0 }),
        fromDate: (d: Date) => ({ toDate: () => d, toMillis: () => d.getTime() }),
      },
      serverTimestamp: () => ({}),
    } as Record<string, unknown>,
    { get: (t, p: string) => (p in t ? t[p] : passthrough) },
  );
});

// i18n はプロバイダ無しでも動くスタブに（子コンポーネントの useTranslation / Trans も含む）
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k),
    i18n: { language: 'ja', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

// 描き直し回数の計測(アイコンごと: 左位置+段の top で見分ける)
const calls: Record<string, number> = {};
vi.mock('../military/table/useSortSlide', () => ({
  useSortSlide: (_ref: unknown, o: { left: number; delay: number }) => {
    const k = `${o.left}:${o.delay}`;
    calls[k] = (calls[k] ?? 0) + 1;
  },
}));

import React from 'react';
import Timeline from '../Timeline';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';

const mit = (id: string, mitigationId: string, ownerId: string, time: number, duration: number) =>
  ({ id, mitigationId, ownerId, time, duration });

beforeEach(() => {
  for (const k of Object.keys(calls)) delete calls[k];
  (window as unknown as { innerWidth: number }).innerWidth = 1440;
  useMitigationStore.setState({
    timelineEvents: [
      { id: 'rc-ev0', time: 20, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
      { id: 'rc-ev1', time: 60, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
    ] as never,
    phases: [],
    labels: [],
    timelineMitigations: [],
    currentLevel: 100,
    _history: [],
    _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  useMitigationStore.getState().setMemberJob('H1', 'whm');
  usePlanStore.setState({ currentPlanId: 'rc-plan' });
  useMitigationStore.getState().addMitigation(mit('rc-a', 'vengeance', 'MT', 30, 15) as never);
  useMitigationStore.getState().addMitigation(mit('rc-b', 'vengeance', 'MT', 100, 15) as never);
  useMitigationStore.getState().addMitigation(mit('rc-h', 'temperance', 'H1', 40, 20) as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

const total = () => Object.values(calls).reduce((a, b) => a + b, 0);

describe('MitigationItem: 描き直しの見張り', () => {
  it('軽減を 1 つ置いたときの MitigationItem の描き直し回数が、現状の実測から増えない', () => {
    render(<MemoryRouter><Timeline /></MemoryRouter>);
    const before = { ...calls };
    const n0 = total();
    act(() => { useMitigationStore.getState().addMitigation(mit('rc-c', 'rampart', 'MT', 180, 15) as never); });
    console.log(`[mitRenderCount] 置く before=${JSON.stringify(before)} after=${JSON.stringify(calls)}`);
    // 現状の実測: 既存の 3 個(MT 2 個・H1 1 個)が 1 回ずつ描き直され、新しい 1 個が 1 回描かれる = 4 回。
    // (理想は既存が 0 回だが、移動前後で挙動を変えない見張りなので実測値で固定する。減る方向の改善は値を下げて更新する)
    const changed = Object.keys(calls).filter(k => calls[k] !== (before[k] ?? 0));
    expect(changed.length).toBe(4);
    expect(total() - n0).toBe(4);
  });

  it('関係ない state(ホバー)が変わっても MitigationItem は再描画されない', () => {
    const { container } = render(<MemoryRouter><Timeline /></MemoryRouter>);
    const n0 = total();
    const target = container.querySelector('.timeline-scroll-container') ?? container;
    act(() => {
      target.dispatchEvent(new Event('pointermove', { bubbles: true }));
      target.dispatchEvent(new Event('pointerleave', { bubbles: true }));
    });
    console.log(`[mitRenderCount] ホバー: 初期${n0}回 / 増分 ${total() - n0}回`);
    expect(total() - n0).toBe(0);
  });
});
