/**
 * チュートリアル専用のタイムラインデータ。
 * ダメージは固定値ではなく、実際のパーティステータスから動的計算する。
 */

import type { TimelineEvent } from '../types';

/** AoE: ヒーラーHPの108%（軽減なしで致死） */
export const TUTORIAL_AOE_RATIO = 1.08;
/** TB: タンクHPの195%（軽減なしで致死） */
export const TUTORIAL_TB_RATIO = 1.95;

/**
 * パーティのステータスに基づいてチュートリアル用イベントを生成する。
 * @param otherHp ヒーラー/DPSのHP（AoEダメージの基準）
 * @param tankHp タンクのHP（TBダメージの基準）
 */
export function createTutorialEvents(otherHp: number, tankHp: number): TimelineEvent[] {
    return [
        {
            id: 'tut_evt_aoe',
            name: { ja: '全体攻撃サンプル', en: 'AoE Sample' },
            time: 4,
            damageAmount: Math.floor(otherHp * TUTORIAL_AOE_RATIO),
            damageType: 'unavoidable',
            target: 'AoE',
        },
        {
            id: 'tut_evt_tb',
            name: { ja: 'タンクバスター', en: 'Tank Buster' },
            time: 10,
            damageAmount: Math.floor(tankHp * TUTORIAL_TB_RATIO),
            damageType: 'physical',
            target: 'MT',
        },
    ];
}

export const TUTORIAL_PLAN_TITLE = {
    ja: 'チュートリアル',
    en: 'Tutorial',
};
