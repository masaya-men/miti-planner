import React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { MOBILE_TOKENS } from '../../tokens/mobileTokens';
import { partyVisCellVariants } from './mobileFabChips';

interface FabPartyVisGridProps {
    partyVisButtonRect: DOMRect | null;
    partyVisOpen: boolean;
    partyVisLabelWidth: number;
    partyVisibilityCells: { id: string; icon: string | null; hidden: boolean }[];
    toggleHiddenPartyMember: (memberId: string) => void;
}

export const FabPartyVisGrid: React.FC<FabPartyVisGridProps> = ({ partyVisButtonRect, partyVisOpen, partyVisLabelWidth, partyVisibilityCells, toggleHiddenPartyMember }) => (
    <>
            {/* パーティ表示/非表示グリッド — 言語/エフェクトモードのfan-outチップと同じ技法
                (ボタン位置から個別にバネで飛び出す・タップ後も閉じない)を2段×4列に適用
                (2026-08-19)。共通の箱には入れず、ジョブアイコン1個ずつが独立したチップ。 */}
            {partyVisButtonRect && createPortal(
                <AnimatePresence>
                    {partyVisOpen && partyVisibilityCells.map((m, i) => {
                        const col = i % 4;
                        const row = Math.floor(i / 4);
                        // グリッド全体(4列×2段)の右端をFABラベル文言の左に実測ぶんの隙間を空けて置く
                        // (fanChipXと同じ gap=10/12 の考え方。固定オフセットだと「表示メンバー」等の
                        // 長いラベルに重なるバグだったため、言語/エフェクトモードと同じくラベル幅実測に揃えた)。
                        const gridW = 4 * 44 + 3 * 6;
                        const gridRight = partyVisButtonRect.left - 10 - partyVisLabelWidth - 12;
                        const anchorLeft = gridRight - gridW;
                        const anchorTop = partyVisButtonRect.top - (2 * 44 + 6 + 16 - MOBILE_TOKENS.fab.itemSize) / 2;
                        const targetX = anchorLeft + col * (44 + 6) - partyVisButtonRect.left;
                        const targetY = anchorTop + row * (44 + 6) - partyVisButtonRect.top;
                        return (
                            <motion.button
                                key={m.id}
                                type="button"
                                custom={{ i, targetX, targetY, count: partyVisibilityCells.length }}
                                variants={partyVisCellVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                onClick={() => toggleHiddenPartyMember(m.id)}
                                // active:scale-90(CSS)は使わない: このボタンはframer-motionが
                                // variants経由でx/y/scaleのtransformを継続制御しており、CSS:activeの
                                // transformと取り合って指を置いた瞬間にアイコンが動こうとするような
                                // 見た目になり、タップ判定が安定しない(メインFABボタンで2026-08-13に
                                // 同じ原因を特定済み・下記769行目付近のコメント参照)。press演出は
                                // whileTapだけに一本化する。
                                whileTap={{ scale: 0.85, transition: { duration: 0.1 } }}
                                className="fixed flex items-center justify-center"
                                style={{
                                    left: partyVisButtonRect.left,
                                    top: partyVisButtonRect.top,
                                    width: 44,
                                    height: 44,
                                    zIndex: 9999,
                                }}
                            >
                                {m.icon ? (
                                    <img referrerPolicy="no-referrer"
                                        src={m.icon}
                                        alt={m.id}
                                        className={clsx(
                                            'w-8 h-8 rounded-md object-cover drop-shadow-lg transition-all duration-150',
                                            m.hidden && 'opacity-30 grayscale scale-90'
                                        )}
                                    />
                                ) : (
                                    // ジョブ未設定の空席: PC版(PartyVisibilityMenu)と同じくロール名を出す(2026-08-27)。
                                    <span className={clsx(
                                        'text-app-lg font-black text-white/80 tracking-tight drop-shadow-lg',
                                        m.hidden && 'opacity-30'
                                    )}>
                                        {m.id}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </AnimatePresence>,
                document.body
            )}
    </>
);
