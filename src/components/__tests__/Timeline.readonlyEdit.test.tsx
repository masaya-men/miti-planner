// @vitest-environment happy-dom
/**
 * 閲覧専用(ジョイナーで編集不可)の見張り。編集の操作を Timeline から別ファイルへ移す整頓の前後で挙動を保つ。
 * ハーネスは Timeline.sheet.test.tsx と同じ作法。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
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

// WIP ゲート: 既定は見せてよい。最後のケースだけ false にする
const wip = vi.hoisted(() => ({ can: true }));
vi.mock('../../hooks/useCanPreviewWip', () => ({
  useCanPreviewWip: () => wip.can,
  getCanPreviewWip: () => wip.can,
}));

import React from 'react';
import Timeline from '../Timeline';
import { useMitigationStore } from '../../store/useMitigationStore';
import { usePlanStore } from '../../store/usePlanStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useCollabJoinerSession } from '../../store/useCollabJoinerSession';

const events = [0, 10, 20, 30].map((t, i) => ({
  id: `ro-ev${i}`, time: t, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' },
  damageType: 'magical', damageAmount: 90000, target: 'AoE',
}));

function renderTimeline() {
  return render(<MemoryRouter><Timeline /></MemoryRouter>);
}

function laneCell(container: HTMLElement, time: number): HTMLElement {
  const row = container.querySelector(`[data-time-row="${time}"]`);
  if (!row) throw new Error(`row ${time} not rendered`);
  return row.querySelectorAll('[data-job-col]')[0] as HTMLElement;
}

const modalCount = (c: HTMLElement) => c.ownerDocument.querySelectorAll('[data-tutorial-modal]').length;

/** ふつう表示で置かれたアイコンの onContextMenu を持つ外枠 */
function placedIconBox(container: HTMLElement): HTMLElement {
  const icon = container.querySelector('[data-mit-icon]') as HTMLElement;
  return icon.parentElement!.closest('[class*="cursor"]') as HTMLElement ?? icon;
}

beforeEach(() => {
  (window as unknown as { innerWidth: number }).innerWidth = 1489;
  wip.can = true;
  useMitigationStore.setState({
    timelineEvents: events as never, phases: [], labels: [], timelineMitigations: [],
    currentLevel: 100,
    // 表示の最初に useTimelinePlanScrollReset が空でないプランを「空の行は隠す」にするので、最初からその状態にしておく(false だと全行を一度作って捨てる=1 回 4 秒)
    hideEmptyRows: true, _history: [], _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  usePlanStore.setState({ currentPlanId: 'ro-plan' });
  useThemeStore.setState({ timelineView: 'lanes' });
});

afterEach(() => {
  cleanup();
  useCollabJoinerSession.getState().clear();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('閲覧専用の編集ガード', () => {
  it('対照: 通常(閲覧専用でない)ではセルを押すと軽減選択が開く', () => {
    const { container } = renderTimeline();
    const before = modalCount(container);
    fireEvent.click(laneCell(container, 10));
    expect(modalCount(container)).toBe(before + 1);
  });

  it('閲覧専用では行のセルを押しても軽減選択が開かない', () => {
    useCollabJoinerSession.getState().enter('tok');
    const { container } = renderTimeline();
    const before = modalCount(container);
    const addSpy = vi.spyOn(useMitigationStore.getState(), 'addMitigation');
    fireEvent.click(laneCell(container, 10));
    expect(modalCount(container)).toBe(before);
    expect(addSpy).not.toHaveBeenCalled();
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
  });

  it('閲覧専用では右クリックで軽減が消えない', () => {
    useMitigationStore.getState().addMitigation({ id: 'ro-a', mitigationId: 'rampart', ownerId: 'MT', time: 10, duration: 20 } as never);
    useCollabJoinerSession.getState().enter('tok');
    const { container } = renderTimeline();
    const box = placedIconBox(container);
    fireEvent.contextMenu(box);
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(1);
  });

  it('対照: 通常では右クリックで軽減が消える', () => {
    useMitigationStore.getState().addMitigation({ id: 'ro-a', mitigationId: 'rampart', ownerId: 'MT', time: 10, duration: 20 } as never);
    const { container } = renderTimeline();
    fireEvent.contextMenu(placedIconBox(container));
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
  });
});
