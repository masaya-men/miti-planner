import React from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { useEscapeClose } from '../../hooks/useEscapeClose';
import { backdropClose, type BackdropCloseOptions } from '../../utils/backdropClose';

/**
 * 窓(モーダル)の共通の殻。新しい窓は必ずこれを使う(ModalShell.guard.test が見張る)。
 * - body 直下に描く / 背景=暗さ50%+うすいぼかし / 窓=ふわっと開く(2026-10-26 案B)
 * - Esc で閉じる(重なっていたら一番上だけ) / 外側クリックで閉じる(入力後は閉じずに枠を光らせる)
 * - locked の間(取り込み中など)は Esc も外側クリックも効かない。Esc は下の窓へも抜けない
 * 中身は ModalParts(ModalHeader / ModalFooter / ModalButton / INPUT_CLASS)で組む。
 * 窓の枠(浮かぶものの素材 float-surface・角丸 2xl)は殻が付ける。幅などは className で足す。枠を自前で描く窓だけ frame={false}。
 */
const LAYER_CLASS = {
    /** ふつうの窓 */
    window: 'z-[10000]',
    /** ふつうの窓の上に出る確認・ログイン */
    confirm: 'z-[99999]',
    /** 何よりも前に出すお知らせ */
    top: 'z-[100000]',
} as const;

type ModalLayer = keyof typeof LAYER_CLASS;

interface ModalShellProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    layer?: ModalLayer;
    /** true の間は閉じられない(× ボタンの無効化は各窓で) */
    locked?: boolean;
    /** false で外側クリックでは閉じない(Esc は効く) */
    closeOnBackdrop?: boolean;
    backdropOptions?: BackdropCloseOptions;
    /** false で殻の枠(素材 float-surface・角丸)を付けない */
    frame?: boolean;
    /** 窓の枠に足すクラス(幅・高さなど) */
    className?: string;
    style?: React.CSSProperties;
    /** 窓の枠に足す属性(data-* など) */
    panelProps?: React.HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, unknown>;
}

export const ModalShell: React.FC<ModalShellProps> = ({
    isOpen,
    onClose,
    children,
    layer = 'window',
    locked = false,
    closeOnBackdrop = true,
    backdropOptions,
    frame = true,
    className,
    style,
    panelProps,
}) => {
    useEscapeClose(isOpen, () => {
        if (!locked) onClose();
    });

    if (!isOpen) return null;

    const canBackdropClose = closeOnBackdrop && !locked;

    return createPortal(
        <div data-modal-shell className={clsx('fixed inset-0 flex items-center justify-center p-4', LAYER_CLASS[layer])}>
            <div
                data-modal-backdrop
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]"
                {...backdropClose(canBackdropClose ? onClose : undefined, backdropOptions)}
            />
            <div
                role="dialog"
                aria-modal="true"
                {...panelProps}
                // 窓の中のクリックを React ツリー上の親(窓を開いたボタンの入れ物など)へ伝えない
                onClick={(e) => {
                    e.stopPropagation();
                    panelProps?.onClick?.(e);
                }}
                className={clsx(
                    'relative animate-[dialogIn_200ms_cubic-bezier(0.2,0.8,0.2,1)]',
                    frame && 'float-surface rounded-2xl overflow-hidden flex flex-col max-h-full',
                    className,
                )}
                style={style}
            >
                {children}
            </div>
        </div>,
        document.body,
    );
};
