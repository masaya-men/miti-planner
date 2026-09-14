// @vitest-environment happy-dom
/**
 * MIL-SPEC SP2 Task 7 — リキャスト行の独立（軍事モード限定の構造変更）DOM 契約テスト。
 *
 * 契約:
 *   - `themeStyle === 'military'` かつ PC（`window.innerWidth >= 768`）のとき
 *     リキャストは `#timeline-header-inner` の外、独立した `[data-milspec-recast-band]` に出る
 *     （中身 = `#timeline-recast-inner` > `.milspec-rc-label` + `.recast-cell` × メンバー数）。
 *   - `themeStyle === 'standard'`（既定）のときは従来どおり `#timeline-header-inner` 内に
 *     `.recast-cell` が並び、帯は一切描画されない（＝標準モード不変）。
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

describe('リキャスト帯（MIL-SPEC SP2 Task 7）', () => {
  it('themeStyle=military のとき、リキャストはヘッダー外の独立帯に出る', () => {
    useThemeStore.setState({ themeStyle: 'military' });

    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    const band = container.querySelector('[data-milspec-recast-band]');
    expect(band).not.toBeNull();
    expect(band!.querySelector('#timeline-recast-inner')).not.toBeNull();
    expect(band!.querySelector('.milspec-rc-label')).not.toBeNull();
    expect(band!.querySelectorAll('.recast-cell').length).toBeGreaterThan(0);
    // ヘッダー内には recast-cell が無い（＝帯へ物理移動している）
    expect(container.querySelector('#timeline-header-inner .recast-cell')).toBeNull();
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
  });

  // SP2 の CSS は全て `.theme-military .milspec-app` スコープだが、`.milspec-app` は
  // PC 軍事レイアウト (Layout.tsx:579 の `!isMobile` ゲート) でしか mount しない。一方
  // `.theme-military` は **モバイルでも `<html>` に付く** (useThemeStore.ts:71-73)。
  // よって `isMilspecTable` のモバイル条件が将来外れると「CSS が 1 行も当たらない素の帯」が
  // モバイル軍事 (= SP3 の領域) に出る。このテストが JS 側の最後の砦 (レビュー I2)。
  it('モバイル幅では軍事でも帯を出さない (SP3 境界)', () => {
    (window as unknown as { innerWidth: number }).innerWidth = 500;
    useThemeStore.setState({ themeStyle: 'military' });

    const { container } = render(
      <MemoryRouter>
        <Timeline />
      </MemoryRouter>,
    );

    expect(container.querySelector('[data-milspec-recast-band]')).toBeNull();
  });
});
