// @vitest-environment happy-dom
/**
 * プランを開いた時に「空の行も出す」の全行を一度作って捨てない見張り(2026-10-28)。
 * 前は useTimelinePlanScrollReset が描いた後(useEffect)に「隠す」へ戻していたため、
 * 保存された設定が「出す」のままだと全行(本番で約 6.8 万個の部品)を作って捨て、開くたびに約 1.6 秒固まっていた。
 * ハーネスは Timeline.readonlyEdit.test.tsx と同じ作法。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, f?: unknown) => (typeof f === 'string' ? f : k),
    i18n: { language: 'ja', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
  I18nextProvider: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('../../hooks/useCanPreviewWip', () => ({
  useCanPreviewWip: () => true,
  getCanPreviewWip: () => true,
}));

import Timeline from '../Timeline';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useThemeStore } from '../../store/useThemeStore';

const events = [0, 10, 20, 30].map((t, i) => ({
  id: `po-ev${i}`, time: t, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' },
  damageType: 'magical', damageAmount: 90000, target: 'AoE',
}));

function plan(id: string, timelineEvents: unknown[]) {
  return {
    id, ownerId: 'guest', ownerDisplayName: '', title: id, contentId: null, isPublic: false,
    copyCount: 0, useCount: 0, createdAt: 1, updatedAt: 1,
    data: { currentLevel: 100, timelineEvents, timelineMitigations: [], phases: [], partyMembers: [] },
  };
}

/** 表示中に消えた行(data-time-row)の数を数える */
function watchRemovedRows() {
  let removed = 0;
  const tally = (recs: MutationRecord[]) => {
    for (const r of recs) for (const n of r.removedNodes) {
      if (!(n instanceof Element)) continue;
      if (n.hasAttribute('data-time-row')) removed++;
      removed += n.querySelectorAll('[data-time-row]').length;
    }
  };
  const obs = new MutationObserver(tally);
  obs.observe(document.body, { childList: true, subtree: true });
  return { count: () => { tally(obs.takeRecords()); return removed; }, stop: () => obs.disconnect() };
}

beforeEach(() => {
  (window as unknown as { innerWidth: number }).innerWidth = 1489;
  useMitigationStore.setState({
    timelineEvents: events as never, phases: [], labels: [], timelineMitigations: [],
    currentLevel: 100, _history: [], _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  useThemeStore.setState({ timelineView: 'lanes' });
});

afterEach(() => { cleanup(); });

describe('プランを開いた時に全行を作って捨てない', () => {
  it('「出す」が保存された状態で中身のあるプランを開いても、行を作って捨てない', async () => {
    usePlanStore.setState({ plans: [plan('po-full', events)] as never, currentPlanId: 'po-full' });
    useMitigationStore.setState({ hideEmptyRows: false });
    const w = watchRemovedRows();
    const { container } = render(<MemoryRouter><Timeline /></MemoryRouter>);
    await new Promise((r) => setTimeout(r, 0));
    const removed = w.count();
    w.stop();
    expect(useMitigationStore.getState().hideEmptyRows).toBe(true);
    expect(container.querySelectorAll('[data-time-row]').length).toBeGreaterThan(0);
    expect(removed).toBe(0);
  });

  it('対照: 空のプランを開いたら「出す」に切り替わる(今までどおり)', () => {
    usePlanStore.setState({ plans: [plan('po-empty', [])] as never, currentPlanId: 'po-empty' });
    useMitigationStore.setState({ hideEmptyRows: true, timelineEvents: [] });
    render(<MemoryRouter><Timeline /></MemoryRouter>);
    expect(useMitigationStore.getState().hideEmptyRows).toBe(false);
  });
});
