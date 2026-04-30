// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
// 純粋関数のため firebase / store mock 不要。
import {
    DEFAULT_NEW_MODE,
    getMode,
    resolveMitigation,
    type SkillMode,
} from '../mitigationResolver';
import type { Mitigation, PartyMember } from '../../types';

// 共通フィクスチャ
const baseMit = (over: Partial<Mitigation> = {}): Mitigation => ({
    id: 'rampart',
    jobId: 'pld',
    name: { ja: 'ランパート', en: 'Rampart' },
    icon: '/icons/rampart.png',
    recast: 90,
    duration: 20,
    type: 'all',
    value: 20,
    ...over,
});

const baseMember = (over: Partial<PartyMember> = {}): PartyMember => ({
    id: 'MT',
    jobId: 'pld',
    role: 'tank',
    stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
    computedValues: {},
    ...over,
});

describe('DEFAULT_NEW_MODE', () => {
    it("現在は 'reborn' （8.0 リリース時に 'evolved' へ切替予定）", () => {
        expect(DEFAULT_NEW_MODE).toBe('reborn');
    });
});

describe('getMode', () => {
    it("mode 未指定なら 'reborn' フォールバック", () => {
        expect(getMode(baseMember({ mode: undefined }))).toBe('reborn');
    });

    it("mode === 'reborn' ならそのまま 'reborn'", () => {
        expect(getMode(baseMember({ mode: 'reborn' }))).toBe('reborn');
    });

    it("mode === 'evolved' ならそのまま 'evolved'", () => {
        expect(getMode(baseMember({ mode: 'evolved' }))).toBe('evolved');
    });
});

describe('resolveMitigation', () => {
    describe('差分なし', () => {
        it('reborn モードで入力と完全一致', () => {
            const m = baseMit();
            expect(resolveMitigation(m, 'reborn')).toBe(m);
        });

        it('evolved モードでも入力と完全一致（modes 未定義）', () => {
            const m = baseMit();
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });

        it('modes は定義あり・evolved キーなしでも入力と完全一致', () => {
            const m = baseMit({ modes: {} });
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });
    });

    describe('差分あり', () => {
        it('reborn モードでは差分を無視', () => {
            const m = baseMit({ modes: { evolved: { value: 30 } } });
            const result = resolveMitigation(m, 'reborn');
            expect(result).toBe(m);
            expect(result?.value).toBe(20);
        });

        it('evolved モードで数値フィールドが上書きされる', () => {
            const m = baseMit({
                value: 20,
                modes: { evolved: { value: 30, recast: 60 } },
            });
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBe(m); // 別オブジェクト（spread の結果）
            expect(result?.value).toBe(30);
            expect(result?.recast).toBe(60);
            expect(result?.duration).toBe(20); // 差分なしフィールドは保持
            expect(result?.id).toBe('rampart'); // id 等他フィールドも保持
        });

        it('evolved モードで scope 等のリテラル型も上書きされる', () => {
            const m = baseMit({
                scope: 'party',
                modes: { evolved: { scope: 'target' } },
            });
            expect(resolveMitigation(m, 'evolved')?.scope).toBe('target');
        });

        it('evolved モードで isShield / shieldScale が後付けされる', () => {
            const m = baseMit({
                isShield: false,
                modes: { evolved: { isShield: true, shieldScale: '20% HP' } },
            });
            const result = resolveMitigation(m, 'evolved');
            expect(result?.isShield).toBe(true);
            expect(result?.shieldScale).toBe('20% HP');
        });
    });

    describe('disabled (エヴォルヴでスキル消滅)', () => {
        it('evolved + disabled: true なら null', () => {
            const m = baseMit({ modes: { evolved: { disabled: true } } });
            expect(resolveMitigation(m, 'evolved')).toBeNull();
        });

        it('reborn では disabled を無視して入力と完全一致', () => {
            const m = baseMit({ modes: { evolved: { disabled: true } } });
            expect(resolveMitigation(m, 'reborn')).toBe(m);
        });
    });

    describe('純粋性', () => {
        it('入力 Mitigation を破壊変更しない', () => {
            const m = baseMit({ modes: { evolved: { value: 99 } } });
            const before = JSON.stringify(m);
            resolveMitigation(m, 'evolved');
            expect(JSON.stringify(m)).toBe(before);
        });
    });

    describe('モード型網羅', () => {
        it('SkillMode リテラル型は reborn/evolved の 2 値のみ受け付ける', () => {
            const modes: SkillMode[] = ['reborn', 'evolved'];
            for (const mode of modes) {
                expect(resolveMitigation(baseMit(), mode)).toBeTruthy();
            }
        });
    });
});
