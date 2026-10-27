// @vitest-environment happy-dom
/**
 * 整頓④(Layout 分割)専用の一時検査: 分割前に Layout が自分で書く HTML と、子部品へ渡す値を
 * 状態ごとに丸ごと記録し、分割後も 1 文字も変わらないことを確かめる。分割完了後に削除する。
 * 子部品は「受け取った値を data-props に書き出す代役」に差し替える(関数は "fn")。
 * 代役は関数の値ごとにボタンを持ち、押すとその関数を呼ぶ(下ナビの排他などを辿るため)。
 */
import React from 'react';
import { render, act, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// t は本物と同じく毎回同じ関数(変わると自動保存の仕掛けが張り直されてしまう)
const { i18nValue } = vi.hoisted(() => ({ i18nValue: { t: (k: string) => k, i18n: { language: 'ja' } } }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18nValue }));

const ser = (props: Record<string, unknown>) => JSON.stringify(props, (_k, v) => {
    if (typeof v === 'function') return 'fn';
    if (v && typeof v === 'object' && '$$typeof' in (v as object)) return 'el';
    return v;
});

function makeStub(name: string) {
    return (props: Record<string, unknown>) => {
        const { children, headerAction, ...rest } = props as { children?: React.ReactNode; headerAction?: React.ReactNode };
        const fnKeys = Object.keys(rest).filter(k => typeof (rest as Record<string, unknown>)[k] === 'function');
        return (
            <div data-stub={name} data-props={ser(rest)}>
                {fnKeys.map(k => (
                    <button key={k} data-call={`${name}.${k}`} onClick={() => (rest as Record<string, () => void>)[k]()} />
                ))}
                {headerAction}
                {children}
            </div>
        );
    };
}

// 動きの指定値(initial/animate/transition)をそのまま data-motion に書き出す(テスト中は動きが進まないため)
vi.mock('framer-motion', () => {
    const cache = new Map<string, React.FC<Record<string, unknown>>>();
    const motion = new Proxy({}, {
        get: (_t, tag: string) => {
            if (!cache.has(tag)) {
                cache.set(tag, ({ initial, animate, transition, children, ...rest }) =>
                    React.createElement(tag, { ...rest, 'data-motion': ser({ initial, animate, transition }) }, children as React.ReactNode));
            }
            return cache.get(tag);
        },
    });
    return { motion };
});
vi.mock('../Sidebar',() => ({ Sidebar: makeStub('Sidebar') }));
vi.mock('../LocalDataSafetyAutoPrompt', () => ({ LocalDataSafetyAutoPrompt: makeStub('LocalDataSafetyAutoPrompt') }));
vi.mock('../ConsolidatedHeader', () => ({ ConsolidatedHeader: makeStub('ConsolidatedHeader') }));
vi.mock('../MobileBottomNav', () => ({ MobileBottomNav: makeStub('MobileBottomNav') }));
vi.mock('../MobileBottomSheet', () => ({ MobileBottomSheet: makeStub('MobileBottomSheet') }));
vi.mock('../collab/MobileShareController', () => ({ MobileShareController: makeStub('MobileShareController') }));
vi.mock('../ui/TransitionOverlay', () => ({ useTransitionOverlay: () => ({ runTransition: (fn: () => void) => fn() }) }));
vi.mock('../AppFooter', () => ({ AppFooter: makeStub('AppFooter') }));
vi.mock('../LoginModal', () => ({ LoginModal: makeStub('LoginModal') }));
vi.mock('../RenderPendingIndicator', () => ({ RenderPendingIndicator: makeStub('RenderPendingIndicator') }));
vi.mock('../SyncButton', () => ({ SyncButton: makeStub('SyncButton') }));
vi.mock('../Toast', () => ({ showToast: vi.fn() }));
vi.mock('../WelcomeSetup', () => ({ WelcomeSetup: makeStub('WelcomeSetup') }));
vi.mock('../MobileHeader', () => ({ MobileHeader: makeStub('MobileHeader') }));
vi.mock('../MobileFab', () => ({ MobileFAB: makeStub('MobileFAB') }));
vi.mock('../GridOverlay', () => ({ GridOverlay: makeStub('GridOverlay') }));
vi.mock('../MobilePartySettings', () => ({
    MobilePartyWithTabs: makeStub('MobilePartyWithTabs'),
    MobileAccountMenu: makeStub('MobileAccountMenu'),
}));
vi.mock('../AetherflowChainPromptModal', () => ({ AetherflowChainPromptModal: makeStub('AetherflowChainPromptModal') }));
vi.mock('../AstrologianDrawChainPromptModal', () => ({ AstrologianDrawChainPromptModal: makeStub('AstrologianDrawChainPromptModal') }));
vi.mock('../LocalImportDialog', () => ({ LocalImportDialog: makeStub('LocalImportDialog') }));
vi.mock('../ShareImportSheet', () => ({ ShareImportSheet: makeStub('ShareImportSheet') }));
vi.mock('../LimitResolutionSheet', () => ({ LimitResolutionSheet: makeStub('LimitResolutionSheet') }));
vi.mock('../dev/MilspecTunePanel', () => ({ MilspecTunePanel: makeStub('MilspecTunePanel') }));
vi.mock('../PipView', () => ({ default: makeStub('PipView') }));
vi.mock('../military/MilspecLayout', () => ({ MilspecLayout: makeStub('MilspecLayout') }));
vi.mock('../../lib/collab/collabLifecycle', () => ({ reconcileCollabForPlan: vi.fn() }));
vi.mock('../../hooks/useIOSViewportFix', () => ({ useIOSViewportFix: vi.fn() }));
let canPreview = false;
vi.mock('../../hooks/useCanPreviewWip', () => ({
    useCanPreviewWip: () => canPreview,
    getCanPreviewWip: () => canPreview,
}));

