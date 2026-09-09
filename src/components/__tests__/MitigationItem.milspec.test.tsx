// @vitest-environment happy-dom
/**
 * MIL-SPEC SP2 Task 6 — `MitigationItem` の inert フック（`data-mit-bar` / `data-mit-icon`）が
 * 実レンダーで DOM に出ることを保証する統合テスト。
 *
 * `MitigationItem` は `Timeline.tsx` 内の非 export コンポーネントなので、
 * 実際に `<Timeline>` を描画し、軽減を 1 個（duration > 1）持たせた状態で
 * `[data-mit-bar]` / `[data-mit-icon]` を querySelector する。
 * （モックした偽 DOM ではなく、本物の `MitigationItem` の出力を検証する。）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
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

import React from 'react';
import Timeline from '../Timeline';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';

const MITIGATION = { id: 't6-m1', mitigationId: 'vengeance', ownerId: 'MT', time: 30, duration: 15 };

beforeEach(() => {
  // デスクトップ経路（isMobileTimeline = window.innerWidth < 768）を確実に取る
  (window as unknown as { innerWidth: number }).innerWidth = 1440;

  useMitigationStore.setState({
    timelineEvents: [
      { id: 't6-ev0', time: 20, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
      { id: 't6-ev1', time: 60, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
    ] as never,
    phases: [],
    labels: [],
    timelineMitigations: [],
    currentLevel: 100,
    _history: [],
    _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  usePlanStore.setState({ currentPlanId: 't6-debug-plan' });
  useMitigationStore.getState().addMitigation(MITIGATION as never);
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
});

describe('MitigationItem inert フック（MIL-SPEC SP2 Task 6）', () => {
  it('効果棒に data-mit-bar・アイコンラッパーに data-mit-icon が付く', () => {
    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    const icon = container.querySelector('[data-mit-icon]');
    const bar = container.querySelector('[data-mit-bar]');

    expect(icon).not.toBeNull();
    // duration > 1 なので効果棒も描画される
    expect(bar).not.toBeNull();
    // 役割色マップ（military.css）が属性セレクタで拾う colors.bg クラスが棒に残っていること
    expect(bar?.className).toMatch(/bg-\w+-\d+\/80/);
    // pointer-events / cursor は死んでいない（バークリック転送の前提）
    expect(bar?.className).toContain('pointer-events-auto');
    expect(bar?.className).toContain('cursor-pointer');
    // 属性は値なし（inert）
    expect(bar?.getAttribute('data-mit-bar')).toBe('');
    expect(icon?.getAttribute('data-mit-icon')).toBe('');
  });
});
