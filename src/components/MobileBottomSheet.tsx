import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { MOBILE_TOKENS, MOBILE_SHEET_BOTTOM_OFFSET_CSS } from '../tokens/mobileTokens';
import { useSwipeToDismiss } from '../hooks/useSwipeToDismiss';

interface MobileBottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    children: React.ReactNode;
    /** Max height. Default '65vh' */
    height?: string;
    /** タイトルバー右側(× の左)に置く任意のアクション(例: メニューの「パーティ編成」)。title 指定時のみ表示。 */
    headerAction?: React.ReactNode;
    /**
     * 中身が自前で高さ・スクロールを管理する場合 true。
     * シート高さを確定値(height)にし、内側のスクロール領域 / 下部パディングを外す。
     * (Sidebar のように内部 flex-1 スクロール + 下端固定フッターを持つ子向け)
     */
    fillContent?: boolean;
    /**
     * Sheet 本体に追加するクラス。housing シート等、呼び出し側の世界観で
     * 背景・文字色を上書きするための穴 (未指定なら従来どおり)。
     */
    className?: string;
    /**
     * 下スワイプで閉じるジェスチャの受け付け範囲。既定 'sheet' = シート全面 (従来挙動)。
     * 'handle' = 上部のつまみ(ドラッグハンドル)だけ。中身を縦スクロールするシート
     * (housing のフィルター等) は全面スワイプだとスクロールで誤って閉じて不安定なため handle を使う。
     */
    swipeArea?: 'sheet' | 'handle';
}

export const MobileBottomSheet: React.FC<MobileBottomSheetProps> = ({
    isOpen, onClose, title, children, height = '65vh', fillContent = false, headerAction, className,
    swipeArea = 'sheet'
}) => {
    const { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd } = useSwipeToDismiss<HTMLDivElement>(onClose);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="md:hidden fixed inset-0 z-[300]"
                        style={{ backgroundColor: 'var(--color-overlay)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                    />
                    {/* Sheet */}
                    <motion.div
                        ref={sheetRef}
                        {...(swipeArea === 'sheet'
                            ? { onTouchStart: handleTouchStart, onTouchMove: handleTouchMove, onTouchEnd: handleTouchEnd }
                            : {})}
                        className={`md:hidden fixed left-0 right-0 z-[301] flex flex-col overflow-hidden shadow-lg${className ? ` ${className}` : ''}`}
                        style={{
                            // fillContent 時は高さを確定値にして、子の h-full / flex チェーンを解決させる
                            ...(fillContent ? { height } : { maxHeight: height }),
                            bottom: MOBILE_SHEET_BOTTOM_OFFSET_CSS,
                            backgroundColor: 'var(--color-sheet-bg)',
                            borderTopLeftRadius: MOBILE_TOKENS.sheet.radius,
                            borderTopRightRadius: MOBILE_TOKENS.sheet.radius,
                        }}
                        initial={{ y: '100%' }}
                        animate={{ y: 0, transition: { type: "spring", stiffness: 380, damping: 22 } }}
                        exit={{ y: '100%', transition: { duration: 0.25, ease: [0.32, 0.72, 0, 1] } }}
                    >
                        {/* Drag handle (swipeArea='handle' のときはここだけがスワイプ閉じの受け付け範囲)。
                            見た目の高さは変えず、当たり判定だけ絶対配置の透明レイヤーで
                            MOBILE_TOKENS.touchTarget.min(44px)まで拡張する(狭すぎて掴めない実機FB対応)。 */}
                        <div className="relative flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
                            {swipeArea === 'handle' && (
                                <div
                                    className="absolute inset-x-0"
                                    style={{ top: '50%', height: MOBILE_TOKENS.touchTarget.min, transform: 'translateY(-50%)' }}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                />
                            )}
                            <div
                                className="bg-[var(--app-text)]/20"
                                style={{
                                    width: MOBILE_TOKENS.sheet.handleWidth,
                                    height: MOBILE_TOKENS.sheet.handleHeight,
                                    borderRadius: MOBILE_TOKENS.sheet.handleRadius,
                                }}
                            />
                        </div>

                        {/* Title bar */}
                        {title && (
                            <div className="flex items-center justify-between gap-2 px-4 pb-2 border-b border-app-border">
                                <h3 className="text-app-2xl font-black text-app-text tracking-wide shrink-0">{title}</h3>
                                <div className="flex items-center gap-2 min-w-0">
                                    {headerAction}
                                    <button
                                        onClick={onClose}
                                        className="relative p-1.5 rounded-lg hover:bg-app-surface2 transition-colors cursor-pointer shrink-0"
                                    >
                                        {/* 見た目は変えず当たり判定だけ拡張(2026-08-14実機FB=「バツボタン全然押せない」)。
                                            はみ出す方向に配置した要素へのクリックもbutton自身までバブルするため機能する。 */}
                                        <span className="absolute -inset-2" aria-hidden="true" />
                                        <X size={16} className="text-app-text-sec" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Content */}
                        {fillContent ? (
                            // 子が自前で高さ・スクロールを管理（内側スクロール/下部パディングを付けない）
                            <div className="flex-1 min-h-0 flex flex-col">
                                {children}
                            </div>
                        ) : (
                            // 既定: シート側がスクロールを持つ（短いコンテンツ向け）
                            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 pb-20">
                                {children}
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
