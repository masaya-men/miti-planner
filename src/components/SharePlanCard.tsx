import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SweepOverlay } from './SweepOverlay';

// 退場アニメ shape: AnimatePresence の `exit` (plan が unmount するとき) と、
// `isExiting` フラグで `animate` 経由に切り替わるとき (delete fail 時に unmount せず
// 退場演出だけ見せたいケース) の両方で同じ見た目を維持するため、 1 か所に集約。
const EXIT_SHAPE = {
    opacity: 0,
    scale: 0.95,
    height: 0,
    marginTop: 0,
    paddingTop: 0,
    paddingBottom: 0,
} as const;

// チェックボックス関連プロパティの discriminated union。
type CheckboxProps =
    | { showCheckbox: false }
    | { showCheckbox: true; isChecked: boolean; onToggleCheck: () => void };

type SharePlanCardProps = {
    /** 主タイトル (現在の使い方: コンテンツ名) */
    title: string;
    /** 副タイトル (現在の使い方: プラン名) */
    subtitle?: string;
    isActive: boolean;
    badge?: ReactNode;
    onClickRow: () => void;
    children?: ReactNode;
    /** 上限ヒット時の赤背景フラグ (#4) */
    isRedFlagged?: boolean;
    /** カード退場アニメフラグ (#5: 削除完了後にフェードアウト) */
    isExiting?: boolean;
    /** sweep オーバーレイの状態 (#3, #5)。 undefined のとき非表示 */
    sweepStatus?: 'idle' | 'active' | 'success' | 'failed';
    /** sweep オーバーレイの色 (#3 取り込みで blue, #5 削除で red) */
    sweepColor?: 'blue' | 'red';
} & CheckboxProps;

// 共有取り込み (ShareImportSheet) と上限解消 (LimitResolutionSheet) で共通使用するカード行。
// レイアウト: [SweepOverlay (絶対配置の背景)] [チェックボックス?] [タイトル/サブタイトル] [バッジ?]
//             [children (任意の追加スロット)]
export function SharePlanCard(props: SharePlanCardProps) {
    const {
        title,
        subtitle,
        isActive,
        badge,
        onClickRow,
        children,
        isRedFlagged,
        isExiting,
        sweepStatus,
        sweepColor = 'blue',
    } = props;
    // Phase B-1.5 polish 第 2 弾 #4: sweep (取り込み / 削除演出) 中に isActive の
    // 青背景 (bg-app-blue/10) が乗っていると、 青 sweep (width 0→100% も同系青) が
    // 視認できなくなる。 sweep 中は isActive 背景を抑制し sweep に視覚的主役を譲る。
    // ただし isRedFlagged (上限ヒット赤フラグ) は重要シグナルなので sweep 中も赤背景を
    // 保持する (赤背景 + 青 sweep は色相が異なるため両方視認可能)。
    // sweep が無いとき (preview / 未削除) は元の precedence (isActive > isRedFlagged) を維持。
    const isSweeping = sweepStatus !== undefined && sweepStatus !== 'idle';
    const baseClass = isExiting
        ? 'pointer-events-none'
        : isSweeping
          ? (isRedFlagged
              ? 'bg-app-red/15 border-app-red/40'
              : 'bg-app-surface2/30 border-app-border')
          : isActive
            ? 'active bg-app-blue/10 border-app-blue/40'
            : isRedFlagged
              ? 'bg-app-red/15 border-app-red/40'
              : 'bg-app-surface2/30 border-app-border hover:bg-app-surface2/50';
    return (
        <motion.div
            data-testid="share-plan-card"
            data-exiting={isExiting ? 'true' : undefined}
            role="button"
            tabIndex={isExiting ? -1 : 0}
            onClick={isExiting ? undefined : onClickRow}
            onKeyDown={(e) => {
                if (isExiting) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClickRow();
                }
            }}
            // LayoutGroup と組み合わせて、 退場時に他カードがスムーズに詰まる。
            // `executePlanDeletions` は `local_delete:success` の時点で `usePlanStore.deletePlan`
            // を呼ぶため、 plan は `targetPlans` から消えて React が即 unmount される
            // → `exit` 経路で fade + 縮小。 `animate` 側の `isExiting` 分岐は、 削除失敗で
            // unmount せず退場演出だけ見せたいケースの保険。
            layout
            initial={false}
            animate={isExiting ? EXIT_SHAPE : { opacity: 1, scale: 1 }}
            exit={EXIT_SHAPE}
            transition={{ duration: 0.3, ease: 'easeIn' }}
            className={`relative flex flex-col gap-1 p-2 rounded-lg border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue overflow-hidden ${baseClass}`}
        >
            {sweepStatus !== undefined && (
                <SweepOverlay status={sweepStatus} color={sweepColor} />
            )}
            <div className="relative z-[1] flex items-center gap-2">
                {props.showCheckbox && (
                    <input
                        type="checkbox"
                        checked={props.isChecked}
                        onChange={props.onToggleCheck}
                        onClick={(e) => e.stopPropagation()}
                        disabled={isExiting}
                        className="w-4 h-4 cursor-pointer accent-app-blue shrink-0 disabled:cursor-not-allowed"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-app-md text-app-text truncate">
                        {title}
                    </div>
                    {subtitle && (
                        <div className="text-app-sm text-app-text-muted truncate">{subtitle}</div>
                    )}
                </div>
                {badge && <div className="shrink-0">{badge}</div>}
            </div>
            {children && <div className="relative z-[1]">{children}</div>}
        </motion.div>
    );
}
