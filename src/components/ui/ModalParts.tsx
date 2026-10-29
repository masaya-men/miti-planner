import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';

/**
 * 窓の中身の共通部品(2026-10-26 masaya 選択: 見出し=太字だけ / × =角丸の四角 / 決定=青 / キャンセル=枠なし / 入力欄=角丸小さめ・白地)。
 * ModalShell の中で使う。新しい窓はここの部品で組む。
 */

/** 閉じる × ボタン(26px 角・角丸の四角・ホバーで反転) */
export const CloseButton: React.FC<{
    onClick: () => void;
    label: string;
    disabled?: boolean;
    className?: string;
}> = ({ onClick, label, disabled, className }) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={clsx(
            'shrink-0 p-1 rounded-lg text-app-text border border-transparent transition-all duration-200 cursor-pointer active:scale-90',
            'hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle',
            'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-app-text disabled:hover:border-transparent',
            className,
        )}
    >
        <X size={16} />
    </button>
);

/** 窓の見出し行(太字の見出し+右端に ×)。icon は見出しの左、extra は × の左に置く */
export const ModalHeader: React.FC<{
    title: React.ReactNode;
    onClose?: () => void;
    closeLabel?: string;
    closeDisabled?: boolean;
    icon?: React.ReactNode;
    extra?: React.ReactNode;
    className?: string;
}> = ({ title, onClose, closeLabel = 'close', closeDisabled, icon, extra, className }) => (
    <div className={clsx('flex items-center justify-between gap-3 px-5 py-4 border-b border-app-border shrink-0', className)}>
        <h2 className="min-w-0 flex items-center gap-2 text-app-2xl font-bold text-app-text">
            {icon}
            <span className="min-w-0">{title}</span>
        </h2>
        <div className="flex items-center gap-2">
            {extra}
            {onClose && <CloseButton onClick={onClose} label={closeLabel} disabled={closeDisabled} />}
        </div>
    </div>
);

/** 窓の下のボタン列(右寄せ) */
export const ModalFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
    <div className={clsx('flex items-center justify-end gap-2 px-5 py-3 border-t border-app-border shrink-0', className)}>
        {children}
    </div>
);

const BUTTON_VARIANT = {
    /** 決定・先に進む */
    primary: 'bg-app-blue text-white border-app-blue hover:bg-app-blue-hover hover:border-app-blue-hover',
    /** キャンセル・戻る(枠なし) */
    secondary: 'bg-transparent text-app-text border-transparent hover:bg-app-toggle hover:text-app-toggle-text hover:border-app-toggle',
    /** 削除など取り消せない決定 */
    danger: 'bg-app-red text-white border-app-red hover:bg-app-red-hover hover:border-app-red-hover',
    /** 注意して進む決定 */
    warning: 'bg-app-amber text-white border-app-amber hover:bg-app-amber-hover hover:border-app-amber-hover',
} as const;

export type ModalButtonVariant = keyof typeof BUTTON_VARIANT;

const BUTTON_SIZE = {
    /** 窓の下の標準 */
    md: 'gap-1.5 px-4 py-1.5 rounded-md text-app-lg',
    /** 大きい決定(スマホの横幅いっぱい等)。高さ・横幅は置き場所が className で決める */
    lg: 'gap-2 rounded-xl text-app-2xl',
} as const;

export type ModalButtonSize = keyof typeof BUTTON_SIZE;

/** 窓のボタン。variant で役割を選ぶ(見た目は役割ごとに 1 つ)。size は標準か大きい決定か */
export const ModalButton: React.FC<
    React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ModalButtonVariant; size?: ModalButtonSize }
> = ({ variant = 'secondary', size = 'md', className, type = 'button', ...rest }) => (
    <button
        type={type}
        {...rest}
        className={clsx(
            'inline-flex items-center justify-center border font-bold transition-colors duration-150 cursor-pointer active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
            BUTTON_SIZE[size],
            BUTTON_VARIANT[variant],
            className,
        )}
    />
);

/**
 * 入力欄(input / textarea / select)の共通クラス。角丸小さめ・白地(ダークは一段明るい面)。
 * 文字は 16px(iPhone で入力時に画面が拡大されるのを防ぐ)→ PC では text-app-2xl。
 */
export const INPUT_CLASS =
    'w-full bg-app-surface2 border border-app-border rounded-lg px-2.5 py-2 text-app-2xl-plus md:text-app-2xl text-app-text placeholder-app-text-muted focus:border-app-text focus:outline-none transition-colors disabled:opacity-50';
