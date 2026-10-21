// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// 光のエンジンは呼び出しだけ確認する(実際の光は fx/__tests__/engine.test.ts が見る)
vi.mock('../fx/engine', () => ({
  energy: vi.fn(),
  emit: vi.fn(),
}));
import { energy, emit } from '../fx/engine';
import { MilspecSidebar } from '../MilspecSidebar';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { useLocalImportDialog } from '../../../store/useLocalImportDialog';

const mkData = () => ({
  currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
  partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
});

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military' });
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: 'dmu', data: mkData(), ownerId: 'local' },
    { id: 'p2', title: 'B', contentId: 'dmu', data: mkData(), ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
  vi.mocked(energy).mockClear();
  vi.mocked(emit).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const props = { isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn() };
const r = () => render(<MemoryRouter><MilspecSidebar {...props} /></MemoryRouter>);
/** 刻印の文字でキー(button)を探す */
const key = (c: HTMLElement, label: RegExp | string) =>
  Array.from(c.querySelectorAll('button.milspec-key')).find((b) =>
    typeof label === 'string' ? b.textContent === label : label.test(b.textContent ?? '')) as HTMLButtonElement;

describe('MilspecSidebar', () => {
  it('装甲・基板・光の層・ツリーを描く', () => {
    const { container } = r();
    expect(container.querySelector('[data-ms-armor="sb"]')).not.toBeNull();
    expect(container.querySelector('.milspec-plan-core')).not.toBeNull();
    expect(container.querySelector('path[data-trace="s1"]')).not.toBeNull();
    expect(container.querySelector('[data-ms-tree]')).not.toBeNull();
  });

  it('折りたたみハンドルはレールへ移したので、サイドバー内には無い', () => {
    const { container } = r();
    expect(container.querySelector('.milspec-sb-collapse')).toBeNull();
  });

  // 2026-10-05: 寄付導線は全撤去(SE 著作物利用条件 2026-09-16 改訂)。DEPLOYMENT パネルは出さない。
  it('DEPLOYMENT パネル(旧・寄付導線)は描画されない', () => {
    const { container } = r();
    expect(container.querySelector('.milspec-deployment')).toBeNull();
    expect(container.querySelector('button.milspec-deployment-bd')).toBeNull();
  });

  it('コンテンツのキー 4 つがグループに並び、押すとタブが切り替わって aria-pressed と energy が動く', () => {
    const { container } = r();
    const group = container.querySelector('[role="group"]') as HTMLElement;
    expect(group).not.toBeNull();
    const keys = Array.from(group.querySelectorAll('button.milspec-key')) as HTMLButtonElement[];
    expect(keys.length).toBe(4);
    // dmu は零式ではないので、現在のプランに追従したタブが押されている(ちょうど 1 つ)
    expect(keys.filter((k) => k.getAttribute('aria-pressed') === 'true').length).toBe(1);
    const target = keys.find((k) => k.getAttribute('aria-pressed') !== 'true')!;
    fireEvent.click(target);
    expect(target.getAttribute('aria-pressed')).toBe('true');
    expect(keys.filter((k) => k.getAttribute('aria-pressed') === 'true').length).toBe(1);
    expect(energy).toHaveBeenCalledTimes(1);
    expect(energy).toHaveBeenCalledWith(target);
    // すでに押されているキーをもう一度押しても energy は増えない(タブが変わったときだけ)
    fireEvent.click(target);
    expect(energy).toHaveBeenCalledTimes(1);
  });

  it('新規作成キーが milspec:new-plan を出し、s1 に光を流す', () => {
    const listener = vi.fn();
    window.addEventListener('milspec:new-plan', listener);
    const { container } = r();
    const k = key(container, /新規作成|New/);
    fireEvent.click(k);
    expect(listener).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith(k, 's1', { both: true, len: 14 });
    window.removeEventListener('milspec:new-plan', listener);
  });

  it('まとめて共有キーで選択モードに入り、もう一度で抜ける', () => {
    const { container } = r();
    const k = key(container, /まとめて共有|Share/);
    expect(container.querySelector('.milspec-sb-selbar')).toBeNull();
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.milspec-sb-selbar')).not.toBeNull();
    expect(emit).toHaveBeenCalledWith(k, 's1', { both: true, len: 14 });
    fireEvent.click(k);
    expect(k.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.milspec-sb-selbar')).toBeNull();
  });

  const enterDeleteAndPick = (c: HTMLElement) => {
    fireEvent.click(key(c, /選択削除|Delete/));
    // 零式以外(dmu)のプラン行を出すため、現在のタブに B/A が出ているはず
    const row = Array.from(c.querySelectorAll('[role="checkbox"]')).find((e) => /^B/.test(e.textContent ?? ''))!;
    fireEvent.click(row);
  };

  it('選択削除は 1 回目で武装、2 回目で選んだプランだけ消す', () => {
    const { container } = r();
    enterDeleteAndPick(container);
    const exec = container.querySelector('.milspec-sb-selbar button.milspec-key-dng') as HTMLButtonElement;
    expect(exec).not.toBeNull();
    expect(exec.disabled).toBe(false);
    fireEvent.click(exec);
    expect(usePlanStore.getState().plans.length).toBe(2); // まだ消えない
    expect(exec.textContent).toMatch(/1/); // 「もう一度押すと1件を削除」
    fireEvent.click(exec);
    const ids = usePlanStore.getState().plans.map((p) => p.id);
    expect(ids).toEqual(['p1']);
    expect(container.querySelector('.milspec-sb-selbar')).toBeNull(); // 選択モード終了
  });

  it('選択 0 件のとき実行キーは押せない', () => {
    const { container } = r();
    fireEvent.click(key(container, /選択削除|Delete/));
    const exec = container.querySelector('.milspec-sb-selbar button.milspec-key-dng') as HTMLButtonElement;
    expect(exec.disabled).toBe(true);
  });

  it('武装は 3 秒で解除', () => {
    vi.useFakeTimers();
    const { container } = r();
    enterDeleteAndPick(container);
    const exec = container.querySelector('.milspec-sb-selbar button.milspec-key-dng') as HTMLButtonElement;
    fireEvent.click(exec);
    expect(exec.textContent).toMatch(/1/);
    act(() => { vi.advanceTimersByTime(3100); });
    expect(exec.textContent).not.toMatch(/もう一度/);
    fireEvent.click(exec); // 解除後の 1 回目 = また武装するだけ
    expect(usePlanStore.getState().plans.length).toBe(2);
  });

  it('Escape で選択モードを抜ける', () => {
    const { container } = r();
    fireEvent.click(key(container, /まとめて共有|Share/));
    expect(container.querySelector('.milspec-sb-selbar')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(container.querySelector('.milspec-sb-selbar')).toBeNull();
  });

  it('取消キーで選択モードを抜ける', () => {
    const { container } = r();
    fireEvent.click(key(container, /まとめて共有|Share/));
    const cancel = container.querySelector('.milspec-sb-selbar button.milspec-key-cancel') as HTMLButtonElement;
    fireEvent.click(cancel);
    expect(container.querySelector('.milspec-sb-selbar')).toBeNull();
  });

  it('取り込みキーで取り込みダイアログ、バックアップ・復元キーでモーダルを開く', () => {
    const open = vi.spyOn(useLocalImportDialog.getState(), 'open');
    const { container } = r();
    fireEvent.click(key(container, /インポート|Import/));
    expect(open).toHaveBeenCalled();
    // S3 のキーは光らせない
    expect(emit).not.toHaveBeenCalled();
    expect(energy).not.toHaveBeenCalled();
    // モーダルは開いたとき body に出る(閉じている間は何も出ない)
    const before = document.body.textContent?.length ?? 0;
    fireEvent.click(key(container, /バックアップ|Backup/));
    expect((document.body.textContent?.length ?? 0)).toBeGreaterThan(before);
    fireEvent.click(key(container, /復元|Restore/));
  });

  it('Template と「現在のプランを削除」キーは無い', () => {
    const { container } = r();
    expect(container.textContent).not.toMatch(/Template|テンプレート/);
    expect(key(container, /^削除$|^Delete$|現在のプラン/)).toBeUndefined();
  });
});
