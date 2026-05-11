// Phase B-1.5 polish 第 2 弾 #4 (Revision): 個別カード sweep に加え、 取り込み/削除
// の進捗を画面中央 (右プレビューペイン中央) に業界水準の横バー + テキストで表示する。
// 端の細い列に隠れがちな sweep の代わりに視認性の高い指標を提供。
// preview ペインに `position: relative` を付与した上で、 このコンポーネントを
// 子に置く。
import { AnimatePresence, motion } from 'framer-motion';

interface ImportProgressOverlayProps {
    /** 表示制御。 false で fade out。 */
    visible: boolean;
    /** バー充填率 (0-100)。 */
    percent: number;
    /** 上段ラベル (例: 「取り込み中…」 / 「削除中…」)。 i18n 解決済を渡す。 */
    label: string;
    /** 上段右に表示する件数文字列 (例: 「3/5」)。 undefined で非表示。 */
    countLabel?: string;
    /** blue = 取り込み / red = 削除。 */
    color: 'blue' | 'red';
}

export function ImportProgressOverlay({
    visible,
    percent,
    label,
    countLabel,
    color,
}: ImportProgressOverlayProps) {
    const clampedPercent = Math.max(0, Math.min(100, percent));
    const barColor = color === 'blue' ? 'bg-app-blue' : 'bg-app-red';

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    key="import-progress-overlay"
                    data-testid="import-progress-overlay"
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20 px-4"
                >
                    <div className="glass-tier3 px-5 py-4 rounded-xl border border-app-border shadow-xl w-full max-w-[320px]">
                        <div className="flex items-center justify-between mb-3 gap-3">
                            <span className="text-app-md font-semibold text-app-text">
                                {label}
                            </span>
                            {countLabel && (
                                <span
                                    data-testid="import-progress-count"
                                    className="text-app-md text-app-text-muted tabular-nums shrink-0"
                                >
                                    {countLabel}
                                </span>
                            )}
                        </div>
                        <div
                            className="w-full h-1.5 bg-app-surface2 rounded-full overflow-hidden"
                            role="progressbar"
                            aria-valuenow={Math.round(clampedPercent)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                data-testid="import-progress-bar-fill"
                                className={`h-full ${barColor} transition-all duration-300 ease-out`}
                                style={{ width: `${clampedPercent}%` }}
                            />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
