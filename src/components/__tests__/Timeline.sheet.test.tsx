// @vitest-environment happy-dom
/**
 * スプシ表示の本体(置く・消す・帯・リキャスト線・弾く)の DOM 契約テスト。
 * 設計書: docs/superpowers/specs/2026-10-22-spreadsheet-mode-design.md §3.2〜3.4
 *
 * happy-dom では offsetLeft/width・getBoundingClientRect がすべて 0 なので、
 * メンバー列の左端 = 0・マスの左端 = 0 として「列番号 × 28 + 5」を確かめる。
 * ハーネスは Timeline.recastBand.milspec.test.tsx と同じ作法。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
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
import { buildSheetColumns, SHEET_COL_W } from '../timeline/sheet/sheetColumns';
import { getSharedCooldownIds } from '../../utils/resourceTracker';
import type { Mitigation } from '../../types';
import { MITIGATIONS } from '../../data/mockData';

const events = [0, 10, 20, 30, 60, 90, 120, 150].map((t, i) => ({
  id: `s8-ev${i}`, time: t, name: { ja: '攻撃', en: 'Attack', zh: '', ko: '' },
  damageType: 'magical', damageAmount: 90000, target: 'AoE',
}));

function warColumns() {
  return buildSheetColumns('war', MITIGATIONS as Mitigation[], 100);
}

/** 即配置できる(対象指定・鼓舞選択でない)・非チャージ・リキャストのある列 */
function pickPlainColumn(): { index: number; def: Mitigation } {
  const cols = warColumns();
  const index = cols.findIndex(c =>
    c.def.scope !== 'target' && !c.def.copiesShield && !c.def.maxCharges && !c.def.requires
    && !c.def.resourceCost && (c.def.recast ?? 0) >= 60 && (c.def.recast ?? 0) <= 120 && c.def.duration > 1
    && getSharedCooldownIds(c.def.id).length === 1);
  return { index, def: cols[index].def };
}

function renderTimeline() {
  return render(
    <MemoryRouter>
      <Timeline />
    </MemoryRouter>,
  );
}

/** time 秒の行の、i 番目のメンバー(MT = 先頭)のマス */
function cellAt(container: HTMLElement, time: number, memberIndex = 0): HTMLElement {
  const row = container.querySelector(`[data-time-row="${time}"]`);
  if (!row) throw new Error(`row ${time} not rendered`);
  const cells = row.querySelectorAll('[data-sheet-cols]');
  return cells[memberIndex] as HTMLElement;
}

/** 置いたアイコン(列見出しの静的アイコン [data-sheet-member] 内は除く) */
function placedIcons(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-mit-icon]')].filter(el => !el.closest('[data-sheet-member]'));
}

/** data-mit-icon を包む MitigationItem の外枠(left/width を持つ要素) */
function iconBox(el: Element): HTMLElement {
  let cur: HTMLElement | null = el as HTMLElement;
  while (cur && !cur.style.left) cur = cur.parentElement;
  if (!cur) throw new Error('no positioned ancestor');
  return cur;
}

beforeEach(() => {
  (window as unknown as { innerWidth: number }).innerWidth = 1489;
  wip.can = true;
  useMitigationStore.setState({
    timelineEvents: events as never,
    phases: [],
    labels: [],
    timelineMitigations: [],
    currentLevel: 100,
    // 表示の最初に useTimelinePlanScrollReset が空でないプランを「空の行は隠す」にするので、最初からその状態にしておく(false だと全行を一度作って捨てる=1 回 4 秒)
    hideEmptyRows: true,
    _history: [],
    _future: [],
  });
  useMitigationStore.getState().setMemberJob('MT', 'war');
  usePlanStore.setState({ currentPlanId: 's8-plan' });
  useThemeStore.setState({ timelineView: 'sheet' });
});

