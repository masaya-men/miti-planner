// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MilspecSidebar } from '../MilspecSidebar';
import { usePlanStore } from '../../../store/usePlanStore';
import { useThemeStore } from '../../../store/useThemeStore';
import { useMitigationStore } from '../../../store/useMitigationStore';
import * as planLoadModule from '../../../lib/planLoad';

// 実運用のプランは常に非空データを持つ(brief のテストひな形にあった data:{} は
// loadPlanDataIntoStore→loadSnapshot が partyMembers 等を前提にしており非現実的な入力だった)。
const mkData = () => ({
  currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
  partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
});

beforeEach(() => {
  useThemeStore.setState({ themeStyle: 'military' });
  usePlanStore.setState({ plans: [
    { id: 'p1', title: 'A', contentId: null, data: mkData(), ownerId: 'local' },
    { id: 'p2', title: 'B', contentId: null, data: mkData(), ownerId: 'local' },
  ] as never, currentPlanId: 'p1' });
});
// 【Fix round 1 デバッグ知見】Zustand の内部 state オブジェクトは set() のたびに
// Object.assign({}, prev, partial) で「前のオブジェクトのプロパティを値渡しで引き継ぐ」ため、
// vi.spyOn(usePlanStore.getState(), 'x') で一度 x を書き換えると、以降どれだけ set() が
// 走っても(x を含まない partial なら)その spy 関数の参照がずっと引き継がれる。
// さらに vi.spyOn は「対象が既にモックなら新規に包み直さず既存のモックを返す」仕様のため、
// 別テストで再度 vi.spyOn しても "前のテストの呼び出し履歴を持ったまま" のオブジェクトが
// 返ってくる(vi.restoreAllMocks は spy 作成時点のオブジェクト参照に対して復元するだけなので、
// 既に世代交代した internal state には効かず無力)。→ 各テストで spy 取得直後に必ず
// mockClear() し、そのテスト内の呼び出しだけを見るようにする(このコメントとセットで、
// 同じ罠に落ちないよう残す)。
afterEach(() => { vi.restoreAllMocks(); });
const props = { isSidebarOpen: true, onToggleSidebar: vi.fn(), onCloseSidebar: vi.fn() };
// MilspecSidebar は NEW ボタンで useNavigate() を使うため MemoryRouter が要る
// (MilspecHeader.test.tsx と同じ理由で追加。brief 記載のテストコードに対する必要な補正)。
const r = () => render(<MemoryRouter><MilspecSidebar {...props} /></MemoryRouter>);

describe('MilspecSidebar', () => {
  it('SCENARIO / PHASES / DOCK / DEPLOYMENT パネルを描画', () => {
    const { container } = r();
    expect(container.textContent).toMatch(/シナリオ|Scenario/);
    expect(container.textContent).toMatch(/バックアップ|Backup/);
  });
  it('プラン行クリックで setCurrentPlanId', async () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    spy.mockClear();
    const { getByText } = r();
    fireEvent.click(getByText('B'));
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p2'));
  });
  it('折りたたみハンドルで onToggleSidebar', () => {
    const { getByRole } = r();
    fireEvent.click(getByRole('button', { name: /collapse|折りたた|‹/i }));
    expect(props.onToggleSidebar).toHaveBeenCalled();
  });
  it('プラン行の複製アイコンで duplicatePlan が呼ばれる', () => {
    const spy = vi.spyOn(usePlanStore.getState(), 'duplicatePlan').mockResolvedValue(null);
    spy.mockClear();
    const { container } = r();
    // 先頭行 = p1(A・currentPlanId)。行内アクションは [rename, duplicate] の順。
    const firstRow = container.querySelector('.milspec-pi');
    const actionButtons = firstRow!.querySelectorAll('.ac button');
    expect(actionButtons.length).toBe(2);
    fireEvent.click(actionButtons[1]);
    expect(spy).toHaveBeenCalledWith('p1');
  });
  it('PHASES パネルは表示専用(useMitigationStore の phases を描画するだけ)', () => {
    useMitigationStore.setState({ phases: [
      { id: 'ph1', name: { ja: '第1フェーズ', en: 'Phase 1' }, startTime: 0, endTime: 100 },
    ] as never });
    const { container } = r();
    expect(container.querySelector('.milspec-phase')).not.toBeNull();
    expect(container.textContent).toMatch(/第1フェーズ|Phase 1/);
  });
  it('【Fix round 1】圧縮プラン選択: loadPlanDataIntoStore の完了まで setCurrentPlanId を呼ばない', async () => {
    // p2 を「data 無し + compressedData あり」の想定(silentCompressStale が archived を
    // 変えずに compressedData 化するケース)にする。
    usePlanStore.setState({ plans: [
      { id: 'p1', title: 'A', contentId: null, data: mkData(), ownerId: 'local' },
      { id: 'p2', title: 'B', contentId: null, data: {}, compressedData: 'FAKE', ownerId: 'local' },
    ] as never, currentPlanId: 'p1' });

    // vi.mock 差し替えは vmThreads プール下で挙動が不安定(vitest.config.ts コメント記載の
    // 既知の mock pollution)なため、実際に import 済みのモジュール名前空間オブジェクトへ
    // 直接 vi.spyOn する(ESM live binding をそのまま書き換える・より確実)。
    let resolveLoad!: (v: unknown) => void;
    const loadSpy = vi.spyOn(planLoadModule, 'loadPlanDataIntoStore').mockReturnValue(
      new Promise((resolve) => { resolveLoad = resolve; }) as never,
    );

    const spy = vi.spyOn(usePlanStore.getState(), 'setCurrentPlanId');
    spy.mockClear();
    const { getByText } = r();
    fireEvent.click(getByText('B'));

    // loadPlanDataIntoStore が解決するまでは currentPlanId を切り替えない
    // (データ破損防止の本丸 — Fix round 1 の核心)。
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(loadSpy).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();

    resolveLoad(mkData());
    await waitFor(() => expect(spy).toHaveBeenCalledWith('p2'));
  });
});
