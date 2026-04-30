// globals: true モード（vitest.config.ts）に従い、describe/it/expect はグローバル使用。
// 既存挙動互換性ガード: スキルモード切替インフラ追加によって既存プランの計算結果が
// 変わっていないことを構造的に保証する。
import { resolveMitigation, getMode, DEFAULT_NEW_MODE } from '../mitigationResolver';
import type { Mitigation, PartyMember } from '../../types';

describe('既存プラン互換性ガード', () => {
    describe('mode 未指定 PartyMember は reborn 扱い', () => {
        it('mode フィールド完全欠落 → reborn', () => {
            const member: PartyMember = {
                id: 'MT',
                jobId: 'pld',
                role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
                // mode 未定義
            };
            expect(getMode(member)).toBe('reborn');
        });

        it('mode = undefined（明示） → reborn', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {}, mode: undefined,
            };
            expect(getMode(member)).toBe('reborn');
        });
    });

    describe('modes 未指定 Mitigation は両モードで入力一致', () => {
        const baseMit: Mitigation = {
            id: 'rampart', jobId: 'pld',
            name: { ja: 'ランパート', en: 'Rampart' },
            icon: '/icons/rampart.png',
            recast: 90, duration: 20, type: 'all', value: 20,
        };

        it('reborn で入力と参照同一性維持', () => {
            expect(resolveMitigation(baseMit, 'reborn')).toBe(baseMit);
        });

        it('evolved で入力と参照同一性維持（modes 無し）', () => {
            expect(resolveMitigation(baseMit, 'evolved')).toBe(baseMit);
        });
    });

    describe('DEFAULT_NEW_MODE 値固定（8.0 リリースまで変更禁止）', () => {
        it("リリース前は 'reborn' であること（誤って 'evolved' に変更されると既存プラン破損）", () => {
            expect(DEFAULT_NEW_MODE).toBe('reborn');
        });
    });

    describe('localStorage 旧データシミュレーション', () => {
        it('mode フィールド無しの partyMembers JSON をロードしても getMode が reborn を返す', () => {
            // 旧プラン JSON（実際の localStorage シリアライズ形式）
            const oldPlanJson = JSON.stringify({
                partyMembers: [
                    { id: 'MT', jobId: 'pld', role: 'tank',
                      stats: { hp: 299000, mainStat: 5000, det: 2000, crt: 2500, ten: 1500, ss: 400, wd: 130 },
                      computedValues: { hp: 299000 } },
                ],
            });
            const restored = JSON.parse(oldPlanJson) as { partyMembers: PartyMember[] };
            expect(getMode(restored.partyMembers[0])).toBe('reborn');
        });
    });

    describe('全 Mitigation フィールドの差分上書き網羅', () => {
        const fullMit: Mitigation = {
            id: 'sample', jobId: 'pld',
            name: { ja: 'サンプル', en: 'Sample' },
            icon: '/icons/sample.png',
            recast: 60, duration: 15, type: 'magical', value: 10,
            valuePhysical: 5, valueMagical: 15, isShield: false,
            valueType: 'hp', minLevel: 50, maxLevel: 100,
            scope: 'party', isInvincible: false, healingIncrease: 20,
            healingIncreaseDuration: 10, healingIncreaseSelfOnly: false,
            requires: 'parent', requiresWindow: 5,
            resourceCost: { type: 'aetherflow', amount: 1 },
            maxCharges: 2, family: 'samples', stacks: 3,
            reapplyOnAbsorption: true, onExpiryHealingPotency: 100,
            burstValue: 5, burstDuration: 4,
            exclusiveWith: 'other_sample', hidden: false,
            requiresFairy: false, targetCannotBeSelf: false,
            copiesShield: 'parent_shield',
        };

        const allFieldOverrides: Partial<Mitigation> = {
            recast: 120, duration: 30, type: 'all', value: 25,
            valuePhysical: 15, valueMagical: 30, isShield: true,
            scope: 'self', isInvincible: true, healingIncrease: 50,
            maxCharges: 3, stacks: 5,
        };

        it('すべての主要フィールドが evolved で上書き可能', () => {
            const m: Mitigation = { ...fullMit, modes: { evolved: allFieldOverrides } };
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
            for (const [key, value] of Object.entries(allFieldOverrides)) {
                expect(result![key as keyof Mitigation]).toEqual(value);
            }
        });

        it('reborn では差分が 1 つも適用されない', () => {
            const m: Mitigation = { ...fullMit, modes: { evolved: allFieldOverrides } };
            const result = resolveMitigation(m, 'reborn');
            expect(result).toBe(m);
            for (const [key, originalValue] of Object.entries(fullMit)) {
                if (key === 'modes') continue;
                expect(result![key as keyof Mitigation]).toEqual(originalValue);
            }
        });
    });

    describe('disabled スキルの伝播', () => {
        it('evolved で disabled → resolveMitigation が null → filter で除外される', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: '消えるスキル', en: 'Disappearing Skill' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { disabled: true } },
            };
            const all = [m];
            const filtered = all
                .map(x => resolveMitigation(x, 'evolved'))
                .filter((x): x is Mitigation => x !== null);
            expect(filtered).toHaveLength(0);
        });

        it('reborn では disabled が無視されてスキルが残る', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: '消えるスキル', en: 'Disappearing Skill' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { disabled: true } },
            };
            const all = [m];
            const filtered = all
                .map(x => resolveMitigation(x, 'reborn'))
                .filter((x): x is Mitigation => x !== null);
            expect(filtered).toHaveLength(1);
        });
    });

    describe('Mitigation 純粋性（破壊変更なし）', () => {
        it('resolveMitigation を 100 回呼んでも入力 Mitigation のフィールドが変わらない', () => {
            const m: Mitigation = {
                id: 'sample', jobId: 'pld',
                name: { ja: 'サンプル', en: 'Sample' },
                icon: '/icons/x.png', recast: 60, duration: 15,
                type: 'magical', value: 10,
                modes: { evolved: { value: 99 } },
            };
            const before = JSON.stringify(m);
            for (let i = 0; i < 100; i++) {
                resolveMitigation(m, 'evolved');
                resolveMitigation(m, 'reborn');
            }
            expect(JSON.stringify(m)).toBe(before);
        });
    });

    describe('PartyMember 純粋性（getMode は破壊変更しない）', () => {
        it('getMode を呼んでも mode フィールドが書き込まれない', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect('mode' in member).toBe(false);
            getMode(member);
            expect('mode' in member).toBe(false); // フィールド注入されていない
        });
    });
});