afterEach(() => {
  cleanup();
  useThemeStore.setState({ timelineView: 'lanes' });
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('スプシ表示の本体', () => {
  it('スプシ: 置いたアイコンは列の左端 + 5px、幅 18px(data-mit-icon の style)', () => {
    const { index, def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
    const { container } = renderTimeline();
    const icons = placedIcons(container);
    expect(icons.length).toBe(1);
    const box = iconBox(icons[0]);
    expect(box.style.left).toBe(`${index * SHEET_COL_W + 5}px`);
    expect(box.style.width).toBe('18px');
  });

  it('スプシ: リキャスト線 data-mit-cd が配置の数だけあり、共有リキャストの列にも引かれる', () => {
    const { def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 0, duration: def.duration } as never);
    useMitigationStore.getState().addMitigation({ id: 's8-b', mitigationId: def.id, ownerId: 'MT', time: def.recast, duration: def.duration } as never);
    const { container } = renderTimeline();
    expect(container.querySelectorAll('[data-mit-cd]').length).toBe(2);

    // 共有リキャスト: 戦士の原初の血気 / 原初の直感 / ニーズフラッシュ(BLOODWHETTING グループ)
    cleanup();
    useMitigationStore.setState({ timelineMitigations: [] });
    const cols = warColumns();
    const groupCols = cols
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => getSharedCooldownIds('bloodwhetting').includes(c.mitigationId));
    expect(groupCols.length).toBeGreaterThanOrEqual(2);
    useMitigationStore.getState().addMitigation({ id: 's8-bw', mitigationId: groupCols[0].c.mitigationId, ownerId: 'MT', time: 0, duration: groupCols[0].c.def.duration } as never);
    const r2 = renderTimeline();
    const lines = [...r2.container.querySelectorAll<HTMLElement>('[data-mit-cd]')];
    expect(lines.length).toBe(groupCols.length);
    // 線の外箱(帯と同じ 6px 幅・同じ中心)の left
    const lefts = lines.map(l => (l.closest('[data-mit-cd-box]') as HTMLElement).style.left).sort();
    const expected = groupCols.map(({ i }) => `${i * SHEET_COL_W + SHEET_COL_W / 2 - 3}px`).sort();
    expect(lefts).toEqual(expected);
  });

  it('スプシ: マスをクリックすると MitigationSelector は開かず addMitigation が呼ばれる。もう一度で removeMitigation', () => {
    const { index, def } = pickPlainColumn();
    const { container } = renderTimeline();
    // 他のモーダル(新規プラン等)も data-tutorial-modal を持つので、押す前後の数で「開かない」を確かめる
    const modalsBefore = container.ownerDocument.querySelectorAll('[data-tutorial-modal]').length;
    const cell = cellAt(container, 30);
    fireEvent.click(cell, { clientX: index * SHEET_COL_W + 10 });
    const placed = useMitigationStore.getState().timelineMitigations;
    expect(placed.length).toBe(1);
    expect(placed[0]).toMatchObject({ mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration });
    expect(container.ownerDocument.querySelectorAll('[data-tutorial-modal]').length).toBe(modalsBefore);

    fireEvent.click(cellAt(container, 30), { clientX: index * SHEET_COL_W + 10 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
  });

  it('スプシ: 置いたアイコンをドラッグせずに押すと消える(アイコンがマスの上に乗っていても「もう一度で消す」)', () => {
    const { index, def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
    const { container } = renderTimeline();
    const cell = cellAt(container, 30);
    const x = index * SHEET_COL_W + 10;
    // happy-dom に elementsFromPoint の実体は無いので、アイコンの下のマスを返す
    (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [cell];
    const icon = placedIcons(container)[0];
    fireEvent.pointerDown(icon, { button: 0, clientX: x, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(icon, { button: 0, clientX: x, clientY: 101, pointerId: 1 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
    delete (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it('スプシ: 版違い(旧 id)の配置も、その列のマスをもう一度押すと消える(新版を重ねて置かない)', () => {
    // ガンブレイカー Lv100: 列は aurora_v2(2 チャージ)。旧 aurora は同じアイコンなので同じ列に描かれる
    useMitigationStore.getState().setMemberJob('MT', 'gnb');
    const cols = buildSheetColumns('gnb', MITIGATIONS as Mitigation[], 100);
    const index = cols.findIndex(c => c.mitigationId === 'aurora_v2');
    expect(index).toBeGreaterThanOrEqual(0);
    const old = (MITIGATIONS as Mitigation[]).find(m => m.id === 'aurora')!;
    useMitigationStore.getState().addMitigation({ id: 's8-old', mitigationId: 'aurora', ownerId: 'MT', time: 30, duration: old.duration } as never);
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(1);
    const { container } = renderTimeline();
    fireEvent.click(cellAt(container, 30), { clientX: index * SHEET_COL_W + 2 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
  });

  it('スプシ: リキャスト中のマスにもレーン表示と同じく置ける(揺れ・トーストは出ない。重なりはシェブロンが知らせる)', () => {
    const { index, def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 0, duration: def.duration } as never);
    const { container } = renderTimeline();
    const cell = cellAt(container, 30);
    fireEvent.click(cell, { clientX: index * SHEET_COL_W + 10 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(2);
    expect(cell.hasAttribute('data-shake')).toBe(false);
    expect(container.ownerDocument.body.textContent).not.toContain('mitigation.cd_remaining');
  });

  it('レーン: timelineView=sheet でも canPreviewWip=false なら従来 DOM(data-sheet-cols 無し・data-mit-cd 無し)', () => {
    wip.can = false;
    const { def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 0, duration: def.duration } as never);
    const { container } = renderTimeline();
    expect(container.querySelector('[data-sheet-cols]')).toBeNull();
    expect(container.querySelector('[data-mit-cd]')).toBeNull();
    const icons = placedIcons(container);
    expect(icons.length).toBe(1);
    // レーン表示: 幅 24px(MITI_ICON_PX)。left は Phase 1 の式(計測 0 の happy-dom では 0 + 2 + MAX_LEFT(-26) = -24)
    const box = iconBox(icons[0]);
    expect(box.style.width).toBe('24px');
    expect(box.style.left).toBe('-24px');
  });

  it('スプシ: 対象指定の技はマスを押すと小窓が出て、相手を選ぶと targetId つきで置かれる', () => {
    const cols = warColumns();
    const index = cols.findIndex(c => c.def.scope === 'target');
    expect(index).toBeGreaterThanOrEqual(0);
    const { container } = renderTimeline();
    fireEvent.click(cellAt(container, 30), { clientX: index * SHEET_COL_W + 10 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
    const pop = container.ownerDocument.querySelector('[data-sheet-popover]');
    expect(pop).not.toBeNull();
    const btn = pop!.querySelector<HTMLButtonElement>('button[data-target-id="ST"]')!;
    act(() => { fireEvent.click(btn); });
    const placed = useMitigationStore.getState().timelineMitigations;
    expect(placed.length).toBe(1);
    expect(placed[0]).toMatchObject({ mitigationId: cols[index].def.id, targetId: 'ST', time: 30 });
    expect(container.ownerDocument.querySelector('[data-sheet-popover]')).toBeNull();
  });

  it('スプシ: 置いたアイコンを横に大きく動かして離したときは「押した」扱いにならない(消えない)', () => {
    const { index, def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's10-a', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
    const { container } = renderTimeline();
    const cell = cellAt(container, 30);
    const x = index * SHEET_COL_W + 10;
    (document as unknown as { elementsFromPoint: () => Element[] }).elementsFromPoint = () => [cell];
    const icon = placedIcons(container)[0];
    fireEvent.pointerDown(icon, { button: 0, clientX: x, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(icon, { button: 0, clientX: x + 40, clientY: 101, pointerId: 1 });
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(1);
    delete (document as unknown as { elementsFromPoint?: unknown }).elementsFromPoint;
  });

  it('スプシ: レーン表示へ切り替えると対象選択の小窓は閉じ、スプシに戻しても再び出ない', () => {
    const cols = warColumns();
    const index = cols.findIndex(c => c.def.scope === 'target');
    const { container } = renderTimeline();
    fireEvent.click(cellAt(container, 30), { clientX: index * SHEET_COL_W + 10 });
    expect(container.ownerDocument.querySelector('[data-sheet-popover]')).not.toBeNull();
    act(() => { useThemeStore.getState().setTimelineView('lanes'); });
    expect(container.ownerDocument.querySelector('[data-sheet-popover]')).toBeNull();
    act(() => { useThemeStore.getState().setTimelineView('sheet'); });
    expect(container.ownerDocument.querySelector('[data-sheet-popover]')).toBeNull();
  });

  it('スプシ: 対象つきの技の対象バッジ(ジョブ未設定の相手 = 文字バッジ)は scale-[.6] に縮み、レーンは縮まない', () => {
    const cols = warColumns();
    const def = cols.find(c => c.def.scope === 'target')!.def;
    useMitigationStore.getState().addMitigation({ id: 's10-t', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration, targetId: 'ST' } as never);
    const { container } = renderTimeline();
    const wrap = container.querySelector('[class*="-bottom-[3px]"]') as HTMLElement | null;
    expect(wrap).not.toBeNull();
    expect(wrap!.firstElementChild!.className).toContain('scale-[.6]');
    act(() => { useThemeStore.getState().setTimelineView('lanes'); });
    expect(container.querySelector('[class*="-bottom-[3px]"]')).toBeNull();
    const lane = container.querySelector('.-bottom-2') as HTMLElement | null;
    expect(lane).not.toBeNull();
    expect(lane!.firstElementChild!.className).not.toContain('scale-[.6]');
  });

  it('スプシ: 対象つきの技の対象バッジ(ジョブありの相手 = アイコン画像)は 10px、レーンは 20px', () => {
    useMitigationStore.getState().setMemberJob('ST', 'pld');
    const cols = warColumns();
    const def = cols.find(c => c.def.scope === 'target')!.def;
    useMitigationStore.getState().addMitigation({ id: 's10-t2', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration, targetId: 'ST' } as never);
    const { container } = renderTimeline();
    const wrap = container.querySelector('[class*="-bottom-[3px]"]') as HTMLElement | null;
    expect(wrap).not.toBeNull();
    expect(wrap!.firstElementChild!.className).toContain('w-[10px]');
    act(() => { useThemeStore.getState().setTimelineView('lanes'); });
    const lane = container.querySelector('.-bottom-2') as HTMLElement | null;
    expect(lane).not.toBeNull();
    expect(lane!.firstElementChild!.className).toContain('w-[20px]');
    expect(lane!.firstElementChild!.className).not.toContain('w-[10px]');
  });

  it('スプシ: セラフィズム中に鼓舞激励の策の列を押すと、レーン表示と同じくマニフェステーションで置かれる', () => {
    useMitigationStore.getState().setMemberJob('MT', 'sch');
    const cols = buildSheetColumns('sch', MITIGATIONS as Mitigation[], 100);
    const index = cols.findIndex(c => c.def.id === 'adloquium');
    expect(index).toBeGreaterThanOrEqual(0);
    const sera = MITIGATIONS.find(m => m.id === 'seraphism')!;
    useMitigationStore.getState().addMitigation({ id: 's11-sera', mitigationId: 'seraphism', ownerId: 'MT', time: 0, duration: sera.duration } as never);
    const { container } = renderTimeline();
    fireEvent.click(cellAt(container, 10), { clientX: index * SHEET_COL_W + 10 });
    // 両方とも対象指定の技なので小窓が出る。相手を選ぶと、差し替え後の技(マニフェステーション)で置かれる
    const btn = container.ownerDocument.querySelector('[data-sheet-popover]')!.querySelector<HTMLButtonElement>('button[data-target-id="ST"]')!;
    act(() => { fireEvent.click(btn); });
    const placed = useMitigationStore.getState().timelineMitigations.filter(m => m.time === 10);
    expect(placed.length).toBe(1);
    expect(placed[0].mitigationId).toBe('manifestation');
  });

  it('スプシ: autoHidden の配置にもリキャスト線が引かれる(判定は含めるので線と一致させる)', () => {
    const { def } = pickPlainColumn();
    // 表の折りたたみ(hideEmptyRows)が既定で効くので、autoHidden 単独だと行も出ない。通常の配置と並べて、両方に線が引かれることを見る
    useMitigationStore.getState().addMitigation({ id: 's12-a', mitigationId: def.id, ownerId: 'MT', time: 0, duration: def.duration } as never);
    useMitigationStore.getState().addMitigation({ id: 's12-auto', mitigationId: def.id, ownerId: 'MT', time: def.recast, duration: def.duration, autoHidden: true } as never);
    const { container } = renderTimeline();
    expect(container.querySelectorAll('[data-mit-cd]').length).toBe(2);
  });

  it('スプシ: 小窓を開いている間に別の配置でリキャスト中になったら、相手を選んでも置かれずトーストが出る', () => {
    const cols = warColumns();
    const index = cols.findIndex(c => c.def.scope === 'target');
    const def = cols[index].def;
    const { container } = renderTimeline();
    fireEvent.click(cellAt(container, 30), { clientX: index * SHEET_COL_W + 10 });
    const pop = container.ownerDocument.querySelector('[data-sheet-popover]');
    expect(pop).not.toBeNull();
    // 共同編集で同じ技が(チャージ数ぶん)先に置かれた状況
    const n = def.maxCharges ?? 1;
    act(() => {
      for (let i = 0; i < n; i++) {
        useMitigationStore.getState().addMitigation({ id: `s13-${i}`, mitigationId: def.id, ownerId: 'MT', time: 27 + i * 0.5, duration: def.duration } as never);
      }
    });
    const btn = container.ownerDocument.querySelector('[data-sheet-popover]')!.querySelector<HTMLButtonElement>('button[data-target-id="ST"]')!;
    act(() => { fireEvent.click(btn); });
    // チャージ技は全消費で置けない(レーン表示でも置けない)。チャージの無い技はリキャスト中でも置ける(conflictOverride)
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(def.maxCharges ? n : n + 1);
    expect(container.ownerDocument.querySelector('[data-sheet-popover]')).toBeNull();
  });

  it('A9 スプシ: 置いたアイコンを右クリックしても消えない(左クリックだけ)。ブラウザ標準のメニューは出さない', () => {
    const { def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
    const { container } = renderTimeline();
    const icon = placedIcons(container)[0];
    const notPrevented = fireEvent.contextMenu(icon);
    expect(notPrevented).toBe(false); // preventDefault 済み = 標準メニューは出ない(レーン表示と同じ)
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(1);
    expect(placedIcons(container).length).toBe(1);
  });

  it('A9 レーン: 右クリックで消える(従来どおり)', () => {
    wip.can = false;
    const { def } = pickPlainColumn();
    useMitigationStore.getState().addMitigation({ id: 's8-a', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
    const { container } = renderTimeline();
    fireEvent.contextMenu(placedIcons(container)[0]);
    expect(useMitigationStore.getState().timelineMitigations.length).toBe(0);
  });

  it('A8 スプシ: 配置を消す(ストア・左クリック)と、アイコンも線も同じ描画で消える(線だけ残らない)', () => {
    const cols = warColumns();
    const groupIds = getSharedCooldownIds('bloodwhetting');
    const g = cols.find(c => groupIds.includes(c.mitigationId))!;
    const { def } = pickPlainColumn();
    for (const hide of [false, true]) {
      cleanup();
      useMitigationStore.setState({ timelineMitigations: [] });
      useMitigationStore.getState().addMitigation({ id: 'w1', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
      useMitigationStore.getState().addMitigation({ id: 'w2', mitigationId: g.mitigationId, ownerId: 'MT', time: 60, duration: g.def.duration } as never);
      const { container } = renderTimeline();
      // 表示の最初に「隠す」へ戻されるので、描いた後に切り替える
      act(() => { useMitigationStore.setState({ hideEmptyRows: hide }); });
      expect(container.querySelectorAll('[data-mit-cd-box]').length).toBeGreaterThanOrEqual(2);
      act(() => { useMitigationStore.getState().removeMitigation('w1'); });
      act(() => { useMitigationStore.getState().removeMitigation('w2'); });
      expect(placedIcons(container).length).toBe(0);
      expect(container.querySelectorAll('[data-mit-cd-box]').length).toBe(0);
    }
    // 「空の行も出す」側は全行(約 5 万要素)を描くため単体で 12 秒かかる。全体実行の混雑でも落ちないよう長めに待つ
  }, 60_000);

  it('A10 スプシ: 本体のマウスがある列の技(アイコン+名前)のツールチップが 1 個だけ出て、列が変わると差し替わり、外れると消える', () => {
    const cols = warColumns();
    const { container } = renderTimeline();
    const cell = cellAt(container, 30);
    const left = cell.getBoundingClientRect().left;
    const sheet = container.querySelector('[data-time-row]')!.parentElement!;
    // happy-dom は行の実寸が 0 なので、列の帯は memberLayout 未計測 = 出ない。計測値を持たない環境では出ないことだけ確認する
    fireEvent.pointerMove(sheet, { clientX: left + 3, clientY: 100, pointerType: 'mouse' });
    expect(document.querySelectorAll('[data-sheet-col-tooltip]').length).toBeLessThanOrEqual(1);
    fireEvent.pointerLeave(container.querySelector('.isolate')!);
    expect(document.querySelector('[data-sheet-col-tooltip]')).toBeNull();
    expect(cols.length).toBeGreaterThan(0);
  });

  it('スプシ: 置いたアイコンにマウスを載せても、ふつう表示用のツールチップ(ドラッグの案内)は出ない。ふつう表示では出る', async () => {
    const { def } = pickPlainColumn();
    const hoverHint = async (): Promise<boolean> => {
      useMitigationStore.setState({ timelineMitigations: [] });
      useMitigationStore.getState().addMitigation({ id: 's8-tip', mitigationId: def.id, ownerId: 'MT', time: 30, duration: def.duration } as never);
      const { container } = renderTimeline();
      const icon = [...container.querySelectorAll('[data-mit-icon]')].find(el => !el.closest('[data-sheet-member]'))!;
      fireEvent.mouseEnter(icon.parentElement!);
      await act(async () => { await new Promise(r => setTimeout(r, 250)); });
      const shown = document.body.textContent?.includes('timeline.mitigation_drag_hint') ?? false;
      cleanup();
      return shown;
    };
    useThemeStore.setState({ timelineView: 'lanes' });
    expect(await hoverHint()).toBe(true);
    useThemeStore.setState({ timelineView: 'sheet' });
    expect(await hoverHint()).toBe(false);
  });
});
