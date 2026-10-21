// @vitest-environment happy-dom
/**
 * リキャスト表示の置き場所 DOM 契約テスト(軍事でも標準と同じ見出しのメンバー列に置く)。
 *
 * 契約:
 *   - 軍事(PC)でも標準でも `.recast-cell` は `#timeline-header-inner` の中に並ぶ。
 *     独立した帯 `[data-milspec-recast-band]` は存在しない。
 *   - 軍事(PC)のときだけ各セルに待機表示 `.recast-idle`(線 + ジョブ略号)が入る。標準・モバイルでは入らない。
 *
 * ハーネスは Task 6 の `MitigationItem.milspec.test.tsx` と同じ作法
 * （Firebase 実初期化の遮断 + react-i18next スタブ + store 最小セットアップ）。
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
import { useThemeStore } from '../../store/useThemeStore';

const MITIGATION = { id: 't7-m1', mitigationId: 'vengeance', ownerId: 'MT', time: 30, duration: 15 };

beforeEach(() => {
  // デスクトップ経路（isMobileTimeline = window.innerWidth < 768）を確実に取る
  (window as unknown as { innerWidth: number }).innerWidth = 1489;

  useMitigationStore.setState({
    timelineEvents: [
      { id: 't7-ev0', time: 20, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
      { id: 't7-ev1', time: 60, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' }, damageType: 'magical', damageAmount: 90000, target: 'AoE' },
    ] as never,
    phases: [],
    labels: [],
    timelineMitigations: [],
    currentLevel: 100,
    _history: [],
    _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  usePlanStore.setState({ currentPlanId: 't7-debug-plan' });
  useMitigationStore.getState().addMitigation(MITIGATION as never);
});

afterEach(() => {
  cleanup();
  useThemeStore.setState({ themeStyle: 'standard' });
  // モバイル幅ケース (SP3 境界テスト) の後始末。beforeEach でも戻すが、
  // 同一ワーカーの後続ファイルへ 500px を漏らさないためここでも戻す。
  (window as unknown as { innerWidth: number }).innerWidth = 1489;
  vi.clearAllTimers();
});

describe('リキャスト表示の置き場所（軍事の表）', () => {
  it('themeStyle=military のとき、リキャストは見出し内に出て、帯は無く、待機表示が入る', () => {
    useThemeStore.setState({ themeStyle: 'military' });

    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-milspec-recast-band]')).toBeNull();
    const cells = container.querySelectorAll('#timeline-header-inner .recast-cell');
    expect(cells.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('#timeline-header-inner .recast-cell > .recast-idle').length).toBe(cells.length);
  });

  it('themeStyle=standard のとき、リキャストは従来どおりヘッダー内（標準モード不変）', () => {
    useThemeStore.setState({ themeStyle: 'standard' });

    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-milspec-recast-band]')).toBeNull();
    expect(container.querySelector('#timeline-header-inner .recast-cell')).not.toBeNull();
    expect(container.querySelector('.recast-idle')).toBeNull();
  });

  // SP2 の CSS は全て `.theme-military .milspec-app` スコープだが、`.milspec-app` は
  // PC 軍事レイアウト (Layout.tsx:579 の `!isMobile` ゲート) でしか mount しない。一方
  // `.theme-military` は **モバイルでも `<html>` に付く** (useThemeStore.ts:71-73)。
  // よって `isMilspecTable` のモバイル条件が将来外れると「CSS が 1 行も当たらない素の帯」が
  // モバイル軍事 (= SP3 の領域) に出る。このテストが JS 側の最後の砦 (レビュー I2)。
  it('モバイル幅では軍事でも待機表示を出さない (SP3 境界)', () => {
    (window as unknown as { innerWidth: number }).innerWidth = 500;
    useThemeStore.setState({ themeStyle: 'military' });

    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-milspec-recast-band]')).toBeNull();
    expect(container.querySelector('.recast-idle')).toBeNull();
  });
});