import { Layout } from '../Layout';
import { MobileTriggersContext } from '../../contexts/MobileTriggersContext';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useThemeStore } from '../../store/useThemeStore';

/** Layout の子に置いて MobileTriggersContext の値を書き出す */
const ContextProbe: React.FC = () => {
    const ctx = React.useContext(MobileTriggersContext);
    return <div data-probe="ctx" data-props={ser(ctx as unknown as Record<string, unknown>)} />;
};

const PLAN = { id: 'p1', ownerId: 'local', ownerDisplayName: 'u', title: 't', contentId: null, isPublic: false, copyCount: 0, useCount: 0, createdAt: 1, updatedAt: 1, _createdLoggedIn: true };

function setWidth(w: number) {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
}

async function mount() {
    const r = render(
        <MemoryRouter>
            <Layout><ContextProbe /></Layout>
        </MemoryRouter>,
    );
    await act(async () => { await Promise.resolve(); });
    return r;
}

const click = (c: HTMLElement, call: string) => {
    const b = c.querySelector(`[data-call="${call}"]`) as HTMLElement | null;
    if (!b) throw new Error(`no button ${call}`);
    fireEvent.click(b);
};

describe('Layout 分割前の記録(一時)', () => {
    beforeEach(() => {
        localStorage.clear();
        canPreview = false;
        setWidth(1489);
        usePlanStore.setState({ plans: [{ ...PLAN, data: useMitigationStore.getState().getSnapshot() }] as never, currentPlanId: 'p1' });
        useMitigationStore.setState({ _loadedPlanId: 'p1', myJobHighlight: false, hideEmptyRows: false });
        useAuthStore.setState({ user: null, loading: false, isNewUser: false, justLoggedInUser: null } as never);
        useTutorialStore.setState({ isActive: false });
        useThemeStore.setState({ theme: 'dark', themeStyle: 'standard' });
    });
    afterEach(() => { setWidth(1024); });

    it('PC 既定', async () => {
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('PC プラン未選択', async () => {
        usePlanStore.setState({ currentPlanId: null });
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('PC キー操作 S → H → F → F', async () => {
        const { container } = await mount();
        const snaps: string[] = [];
        for (const key of ['s', 'h', 'f', 'f']) {
            act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); });
            snaps.push(container.innerHTML);
        }
        expect(snaps).toMatchSnapshot();
        expect(localStorage.getItem('lopo_sidebar_open')).toBe('true');
    });

    it('PC フォーカスモードの出入りイベント', async () => {
        const { container } = await mount();
        act(() => { window.dispatchEvent(new Event('shortcut:enter-focus')); });
        const a = container.innerHTML;
        act(() => { window.dispatchEvent(new Event('shortcut:exit-focus')); });
        expect([a, container.innerHTML]).toMatchSnapshot();
    });

    it('PC 右の帯のボタン(テーマ・ハイライト)', async () => {
        const { container } = await mount();
        act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f' })); });
        const rail = container.querySelectorAll('button');
        const real = Array.from(rail).filter(b => !b.hasAttribute('data-call'));
        real.forEach(b => fireEvent.click(b));
        expect(useMitigationStore.getState().myJobHighlight).toBe(true);
        expect(useThemeStore.getState().theme).toBe('light');
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('PC サイドバーの開閉(代役のボタン経由)', async () => {
        const { container } = await mount();
        click(container, 'Sidebar.onClose');
        const a = container.innerHTML;
        const ls = localStorage.getItem('lopo_sidebar_open');
        click(container, 'Sidebar.onToggle');
        expect([a, ls, container.innerHTML, localStorage.getItem('lopo_sidebar_open')]).toMatchSnapshot();
    });

    it('PC 認証戻り中', async () => {
        localStorage.setItem('lopo_auth_redirecting', 'true');
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('PC 初回ユーザー', async () => {
        useAuthStore.setState({ isNewUser: true } as never);
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('PC チュートリアル中', async () => {
        localStorage.setItem('lopo_sidebar_open', 'false');
        useTutorialStore.setState({ isActive: true });
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('MIL-SPEC PC', async () => {
        canPreview = true;
        localStorage.setItem('lopo_auth_redirecting', 'true');
        useThemeStore.setState({ themeStyle: 'military' });
        const { container } = await mount();
        await waitFor(() => expect(container.querySelector('[data-stub="MilspecLayout"]')).not.toBeNull());
        const before = container.innerHTML;
        click(container, 'MilspecLayout.onCloseSidebar');
        const ls1 = localStorage.getItem('lopo_sidebar_open');
        click(container, 'MilspecLayout.onToggleTheme');
        expect([before, ls1, useThemeStore.getState().theme, container.innerHTML]).toMatchSnapshot();
    });

    it('スマホ 既定', async () => {
        setWidth(390);
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('スマホ プラン未選択', async () => {
        setWidth(390);
        usePlanStore.setState({ currentPlanId: null });
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });

    it('スマホ 下ナビを順に押す(未ログイン)', async () => {
        setWidth(390);
        const { container } = await mount();
        const closeFlow = vi.fn();
        window.addEventListener('mobile:close-miti-flow', closeFlow);
        const snaps: string[] = [];
        for (const call of [
            'MobileBottomNav.onMenuToggle', 'MobileBottomNav.onMenuToggle',
            'MobileBottomNav.onImportToggle', 'MobileBottomNav.onShareToggle',
            'MobileBottomNav.onLoginOpen', 'MobileBottomNav.onCueToggle',
        ]) {
            act(() => click(container, call));
            snaps.push(container.innerHTML);
        }
        window.removeEventListener('mobile:close-miti-flow', closeFlow);
        expect([snaps, closeFlow.mock.calls.length]).toMatchSnapshot();
    });

    it('スマホ 下ナビ アカウント(ログイン済)とシートの閉じる', async () => {
        setWidth(390);
        useAuthStore.setState({ user: { uid: 'u1' } } as never);
        // 取り込み処理が走らないよう済み扱い
        useAuthStore.setState({ loading: true } as never);
        const { container } = await mount();
        const snaps: string[] = [];
        for (const call of [
            'MobileBottomNav.onMenuToggle', 'MobileBottomNav.onLoginOpen',
            'MobileAccountMenu.onClose', 'MobileBottomNav.onLoginOpen', 'MobileBottomNav.onLoginOpen',
        ]) {
            act(() => click(container, call));
            snaps.push(container.innerHTML);
        }
        expect(snaps).toMatchSnapshot();
    });

    it('スマホ メニューのシート内パーティボタンと FAB', async () => {
        setWidth(390);
        const { container } = await mount();
        act(() => click(container, 'MobileBottomNav.onMenuToggle'));
        const partyBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'nav.party')!;
        act(() => { fireEvent.click(partyBtn); });
        const a = container.innerHTML;
        act(() => click(container, 'MobileFAB.onToggleExpand'));
        expect(useMitigationStore.getState().hideEmptyRows).toBe(true);
        expect([a, container.innerHTML]).toMatchSnapshot();
    });

    it('スマホ チュートリアル中', async () => {
        setWidth(390);
        useTutorialStore.setState({ isActive: true });
        const { container } = await mount();
        expect(container.innerHTML).toMatchSnapshot();
    });
});
