import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { SPRING, STAGGER } from '../../tokens/motionTokens';
import type { ContentLanguage, MobileEffectBarMode } from '../../store/useThemeStore';

export const LANG_LABELS: Record<ContentLanguage, string> = {
    ja: '日',
    en: 'EN',
    zh: '中',
    'zh-Hant': '繁',
    ko: '한',
};

// チップ(言語/エフェクトモード共通)のレイアウト定数 — 対応するボタンのラベルの左に一直線
export const FAN_CHIP_SIZE = 36;
export const FAN_CHIP_GAP = 6;
// 表示順序（左から: 日 EN 中 繁 한→ 右端が現在地に近い）
export const LANG_DISPLAY_ORDER: ContentLanguage[] = ['ja', 'en', 'zh', 'zh-Hant', 'ko'];
// 2026-08-14: 'scroll'(連動)は一時除外していたが、初動の重さの主因の一つ
// (.mobile-row-dim-textの属性セレクタ切替)を修正した実測で大幅改善したため復活。
export const EFFECT_MODE_ORDER: MobileEffectBarMode[] = ['icon', 'scroll', 'bar'];
export const EFFECT_MODE_CHIP_LABELS: Record<MobileEffectBarMode, string> = {
    icon: '静止',
    scroll: '連動',
    bar: '常時',
};

// i番目のチップのx位置（対応ボタン中心基準、左方向=負）。
// ボタン(44px) + gap(10px) + ラベル実測幅 + gap(12px) + チップ列。
// ラベル幅を固定50px決め打ちにしていた版は「スクロール演出」等の長いラベルでチップが
// ラベル本体に重なるバグだったため、実測値(labelWidth)を必須で受け取るようにした
// (2026-08-14実機FB)。
export function fanChipX(i: number, count: number, labelWidth: number): number {
    const labelOffset = -(MOBILE_TOKENS.fab.itemSize / 2 + 10 + labelWidth + 12);
    return labelOffset - (count - 1 - i) * (FAN_CHIP_SIZE + FAN_CHIP_GAP) - FAN_CHIP_SIZE / 2;
}

// チップ(言語/エフェクトモード共通)のアニメーション variants
export const fanChipVariants = {
    hidden: {
        x: 0,
        scale: 0,
        opacity: 0,
    },
    visible: (custom: { i: number; targetX: number }) => ({
        x: custom.targetX,
        scale: 1,
        opacity: 1,
        transition: {
            ...SPRING.bouncy,
            delay: custom.i * 0.05,
        },
    }),
    exit: (custom: { i: number; count: number; isSelected: boolean }) => {
        if (custom.isSelected) {
            return {
                x: 0,
                scale: 0,
                opacity: 0,
                transition: {
                    duration: 0.2,
                    ease: 'easeIn' as const,
                },
            };
        }
        return {
            x: 0,
            scale: 0,
            opacity: 0,
            transition: {
                ...SPRING.snappy,
                delay: (custom.count - 1 - custom.i) * 0.04,
            },
        };
    },
    tap: {
        scale: 1.3,
        transition: { duration: 0.1 },
    },
};

// パーティ表示/非表示グリッド専用のチップvariants(2026-08-19、fanChipVariantsと同じ技法を
// 2段×4列グリッドに適用)。1軸のx移動ではなくx/y両方でボタン位置から個別に飛び出す。
// タップしても閉じない仕様のため exit の isSelected 分岐は不要(fanChipVariantsと違う点)。
export const partyVisCellVariants = {
    hidden: { x: 0, y: 0, scale: 0, opacity: 0 },
    visible: (custom: { i: number; targetX: number; targetY: number }) => ({
        x: custom.targetX,
        y: custom.targetY,
        scale: 1,
        opacity: 1,
        transition: { ...SPRING.bouncy, delay: custom.i * (STAGGER.fab / 1000) },
    }),
    exit: (custom: { i: number; count: number }) => ({
        x: 0,
        y: 0,
        scale: 0,
        opacity: 0,
        transition: {
            ...SPRING.snappy,
            delay: (custom.count - 1 - custom.i) * 0.04,
        },
    }),
};

// アニメーション: トークン使用
export const itemVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.85 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            ...SPRING.default,
            delay: i * (STAGGER.fab / 1000),
        },
    }),
    exit: (i: number) => ({
        opacity: 0,
        y: 12,
        scale: 0.85,
        transition: {
            ...SPRING.snappy,
            delay: i * 0.025,
        },
    }),
};
