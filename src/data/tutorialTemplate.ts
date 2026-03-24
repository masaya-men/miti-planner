/**
 * チュートリアル専用のタイムラインデータ。
 * コンテンツに依存しない固定データなので、コンテンツが増減しても影響しない。
 * Lv100前提のHP値で計算。
 */

import type { TimelineEvent } from '../types';

// Lv100 H1（白魔導士想定）のHP: ~105,000
const H1_HP = 105000;
// Lv100 MT（暗黒騎士想定）のHP: ~125,000
const MT_HP = 125000;

export const TUTORIAL_EVENTS: TimelineEvent[] = [
    {
        id: 'tut_evt_aoe',
        name: { ja: '全体攻撃サンプル', en: 'AoE Sample' },
        time: 4,
        damageAmount: Math.floor(H1_HP * 1.08),
        damageType: 'unavoidable',
        target: 'AoE',
    },
    {
        id: 'tut_evt_tb',
        name: { ja: 'タンクバスター', en: 'Tank Buster' },
        time: 10,
        damageAmount: Math.floor(MT_HP * 1.95),
        damageType: 'physical',
        target: 'MT',
    },
];

export const TUTORIAL_PLAN_TITLE = {
    ja: 'チュートリアル',
    en: 'Tutorial',
};
