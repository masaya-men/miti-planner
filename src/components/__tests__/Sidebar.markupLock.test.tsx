// @vitest-environment happy-dom
/**
 * 【一時検査】Sidebar 分割(整頓④)の前後で「画面の中身」と「外への呼び出し」が1つも変わらないことを固定する。
 * 分割が終わったら削除する(スナップショットごと)。
 */
import { render, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';

const { log } = vi.hoisted(() => ({ log: [] as unknown[] }));
const rec = (name: string, ...args: unknown[]) => { log.push([name, ...args]); };

vi.mock('../../data/templateLoader', () => ({
    getTemplate: async (id: string) => {
        log.push(['getTemplate', id]);
        if (id === 'm3s') return null;
        return {
            timelineEvents: [
                { id: 'e1', time: 10, name: { ja: 'A', en: 'A' }, damageType: 'magical', damageAmount: 1000, target: 'AoE' },
                { id: 'e2', time: 30, name: { ja: 'B', en: 'B' }, damageType: 'physical', damageAmount: 2000, target: 'MT' },
            ],
            phases: [{ id: 1, name: { ja: 'P1', en: 'P1' }, startTimeSec: 0 }],
            labels: [{ name: { ja: 'L', en: 'L' }, startTimeSec: 5 }],
        };
    },
}));
vi.mock('../Toast', () => ({ showToast: (...a: unknown[]) => rec('showToast', ...a) }));
vi.mock('../../lib/commitNewPlan', () => ({ commitNewPlan: (p: unknown) => rec('commitNewPlan', p) }));
vi.mock('../../utils/lastOpenedStore', () => ({
    setLastOpened: (...a: unknown[]) => rec('setLastOpened', ...a),
    getLastOpenedMap: () => ({}),
    getStalePlanIds: () => [],
    LAST_OPENED_KEY: 'plan-last-opened',
}));
vi.mock('../../utils/compression', async (orig) => {
    const actual = await orig<typeof import('../../utils/compression')>();
    return {
        ...actual,
        decompressPlanData: async (c: string) => {
            log.push(['decompress', c]);
            if (c === 'bad') throw new Error('x');
            return { currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [], partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {} };
        },
    };
});
vi.mock('../ui/TransitionOverlay', () => ({
    useTransitionOverlay: () => ({ runTransition: async (fn: () => Promise<void> | void, kind?: string) => { rec('runTransition', kind); await fn(); } }),
}));

import { Sidebar } from '../Sidebar';
import i18n from '../../i18n';
import { usePlanStore } from '../../store/usePlanStore';
import { useMitigationStore } from '../../store/useMitigationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useTutorialStore } from '../../store/useTutorialStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useCollabSessionStore } from '../../store/useCollabSessionStore';
import { PLAN_LIMITS } from '../../types/firebase';

const mkData = () => ({
    currentLevel: 100, timelineEvents: [], timelineMitigations: [], phases: [], labels: [],
    partyMembers: [], aaSettings: { damage: 0, type: 'physical', target: 'MT' }, schAetherflowPatterns: {},
});
const mkPlan = (id: string, title: string, contentId: string | null, extra: Record<string, unknown> = {}) => ({
    id, title, contentId, data: mkData(), ownerId: 'local', ownerDisplayName: 'Guest', isPublic: false,
    copyCount: 0, useCount: 0, createdAt: 1000, updatedAt: 1000, ...extra,
});

/** 値の中の作業データ(スナップショット)は大きいので件数だけにして記録する */
const summ = (v: unknown) => JSON.parse(JSON.stringify(v ?? null, (_k, val) => {
    if (val && typeof val === 'object' && 'timelineEvents' in val) {
        const o = val as Record<string, unknown[]>;
        return { _snap: true, events: o.timelineEvents?.length, mitis: o.timelineMitigations?.length, phases: o.phases?.length, labels: o.labels?.length, memos: o.memos?.length, level: (val as { currentLevel?: number }).currentLevel };
    }
    return val;
}));

const norm = (s: string) => s.replace(/:r[0-9a-z]+:/g, ':rX:').replace(/(aria-controls|aria-labelledby|id|for)="(radix-)?[^"]*:r[^"]*"/g, '$1="X"');
const html = () => norm(document.body.innerHTML);
const snap = () => {
    expect(html()).toMatchSnapshot('html');
    expect(summ([...log])).toMatchSnapshot('calls');
};
const flush = async (ms = 1000) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const click = (el: Element | null | undefined) => { if (!el) throw new Error('要素なし'); fireEvent.click(el); };
const btnText = (txt: string, root: ParentNode = document.body) =>
    Array.from(root.querySelectorAll('button')).find(b => (b.textContent ?? '').trim() === txt) as HTMLButtonElement;
