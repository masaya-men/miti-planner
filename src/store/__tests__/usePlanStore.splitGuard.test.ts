// @vitest-environment happy-dom
/**
 * 一時検査(usePlanStore 分割用・分割後に削除する)。
 * 1 本の筋書きで PlanState の全関数を順に呼び、各操作後の state と
 * モック呼び出し記録を snapshot に残す。分割の前後で完全一致することを確認する。
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

const h = vi.hoisted(() => {
    const calls: unknown[] = [];
    const cfg = {
        syncDirty: { deletedRemotely: [] as string[], conflicted: [] as unknown[] },
        fetchAndMerge: { merged: [] as unknown[], changed: false },
        migrate: { merged: [] as unknown[], dirtyIds: [] as string[] },
        existsIds: new Set<string>(),
        createFailIds: new Set<string>(),
        deleteFail: false,
    };
    return { calls, cfg };
});

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
    getAuth: vi.fn(() => ({})),
    onAuthStateChanged: vi.fn(() => () => undefined),
}));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }));
vi.mock('firebase/analytics', () => ({
    getAnalytics: vi.fn(() => ({})),
    isSupported: vi.fn(() => Promise.resolve(false)),
}));
vi.mock('firebase/firestore', () => ({
    initializeFirestore: vi.fn(() => ({})),
    persistentLocalCache: vi.fn(() => ({})),
    persistentMultipleTabManager: vi.fn(() => ({})),
    getFirestore: vi.fn(() => ({})),
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({ id: 'mock-doc' })),
    getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
    getDocs: vi.fn(async () => ({ docs: [] })),
    setDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    deleteDoc: vi.fn(async () => undefined),
    query: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    writeBatch: vi.fn(() => ({ set: vi.fn(), update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => undefined) })),
}));
vi.mock('firebase/app-check', () => ({
    initializeAppCheck: vi.fn(() => ({})),
    ReCaptchaEnterpriseProvider: vi.fn(),
    getToken: vi.fn(async () => {
        h.calls.push(['appCheck.getToken']);
        return { token: 'mock-token' };
    }),
}));
vi.mock('../../lib/firebase', () => ({
    auth: {
        currentUser: {
            uid: 'u1',
            getIdToken: async () => {
                h.calls.push(['auth.getIdToken']);
                return 't';
            },
        },
    },
    db: {},
    storage: {},
    ensureAppCheck: () => ({}),
    getActiveAppCheck: () => null,
}));
vi.mock('../../lib/appCheck', () => ({
    createLazyAppCheck: () => ({ ensureAppCheck: () => null, getActiveAppCheck: () => null }),
}));
vi.mock('../../components/Toast', () => ({
    showToast: (...a: unknown[]) => {
        h.calls.push(['showToast', ...a]);
    },
}));
vi.mock('i18next', () => ({
    default: { t: (k: string) => `t:${k}` },
}));
vi.mock('../../utils/compression', () => ({
    compressPlanData: async (d: unknown) => {
        h.calls.push(['compressPlanData']);
        return `Z:${JSON.stringify(d)}`;
    },
    decompressPlanData: async (c: string) => {
        h.calls.push(['decompressPlanData']);
        return JSON.parse(c.slice(2));
    },
}));
vi.mock('../../data/templateLoader', () => ({
    getTemplate: async (id: string) => {
        h.calls.push(['getTemplate', id]);
        if (id === 'noTpl') return null;
        return {
            timelineEvents: [{ id: 'te1', time: 5 }, { id: 'te2', time: 30 }],
            phases: [
                { id: 'p1', name: { ja: 'フェーズ1', en: 'P1', zh: '阶段1' }, startTimeSec: 0 },
                { id: 'p2', name: 'plain', startTimeSec: 20 },
                { id: 'neg', name: 'neg', startTimeSec: -1 },
            ],
            labels: [{ name: 'L1', startTimeSec: 1, endTimeSec: 9 }, { name: 'L2', startTimeSec: 12 }],
        };
    },
}));
vi.mock('../../lib/planService', () => {
    const rec = (name: string) => (...args: unknown[]) => {
        h.calls.push([`planService.${name}`, ...args]);
    };
    return {
        planService: {
            createPlan: async (...args: unknown[]) => {
                rec('createPlan')(...args);
                const p = args[0] as { id: string };
                if (h.cfg.createFailIds.has(p.id)) throw new Error('create-failed');
            },
            updatePlan: async (...a: unknown[]) => rec('updatePlan')(...a),
            deletePlan: async (...a: unknown[]) => {
                rec('deletePlan')(...a);
                if (h.cfg.deleteFail) throw new Error('permissions denied');
            },
            fetchUserPlans: async (...a: unknown[]) => {
                rec('fetchUserPlans')(...a);
                return [];
            },
            syncDirtyPlans: async (...a: unknown[]) => {
                rec('syncDirtyPlans')(...a);
                return h.cfg.syncDirty;
            },
            fetchAndMerge: async (...a: unknown[]) => {
                rec('fetchAndMerge')(...a);
                return h.cfg.fetchAndMerge;
            },
            checkPlanLimits: async (...a: unknown[]) => rec('checkPlanLimits')(...a),
            checkPlanExists: async (id: string) => {
                rec('checkPlanExists')(id);
                return h.cfg.existsIds.has(id);
            },
            ensurePlanCounts: async (...a: unknown[]) => rec('ensurePlanCounts')(...a),
            repairPlanCounts: async (...a: unknown[]) => rec('repairPlanCounts')(...a),
            migrateLocalPlansToFirestore: async (...a: unknown[]) => {
                rec('migrateLocalPlansToFirestore')(...a);
                return h.cfg.migrate;
            },
        },
    };
});

import { usePlanStore } from '../usePlanStore';
import { useMitigationStore } from '../useMitigationStore';
import { setLastOpened } from '../../utils/lastOpenedStore';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function norm(v: unknown): unknown {
    if (v instanceof Set) return { __set: [...v].map(norm) };
    if (typeof v === 'function') return '[fn]';
    if (v === undefined) return '[undef]';
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === 'object') {
        const o: Record<string, unknown> = {};
        for (const k of Object.keys(v as object)) o[k] = norm((v as Record<string, unknown>)[k]);
        return o;
    }
    return v;
}

function stateNoFns(): unknown {
    const s = usePlanStore.getState() as unknown as Record<string, unknown>;
    const o: Record<string, unknown> = {};
    for (const k of Object.keys(s).sort()) {
        if (typeof s[k] !== 'function') o[k] = norm(s[k]);
    }
    return o;
}

const ne = { timelineEvents: [{ id: 'e1', time: 10 }], timelineMitigations: [], partyMembers: [], phases: [] } as any;
const empty = { timelineEvents: [], timelineMitigations: [], partyMembers: [], phases: [] } as any;

function mk(id: string, over: Record<string, unknown> = {}): any {
    return {
        id,
        ownerId: 'local',
        ownerDisplayName: 'Guest',
        contentId: 'c1',
        title: `T_${id}`,
        data: ne,
        isPublic: false,
        copyCount: 0,
        useCount: 0,
        createdAt: 1,
        updatedAt: 2,
        ...over,
    };
}

describe('usePlanStore splitGuard', () => {
    const records: unknown[] = [];
    let uuid = 0;

    async function step(name: string, fn: () => unknown | Promise<unknown>) {
        h.calls.length = 0;
        const logs: unknown[] = [];
        const origErr = console.error;
        const origWarn = console.warn;
        console.error = (...a: unknown[]) => { logs.push(['error', ...a.map(x => (x instanceof Error ? x.message : x))]); };
        console.warn = (...a: unknown[]) => { logs.push(['warn', ...a]); };
        let ret: unknown;
        let thrown: unknown;
        try {
            ret = await fn();
        } catch (e) {
            thrown = e instanceof Error ? e.message : String(e);
        }
        console.error = origErr;
        console.warn = origWarn;
        records.push(norm({ step: name, ret, thrown, calls: [...h.calls], logs, state: stateNoFns() }));
    }

    beforeAll(() => {
        vi.spyOn(Date, 'now').mockImplementation(() => NOW);
        vi.spyOn(Math, 'random').mockImplementation(() => 0.5);
        vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `uuid-${++uuid}` as `${string}-${string}-${string}-${string}-${string}`);
        localStorage.clear();
        useMitigationStore.setState({
            resetForTutorial: (...a: unknown[]) => { h.calls.push(['mit.resetForTutorial', ...a]); },
            loadSnapshot: (...a: unknown[]) => { h.calls.push(['mit.loadSnapshot', ...a]); },
        } as any);
    });

    it('全操作の前後記録', async () => {
        const s = () => usePlanStore.getState();
        const tpl: any = {
            timelineEvents: [{ id: 'x', time: 3 }, { id: 'y', time: 99 }],
            phases: [{ id: 'q', name: { ja: 'あ', en: 'a', ko: '아', 'zh-Hant': '阿' }, startTimeSec: 2 }, { id: 'r', name: 'str', startTimeSec: 3 }],
            labels: [{ name: 'LL', startTimeSec: 4, endTimeSec: 8 }],
        };

        await step('addPlan local', () => s().addPlan(mk('a1')));
        await step('addPlan ownerId empty', () => s().addPlan(mk('a2', { ownerId: '' })));
        await step('addPlan uid owner', () => s().addPlan(mk('a3', { ownerId: 'u1', contentId: 'noTpl' })));
        await step('addPlan explicit flag', () => s().addPlan(mk('a4', { _createdLoggedIn: false, contentId: 'c2' })));
        await step('updatePlan normal', () => s().updatePlan('a1', { title: 'renamed', data: { ...ne, timelineEvents: [{ id: 'e1', time: 11 }] } }));
        await step('updatePlan empty-overwrite guard (only data)', () => s().updatePlan('a1', { data: empty }));
        await step('updatePlan empty-overwrite guard (with title)', () => s().updatePlan('a1', { data: empty, title: 'keepTitle' }));
        await step('createPlanFromTemplate', () => s().createPlanFromTemplate('cT', tpl, 'tplTitle', ne));
        await step('createPlanFromTemplate no phases/labels', () =>
            s().createPlanFromTemplate('cT2', { timelineEvents: [] } as any, 'tpl2', ne));
        await step('duplicatePlan normal', () => s().duplicatePlan('a1'));
        await step('duplicatePlan noTpl', () => s().duplicatePlan('a3'));
        await step('duplicatePlan missing', () => s().duplicatePlan('nope'));
        await step('archivePlan', () => s().archivePlan('a2'));
        await step('archivePlan again (no-op)', () => s().archivePlan('a2'));
        await step('duplicatePlan archived (decompress)', () => s().duplicatePlan('a2'));
        await step('decompressArchivedPlan archived', async () => (await s().decompressArchivedPlan('a2'))?.timelineEvents);
        await step('decompressArchivedPlan live', async () => (await s().decompressArchivedPlan('a1'))?.timelineEvents);
        await step('decompressArchivedPlan missing', () => s().decompressArchivedPlan('zzz'));
        await step('archivePlans', () => s().archivePlans(['a4']));
        await step('markDirty', () => s().markDirty('a1'));
        await step('hasDirtyPlans', () => s().hasDirtyPlans());
        // duplicatePlan 上限(件数)
        const savedPlans = s().plans;
        await step('duplicatePlan limit total', async () => {
            const many = Array.from({ length: 50 }, (_, i) => mk(`m${i}`, { contentId: `cc${i}` }));
            usePlanStore.setState({ plans: many });
            const r = await s().duplicatePlan('m0');
            usePlanStore.setState({ plans: savedPlans });
            return r;
        });
        await step('duplicatePlan limit per content', async () => {
            const many = Array.from({ length: 5 }, (_, i) => mk(`k${i}`, { contentId: 'same' }));
            usePlanStore.setState({ plans: many });
            const r = await s().duplicatePlan('k0');
            usePlanStore.setState({ plans: savedPlans });
            return r;
        });
        await step('duplicatePlan decompress fail -> null', async () => {
            usePlanStore.setState({ plans: [mk('nd', { data: undefined })] });
            const r = await s().duplicatePlan('nd');
            usePlanStore.setState({ plans: savedPlans });
            return r;
        });

        // sync 系
        await step('syncToFirestore skip (not dirty)', async () => {
            usePlanStore.setState({ _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
            await s().syncToFirestore('u1', 'U');
        });
        await step('syncToFirestore deletedRemotely toast', async () => {
            h.cfg.syncDirty = { deletedRemotely: ['a3'], conflicted: [] };
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1', 'a3']), _deletedPlanIds: new Set(['gone1']), _isSyncing: false, _lastSyncAt: 0 });
            await s().syncToFirestore('u1', 'U', true);
        });
        await step('syncToFirestore conflicted toast', async () => {
            h.cfg.syncDirty = { deletedRemotely: [], conflicted: [mk('a1', { title: 'confl', activeCollabRoomToken: 'tok', collabMaxParticipants: 3 })] };
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1']), _deletedPlanIds: new Set(), _isSyncing: false });
            await s().syncToFirestore('u1', 'U', true);
        });
        await step('syncToFirestore cooldown skip', async () => {
            h.cfg.syncDirty = { deletedRemotely: [], conflicted: [] };
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1']), _isSyncing: false, _lastSyncAt: NOW - 1000 });
            usePlanStore.setState({ plans: s().plans.map(p => (p.id === 'a1' ? { ...p, updatedAt: 1 } : p)) });
            await s().syncToFirestore('u1', 'U');
        });
        await step('syncToFirestore onlyPlanIds + delete error', async () => {
            h.cfg.deleteFail = true;
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1', 'a4']), _deletedPlanIds: new Set(['d1', 'd2']), _isSyncing: false, _lastSyncAt: 0 });
            await s().syncToFirestore('u1', 'U', true, ['a1', 'd1']);
            h.cfg.deleteFail = false;
        });
        await step('syncToFirestore throws -> error status', async () => {
            const orig = h.cfg.syncDirty;
            h.cfg.syncDirty = null as any;
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1']), _deletedPlanIds: new Set(), _isSyncing: false });
            await s().syncToFirestore('u1', 'U', true);
            h.cfg.syncDirty = orig;
        });
        await step('forceSyncAll', async () => {
            h.cfg.deleteFail = true;
            usePlanStore.setState({ _dirtyPlanIds: new Set(['a1']), _deletedPlanIds: new Set(['dz']), _isSyncing: false });
            await s().forceSyncAll('u1', 'U');
            h.cfg.deleteFail = false;
        });
        await step('pullFromFirestore isSyncing skip', async () => {
            usePlanStore.setState({ _isSyncing: true });
            await s().pullFromFirestore('u1');
            usePlanStore.setState({ _isSyncing: false });
        });
        await step('pullFromFirestore changed, current updated', async () => {
            const cur = s().plans.find(p => p.id === 'a1')!;
            s().setCurrentPlanId('a1');
            h.cfg.fetchAndMerge = {
                merged: s().plans.map(p => (p.id === 'a1' ? { ...cur, updatedAt: cur.updatedAt + 5, title: 'remote' } : p)),
                changed: true,
            };
            await s().pullFromFirestore('u1');
        });
        await step('pullFromFirestore changed, current removed', async () => {
            h.cfg.fetchAndMerge = { merged: s().plans.filter(p => p.id !== 'a1'), changed: true };
            await s().pullFromFirestore('u1');
        });
        await step('pullFromFirestore error', async () => {
            h.cfg.fetchAndMerge = null as any;
            await s().pullFromFirestore('u1');
            h.cfg.fetchAndMerge = { merged: [], changed: false };
        });
        await step('manualSync conflicted + deletedRemotely + pull changed', async () => {
            const p0 = s().plans[0];
            s().setCurrentPlanId(p0.id);
            h.cfg.syncDirty = { deletedRemotely: ['a4'], conflicted: [mk('cf', { title: 'cf-title', activeCollabRoomToken: 'z' })] };
            h.cfg.fetchAndMerge = {
                merged: s().plans.map(p => (p.id === p0.id ? { ...p, updatedAt: p.updatedAt + 9 } : p)),
                changed: true,
            };
            usePlanStore.setState({ _dirtyPlanIds: new Set([p0.id]), _deletedPlanIds: new Set(['dm']), _isSyncing: false });
            await s().manualSync('u1', 'U');
        });
        await step('manualSync isSyncing skip', async () => {
            usePlanStore.setState({ _isSyncing: true });
            await s().manualSync('u1', 'U');
            usePlanStore.setState({ _isSyncing: false });
        });
        await step('manualSync no dirty, current removed', async () => {
            h.cfg.syncDirty = { deletedRemotely: [], conflicted: [] };
            usePlanStore.setState({ _dirtyPlanIds: new Set(), _deletedPlanIds: new Set() });
            s().setCurrentPlanId(s().plans[0].id);
            h.cfg.fetchAndMerge = { merged: s().plans.slice(1), changed: true };
            await s().manualSync('u1', 'U');
        });
        await step('manualSync error rethrow', async () => {
            h.cfg.fetchAndMerge = null as any;
            usePlanStore.setState({ _isSyncing: false });
            await s().manualSync('u1', 'U');
        });
        h.cfg.fetchAndMerge = { merged: [], changed: false };

        // login/import 系
        await step('migrateOnLogin', async () => {
            h.cfg.migrate = { merged: s().plans.map(p => ({ ...p, ownerId: 'u1' })), dirtyIds: ['x1'] };
            usePlanStore.setState({ _deletedPlanIds: new Set(['pd']), _dirtyPlanIds: new Set(['q']) });
            await s().migrateOnLogin('u1', 'U');
        });
        await step('migrateOnLogin error', async () => {
            h.cfg.migrate = null as any;
            await s().migrateOnLogin('u1', 'U');
        });
        usePlanStore.setState({
            plans: [
                mk('L1'),
                mk('L2'),
                mk('L3', { _createdLoggedIn: true }),
                mk('L4', { data: undefined, compressedData: undefined }),
                mk('L5', { ownerId: 'u1' }),
                mk('L6'),
            ],
        });
        await step('getLocalPlanIds', () => s().getLocalPlanIds());
        await step('compress L6 for import', async () => {
            await s().archivePlan('L6');
            usePlanStore.setState({ plans: s().plans.map(p => (p.id === 'L6' ? { ...p, archived: false, ownerId: 'local' } : p)) });
        });
        await step('executeLocalImport', async () => {
            h.cfg.existsIds = new Set(['L2']);
            const progress: unknown[] = [];
            const r = await s().executeLocalImport('u1', 'U', ['L1', 'L2', 'L4', 'L5', 'L6', 'ghost'], e => progress.push(e));
            return { r, progress };
        });
        await step('executeLocalImport create fail', async () => {
            usePlanStore.setState({ plans: [mk('F1')] });
            h.cfg.createFailIds = new Set(['F1']);
            const progress: unknown[] = [];
            const r = await s().executeLocalImport('u1', 'U', ['F1'], e => progress.push(e));
            h.cfg.createFailIds = new Set();
            return { r, progress };
        });
        await step('deleteFromFirestore ok', async () => {
            usePlanStore.setState({ plans: [mk('D1', { ownerId: 'u1' }), mk('D2', { ownerId: 'u1' })], currentPlanId: 'D1', lastActivePlanId: 'D1' });
            await s().deleteFromFirestore('D1', 'u1', 'c1');
        });
        await step('deleteFromFirestore permissions error', async () => {
            h.cfg.deleteFail = true;
            await s().deleteFromFirestore('D2', 'u1', 'c1');
            h.cfg.deleteFail = false;
        });

        // archive 系
        await step('stale setup', () => {
            usePlanStore.setState({
                plans: [
                    mk('S1', { archived: true }),
                    mk('S2'),
                    mk('S3'),
                    mk('S4', { archived: true, data: undefined }),
                ],
                _dirtyPlanIds: new Set(),
            });
            setLastOpened('S2', NOW - 30 * DAY);
            setLastOpened('S3', NOW - 1000);
        });
        await step('recompressStaleArchives', () => s().recompressStaleArchives());
        await step('silentCompressStale', () => s().silentCompressStale());
        await step('silentCompressStale no candidates', () => s().silentCompressStale());

        await step('setPlans', () => s().setPlans([mk('Z1', { ownerId: 'u1' }), mk('Z2', { ownerId: 'u1' })]));
        await step('deletePlan current', () => {
            s().setCurrentPlanId('Z1');
            s().deletePlan('Z1');
        });
        await step('deletePlan local non-current', () => {
            usePlanStore.setState({ plans: [mk('Z3'), mk('Z4', { ownerId: 'u1' })], lastActivePlanId: 'Z3' });
            s().deletePlan('Z3');
            s().deletePlan('Z4');
        });
        await step('setCurrentPlanId set', () => s().setCurrentPlanId('Zq'));
        await step('setCurrentPlanId null', () => s().setCurrentPlanId(null));
        await step('getPlan', () => {
            usePlanStore.setState({ plans: [mk('G1')] });
            return [s().getPlan('G1')?.id, s().getPlan('nope')];
        });
        await step('setSaveStatus', () => s().setSaveStatus('saved'));

        const persisted = localStorage.getItem('plan-storage');
        expect({
            records,
            functionKeys: Object.keys(usePlanStore.getState())
                .filter(k => typeof (usePlanStore.getState() as any)[k] === 'function')
                .sort(),
            persisted: persisted ? norm(JSON.parse(persisted)) : null,
            lastOpened: norm(JSON.parse(localStorage.getItem('plan-last-opened') ?? '{}')),
        }).toMatchSnapshot();
    });
});
