import type { RecentPlanItem } from '../types/sidebarTypes';

/**
 * 「最近のアクティビティ」用のモックデータ
 * 正式名称（日本語/英語）を使用
 */
export const MOCK_RECENT_PLANS: RecentPlanItem[] = [
    {
        id: 'plan-1',
        contentId: 'aac_lhw_m1s',
        contentName: {
            ja: '至天の座アルカディア：ライトヘビー級1',
            en: 'AAC Light Heavyweight M1'
        },
        planName: '攻略用 (Static A)',
        lastViewedAt: Date.now() - 1000 * 60 * 30, // 30分前
    },
    {
        id: 'plan-2',
        contentId: 'fru',
        contentName: {
            ja: '絶もう一つの未来',
            en: 'Futures Rewritten (Ultimate)'
        },
        planName: '前半練習',
        lastViewedAt: Date.now() - 1000 * 60 * 60 * 2, // 2時間前
    },
    {
        id: 'plan-3',
        contentId: 'p12s',
        contentName: {
            ja: '万魔殿パンデモニウム：天獄編4',
            en: 'Pandaemonium: Anabaseios P12S'
        },
        planName: '消化用',
        lastViewedAt: Date.now() - 1000 * 60 * 60 * 24, // 1日前
    }
];