const tab = (key: string) => btnText(i18n.t(`sidebar.tab_${key}`).toUpperCase());
const toolbar = (key: string) => btnText(i18n.t(key).toUpperCase());
const planBtn = (title: string) => Array.from(document.body.querySelectorAll('button, [role="button"]')).find(b => (b.textContent ?? '').includes(title)) as HTMLButtonElement;
const floatDelete = () => Array.from(document.body.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-trash2') && (b.textContent ?? '').trim() === i18n.t('sidebar.delete'));
const contentRow = (id: string) => document.body.querySelector(`[data-content-id="${id}"]`) as HTMLElement;
const contentBtn = (id: string) => contentRow(id).querySelector('button.sidebar-item') as HTMLButtonElement;

const baseProps = { isOpen: true, onToggle: () => rec('onToggle'), onClose: () => rec('onClose'), onAutoPlan: () => rec('onAutoPlan') };
const mount = (props: Partial<React.ComponentProps<typeof Sidebar>> = {}) =>
    render(<MemoryRouter><Sidebar {...baseProps} {...props} /></MemoryRouter>);

const setPlans = (plans: unknown[], currentPlanId: string | null = null) => {
    usePlanStore.setState({ plans: plans as never, currentPlanId });
};

let uuid = 0;
const origSetItem = Storage.prototype.setItem;

beforeEach(() => {
    log.length = 0;
    uuid = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++uuid}` as never);
    vi.stubGlobal('alert', (m?: string) => { rec('alert', m); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k: string, v: string) {
        rec('localStorage.setItem', k);
        origSetItem.call(this, k, v);
    });
    window.addEventListener('sidebar:start-rename', ((e: CustomEvent) => rec('event:sidebar:start-rename', e.detail)) as EventListener);
    localStorage.clear();
    sessionStorage.clear();
    i18n.changeLanguage('ja');
    useThemeStore.setState({ contentLanguage: 'ja' });
    useMitigationStore.setState(useMitigationStore.getInitialState(), true);
    const m = useMitigationStore.getState();
    useMitigationStore.setState({
        loadSnapshot: (...a: Parameters<typeof m.loadSnapshot>) => { rec('loadSnapshot', a[0], a[1]); return m.loadSnapshot(...a); },
        setCurrentLevel: (...a: Parameters<typeof m.setCurrentLevel>) => { rec('setCurrentLevel', a[0]); return m.setCurrentLevel(...a); },
    } as never);
    usePlanStore.setState({
        plans: [], currentPlanId: null,
        updatePlan: (...a: unknown[]) => { rec('updatePlan', ...a); },
        archivePlans: async (ids: string[]) => { rec('archivePlans', ids); },
        archivePlan: async (id: string) => { rec('archivePlan', id); },
        setCurrentPlanId: (id: string | null) => { rec('setCurrentPlanId', id); usePlanStore.setState({ currentPlanId: id }); },
        deletePlan: (id: string) => { rec('deletePlan', id); },
        deleteFromFirestore: async (...a: unknown[]) => { rec('deleteFromFirestore', ...a); },
        duplicatePlan: async (id: string) => { rec('duplicatePlan', id); return null; },
    } as never);
    useAuthStore.setState({ user: null, loading: false, isNewUser: false } as never);
    useTutorialStore.setState({
        isActive: false, activeTutorialId: null, currentStep: 0, currentStepIndex: 0,
        completed: { 'create-plan': true, main: true }, hasCompleted: true,
        completeEvent: (e: string) => { rec('completeEvent', e); },
    } as never);
    useCollabSessionStore.setState({ disconnect: () => { rec('disconnect'); } } as never);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
afterAll(() => { vi.useRealTimers(); });

const withPlans = () => setPlans([
    mkPlan('s1', '零式A', 'm1s'), mkPlan('s2', '零式B', 'm1s'),
    mkPlan('u1', '絶A', 'fru'),
    mkPlan('c1', '自由A', null, { category: 'custom' }),
    mkPlan('a1', '古A', 'p9s', { archived: true, level: 90, category: 'savage' }),
], 's1');

describe('Sidebar markupLock', () => {
    it('PCで開いている(プランなし)', () => { mount(); snap(); });
    it('PCで閉じている', () => { mount({ isOpen: false }); snap(); });
    it('PCで閉じている(プランあり・通知とバックアップ案内)', () => { withPlans(); mount({ isOpen: false }); snap(); });
    it('fullWidth(スマホ)+自動組み立て', () => {
        mount({ fullWidth: true });
        snap();
        click(btnText(i18n.t('mitigation.auto_plan_short').toUpperCase()));
        snap();
    });

    for (const [name, withP] of [['プランなし', false], ['プランあり', true]] as const) {
        for (const key of ['savage', 'ultimate', 'other', 'archive']) {
            it(`タブ ${key} (${name})`, () => {
                if (withP) withPlans();
                mount();
                click(tab(key));
                snap();
            });
        }
    }

    it('コンテンツの展開・折りたたみ', () => {
        withPlans(); mount();
        snap();
        click(contentBtn('m1s'));
        snap();
        click(contentBtn('m1s'));
        snap();
    });

    it('NEW PLAN ボタンでモーダル', async () => {
        mount();
        click(toolbar('sidebar.new_plan'));
        await flush(50);
        snap();
    });

    it('BACKUP / RESTORE ボタン', async () => {
        mount();
        click(document.body.querySelector('button svg.lucide-hard-drive')!.closest('button'));
        await flush(50);
        snap();
    });

    it('プランなしコンテンツ→名前入力→Enterで作成', async () => {
        withPlans(); mount();
        click(contentBtn('m2s'));
        snap();
        const input = document.body.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '新規プラン' } });
        snap();
        fireEvent.keyDown(input, { key: 'Enter' });
        await flush(1000);
        snap();
    });

    it('名前入力→作成(スマホは閉じる)・テンプレートなし', async () => {
        mount({ fullWidth: true });
        click(contentBtn('m3s'));
        const input = document.body.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.keyDown(input, { key: 'Enter' });
        await flush(1000);
        snap();
    });

    it('名前入力→Escで中止 / 空名はEnterしても作らない', async () => {
        mount(); click(contentBtn('m2s'));
        const input = document.body.querySelector('input[type="text"]') as HTMLInputElement;
        fireEvent.change(input, { target: { value: '   ' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        snap();
        fireEvent.keyDown(input, { key: 'Escape' });
        await flush(100);
        snap();
    });

    it('名前入力ダイアログのキャンセルボタン(ログイン済み)', async () => {
        useAuthStore.setState({ user: { uid: 'u' } } as never);
        mount(); click(contentBtn('m2s'));
        snap();
        click(btnText(i18n.t('common.cancel')));
        snap();
    });

    it('名前入力ダイアログから未ログイン案内→ログインモーダル', async () => {
        mount(); click(contentBtn('m2s'));
        const hint = document.body.querySelector('p button') as HTMLButtonElement;
        click(hint);
        await flush(50);
        snap();
    });

    it('+ボタンで同コンテンツに追加作成', async () => {
        withPlans(); mount();
        const plus = Array.from(contentRow('m1s').querySelectorAll('button')).find(b => b.querySelector('svg.lucide-plus')) as HTMLButtonElement;
        click(plus);
        snap();
    });

    it('件数上限(全体)で alert', () => {
        setPlans(Array.from({ length: PLAN_LIMITS.MAX_TOTAL_PLANS }, (_, i) => mkPlan(`x${i}`, `P${i}`, 'm1s')), 'x0');
        mount();
        const plus = Array.from(contentRow('m2s').querySelectorAll('button')).find(b => b.querySelector('svg.lucide-plus')) as HTMLButtonElement;
        click(plus);
        snap();
    });

    it('件数上限(コンテンツ別)で alert', () => {
        setPlans(Array.from({ length: PLAN_LIMITS.MAX_PLANS_PER_CONTENT }, (_, i) => mkPlan(`x${i}`, `P${i}`, 'm1s')), 'x0');
        mount();
        const plus = Array.from(contentRow('m1s').querySelectorAll('button')).find(b => b.querySelector('svg.lucide-plus')) as HTMLButtonElement;
        click(plus);
        snap();
    });

    it('既存プランをクリックで切替', async () => {
        withPlans(); mount();
        click(planBtn('零式B'));
        await flush(100);
        snap();
    });

    it('その他タブの自由プランをクリックで切替(handleLoadPlan)', async () => {
        setPlans([mkPlan('c1', '自由A', null, { category: 'custom', archived: false }), mkPlan('c2', '自由B', null, { category: 'custom', data: {}, compressedData: 'ok' }), mkPlan('c3', '自由C', null, { category: 'custom', data: {}, compressedData: 'bad' })], 'c1');
        mount(); click(tab('other'));
        click(planBtn('自由B')); await flush(100); snap();
        click(planBtn('自由C')); await flush(100); snap();
    });
    it('その他タブの自由プラン切替: 現在がアーカイブ済み', async () => {
        setPlans([mkPlan('c1', '自由A', null, { category: 'custom', compressedData: 'q' }), mkPlan('c2', '自由B', null, { category: 'custom' })], 'c1');
        mount(); click(tab('other'));
        click(planBtn('自由B')); await flush(100); snap();
    });

    it('切替: 現在プランがアーカイブ済みなら再圧縮', async () => {
        setPlans([mkPlan('s1', '零式A', 'm1s', { archived: true }), mkPlan('s2', '零式B', 'm1s')], 's1');
        mount();
        click(planBtn('零式B'));
        await flush(100);
        snap();
    });

    it('切替: 圧縮済みの解凍成功', async () => {
        setPlans([mkPlan('s1', '零式A', 'm1s'), mkPlan('s2', '零式B', 'm1s', { data: {}, compressedData: 'ok' })], 's1');
        mount();
        click(planBtn('零式B'));
        await flush(100);
        snap();
    });

    it('切替: 圧縮済みの解凍失敗', async () => {
        setPlans([mkPlan('s1', '零式A', 'm1s'), mkPlan('u2', '絶B', 'fru', { data: {}, compressedData: 'bad' })], 's1');
        mount(); click(tab('ultimate'));
        click(planBtn('絶B'));
        await flush(100);
        snap();
    });

    it('共有の複数選択→2件→フローティングバー→キャンセル', async () => {
        withPlans(); mount();
        click(toolbar('sidebar.multi_select_mode'));
        snap();
        click(planBtn('零式A'));
        click(planBtn('零式B'));
        await flush(500);
        snap();
        click(btnText(i18n.t('sidebar.cancel')));
        snap();
    });

    it('共有の複数選択→共有を押す', async () => {
        withPlans(); mount();
        click(toolbar('sidebar.multi_select_mode'));
        click(planBtn('零式A'));
        click(btnText(i18n.t('sidebar.share_together')) ?? Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.includes(i18n.t('sidebar.share_together'))));
        await flush(200);
        snap();
    });

    it('共有の上限10件', async () => {
        setPlans(Array.from({ length: 11 }, (_, i) => mkPlan(`x${i}`, `Q${i}`, 'm1s')), 'x0');
        mount();
        click(toolbar('sidebar.multi_select_mode'));
        for (let i = 0; i < 11; i++) click(planBtn(`Q${i}`));
        await flush(500);
        snap();
    });

    it('削除の複数選択→削除確認→削除', async () => {
        withPlans(); mount();
        click(toolbar('sidebar.select_delete'));
        click(planBtn('零式A'));
        click(planBtn('零式B'));
        await flush(500);
        snap();
        click(floatDelete());
        snap();
        const confirmBtn = Array.from(document.body.querySelectorAll('button')).filter(b => (b.textContent ?? '').trim() === i18n.t('sidebar.delete')).pop();
        click(confirmBtn);
        await flush(100);
        snap();
    });

    it('削除確認→やめる / ×', async () => {
        withPlans(); mount();
        click(toolbar('sidebar.select_delete'));
        click(planBtn('零式A'));
        click(floatDelete());
        click(Array.from(document.body.querySelectorAll('button')).filter(b => (b.textContent ?? '').trim() === i18n.t('common.cancel')).pop());
        snap();
        click(floatDelete());
        click(document.body.querySelector('button svg.lucide-x')!.closest('button'));
        snap();
    });

    for (const item of ['context_share', 'context_duplicate', 'context_rename', 'context_delete']) {
        it(`右クリックメニュー→${item}`, async () => {
            withPlans(); mount();
            fireEvent.contextMenu(planBtn('零式A'), { clientX: 120, clientY: 240 });
            if (item === 'context_share') snap();
            click(btnText(i18n.t(`sidebar.${item}`)) ?? Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.includes(i18n.t(`sidebar.${item}`))));
            await flush(200);
            snap();
        });
    }

    it('右クリックメニュー(ログイン中の削除)', async () => {
        useAuthStore.setState({ user: { uid: 'u1' } } as never);
        withPlans(); mount();
        fireEvent.contextMenu(planBtn('零式A'), { clientX: 10, clientY: 20 });
        click(Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.includes(i18n.t('sidebar.context_delete'))));
        await flush(100);
        snap();
    });

    it('右クリックメニュー(圧縮済みの共有・解凍失敗)', async () => {
        setPlans([mkPlan('z1', '圧縮A', 'fru', { data: {}, compressedData: 'bad' })], null);
        mount(); click(tab('ultimate'));
        fireEvent.contextMenu(planBtn('圧縮A'), { clientX: 10, clientY: 20 });
        click(Array.from(document.body.querySelectorAll('button')).find(b => b.textContent?.includes(i18n.t('sidebar.context_share'))));
        await flush(100);
        snap();
    });

    it('チュートリアル中(main-1-content のハイライト)', async () => {
        useTutorialStore.setState({ isActive: true, activeTutorialId: 'main', currentStep: 0, currentStepIndex: 0 } as never);
        mount();
        await flush(50);
        snap();
        click(contentBtn('m1s'));
        await flush(1000);
        snap();
    });

    it('チュートリアル中(ステップ3以降はハンドル固定ライン)', async () => {
        useTutorialStore.setState({ isActive: true, activeTutorialId: 'main', currentStep: 1, currentStepIndex: 1 } as never);
        mount(); await flush(50); snap();
    });

    it('チュートリアルの戻る・復帰イベント', async () => {
        withPlans(); mount();
        click(toolbar('sidebar.new_plan'));
        await flush(50);
        act(() => { window.dispatchEvent(new CustomEvent('tutorial:close-new-plan-modal')); });
        snap();
        act(() => { window.dispatchEvent(new CustomEvent('tutorial:plan-restored', { detail: { contentId: 'fru' } })); });
        snap();
    });

    it('過去拡張の零式プラン→自動アーカイブ→通知の窓', async () => {
        setPlans([mkPlan('o1', '旧零式', 'p9s', { category: 'savage', level: 90 }), mkPlan('s1', '零式A', 'm1s')], 's1');
        mount();
        await flush(200);
        snap();
    });

    it('自動アーカイブ済みフラグがあれば何もしない', async () => {
        setPlans([mkPlan('o1', '旧零式', 'p9s', { category: 'savage', level: 90 })], null);
        localStorage.setItem('archive-auto-done-100', 'true');
        log.length = 0;
        mount();
        await flush(200);
        snap();
    });

    it('currentPlanId が切り替わるとタブが追従する', async () => {
        withPlans(); mount();
        click(tab('archive'));
        act(() => { usePlanStore.setState({ currentPlanId: 'u1' }); });
        snap();
    });

    it('ハンドルのホバー・トグル', async () => {
        mount();
        const handle = document.body.querySelector('div.w-6 button') as HTMLButtonElement;
        fireEvent.mouseEnter(handle);
        await flush(50);
        snap();
        click(handle);
        fireEvent.mouseLeave(handle);
        await flush(50);
        snap();
    });

    it('その他タブの自由プラン見出し(複数カテゴリ)', () => {
        setPlans([
            mkPlan('c1', '自由A', null, { category: 'custom' }),
            mkPlan('d1', 'ダンジョンA', 'zzz', { category: 'dungeon' }),
            mkPlan('r1', 'レイドA', 'zzz', { category: 'raid' }),
            mkPlan('c2', '行き場なし', 'unknown_content'),
        ], 'c1');
        mount();
        click(tab('other'));
        snap();
    });

    it('アーカイブタブ(複数レベル・カテゴリの並び)', () => {
        setPlans([
            mkPlan('a1', '古B', 'p9s', { archived: true, level: 100, category: 'custom' }),
            mkPlan('a2', '古C', 'p9s', { archived: true, level: 90, category: 'ultimate' }),
            mkPlan('a3', '古D', 'p9s', { archived: true, level: 90, category: 'savage' }),
        ], 'a1');
        mount();
        click(tab('archive'));
        snap();
    });
});
