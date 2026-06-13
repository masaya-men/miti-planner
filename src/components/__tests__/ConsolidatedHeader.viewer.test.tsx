// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── 基本モック ──────────────────────────────────────────────
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'ja' } }) }));

vi.mock('../../data/contentRegistry', () => ({
  getContentById: (id: string) =>
    id === 'TEA'
      ? { name: { ja: '絶アレキサンダー討滅戦', en: 'TEA', zh: '', ko: '' } }
      : undefined,
}));

// ── ストアモック ─────────────────────────────────────────────
const themeStore = { theme: 'dark', contentLanguage: 'ja', setTheme: vi.fn() };
vi.mock('../../store/useThemeStore', () => ({
  useThemeStore: (sel?: (s: typeof themeStore) => unknown) =>
    sel ? sel(themeStore) : themeStore,
}));

const mitiStore = {
  myJobHighlight: false,
  setMyJobHighlight: vi.fn(),
  timelineEvents: [],
};
vi.mock('../../store/useMitigationStore', () => ({
  useMitigationStore: (sel: (s: typeof mitiStore) => unknown) => sel(mitiStore),
}));

const planStore = { plans: [], currentPlanId: null };
vi.mock('../../store/usePlanStore', () => ({
  usePlanStore: (sel: (s: typeof planStore) => unknown) => sel(planStore),
}));

const authStore = {
  user: null as null | { uid: string },
  profileDisplayName: null as string | null,
  profileAvatarUrl: null as string | null,
  justLoggedInUser: null,
};
vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (sel?: (s: typeof authStore) => unknown) =>
    sel ? sel(authStore) : authStore,
}));

vi.mock('../../store/useTutorialStore', () => ({
  useTutorialStore: { getState: () => ({ completeEvent: vi.fn() }) },
}));

// ── getPhaseName モック ──────────────────────────────────────
vi.mock('../../types', () => ({
  getPhaseName: (name: { ja?: string; en?: string; zh?: string; ko?: string }, lang: string) =>
    name[lang as 'ja' | 'en' | 'zh' | 'ko'] ?? name.en ?? '',
}));

// ── framer-motion モック（motion.div → 普通の div）──────────
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...rest }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) =>
      React.createElement('div', rest, children),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
}));

// ── 子コンポーネントモック（内部ストア依存を遮断）───────────
vi.mock('../LoPoButton', () => ({ LoPoButton: () => null }));
vi.mock('../tutorial/TutorialMenu', () => ({ TutorialMenu: () => null }));
vi.mock('../LanguageSwitcher', () => ({ LanguageSwitcher: () => null }));
vi.mock('../PartyStatusPopover', () => ({ PartyStatusPopover: () => null }));
vi.mock('../LoginModal', () => ({ LoginModal: () => null }));
vi.mock('../ui/Tooltip', () => ({ Tooltip: ({ children }: { children?: React.ReactNode }) => children }));
vi.mock('../ShareButtons', () => ({ ShareButtons: () => null }));
vi.mock('../SyncButton', () => ({ SyncButton: () => null }));
vi.mock('../ui/TransitionOverlay', () => ({ useTransitionOverlay: () => ({ runTransition: vi.fn() }) }));
vi.mock('../ui/SegmentButton', () => ({ SegmentButton: () => null }));
vi.mock('../MitigationSheet', () => ({ MitigationSheet: () => null }));

import React from 'react';
import { ConsolidatedHeader } from '../ConsolidatedHeader';

// ── dummy props (non-viewer path requires these) ──────────────
const dummyProps = {
  onAutoPlan: vi.fn(),
  onImportLogs: vi.fn(),
  partySortOrder: 'role' as const,
  setPartySortOrder: vi.fn(),
  statusOpen: false,
  setStatusOpen: vi.fn(),
};

describe('ConsolidatedHeader viewer mode', () => {
  it('viewer 指定時は contentId から部屋のコンテンツ名を表示(usePlanStore 非依存)', () => {
    render(
      <MemoryRouter>
        <ConsolidatedHeader
          {...dummyProps}
          viewer={{ contentId: 'TEA', ownerLabel: null }}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/絶アレキサンダー討滅戦/)).toBeInTheDocument();
  });
});
