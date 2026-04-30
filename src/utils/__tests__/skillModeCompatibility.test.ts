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

    describe('想定外ケース統合テスト', () => {
        it('パーティ内 mode 混在: MT=reborn / ST=evolved / H1=未指定（→ reborn）', () => {
            const party: PartyMember[] = [
                { id: 'MT', jobId: 'pld', role: 'tank',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {}, mode: 'reborn' },
                { id: 'ST', jobId: 'war', role: 'tank',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {}, mode: 'evolved' },
                { id: 'H1', jobId: 'whm', role: 'healer',
                  stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                  computedValues: {} }, // mode 未指定
            ];
            expect(getMode(party[0])).toBe('reborn');
            expect(getMode(party[1])).toBe('evolved');
            expect(getMode(party[2])).toBe('reborn');
        });

        it('差分なしの空 modes オブジェクトでも reborn 扱い', () => {
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                modes: {}, // evolved キーなし
            };
            expect(resolveMitigation(m, 'evolved')).toBe(m);
        });

        it('差分が空オブジェクト {} でも入力と参照同一性維持はせず spread のみ', () => {
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                modes: { evolved: {} }, // 空 Partial
            };
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
            expect(result!.value).toBe(20); // 値変化なし
            expect(result!.recast).toBe(90);
        });

        it('disabled: false（明示）は無効化扱いではない（型エラーにならず通常スキル）', () => {
            // 注: { disabled: true } のみ無効化判定。false は無視される
            const m: Mitigation = {
                id: 'rampart', jobId: 'pld',
                name: { ja: 'ランパート', en: 'Rampart' },
                icon: '/icons/rampart.png',
                recast: 90, duration: 20, type: 'all', value: 20,
                // @ts-expect-error: disabled: false は型上 { disabled: true } と矛盾するため
                modes: { evolved: { disabled: false } },
            };
            // ランタイムでは disabled === true のみチェック → null にならない
            const result = resolveMitigation(m, 'evolved');
            expect(result).not.toBeNull();
        });

        it('persist middleware merge シミュレーション: 旧 partyMembers + 新 INITIAL_PARTY マージ', () => {
            // localStorage 復元: mode 無しの旧データ
            const persistedMember: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: { hp: 299000 },
            };
            // store の merge ロジックは partyMembers をそのまま採用（mode 無し）
            // → getMode で reborn fallback
            expect(getMode(persistedMember)).toBe('reborn');
            // → 新規メンバー作成パスに乗らないため mode は書き込まれない（互換維持）
            expect('mode' in persistedMember).toBe(false);
        });

        it('共有リンク経由で受け取った旧プランのメンバー（mode 無し）も reborn 扱い', () => {
            // api/share GET レスポンスで mode フィールドが落ちている想定
            const sharedMember: PartyMember = {
                id: 'D1', jobId: 'rdm', role: 'dps',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect(getMode(sharedMember)).toBe('reborn');
        });

        it('Firestore 復元時の mode 欠落: undefined を許容する', () => {
            // Firestore 旧ドキュメント: mode フィールドが存在しない
            const firestoreDoc = {
                id: 'H2', jobId: 'sch', role: 'healer' as const,
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {},
            };
            expect(getMode(firestoreDoc as PartyMember)).toBe('reborn');
        });

        it('JSON.stringify ラウンドトリップで mode が保持される（明示指定時）', () => {
            const member: PartyMember = {
                id: 'MT', jobId: 'pld', role: 'tank',
                stats: { hp: 0, mainStat: 0, det: 0, crt: 0, ten: 0, ss: 0, wd: 0 },
                computedValues: {}, mode: 'evolved',
            };
            const restored: PartyMember = JSON.parse(JSON.stringify(member));
            expect(getMode(restored)).toBe('evolved');
        });

        it('複数 mitigations を mode フィルタ通すパフォーマンス検証（線形時間）', () => {
            const mitigations: Mitigation[] = Array.from({ length: 100 }, (_, i) => ({
                id: `skill_${i}`, jobId: 'pld',
                name: { ja: `スキル${i}`, en: `Skill${i}` },
                icon: '/icons/x.png',
                recast: 60 + i, duration: 15, type: 'all', value: 10 + (i % 20),
            }));
            const start = performance.now();
            const filtered = mitigations
                .map(m => resolveMitigation(m, 'evolved'))
                .filter((m): m is Mitigation => m !== null);
            const elapsed = performance.now() - start;
            expect(filtered).toHaveLength(100); // 全 mitigation modes 無し → 全通過
            expect(elapsed).toBeLessThan(50); // 100 件で 50ms 以下
        });
    });
});
