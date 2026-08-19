// src/components/PartyVisibilityMenu.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { getSortedPartyMemberIds } from '../constants/party';
import { Tooltip } from './ui/Tooltip';
import { SPRING } from '../tokens/motionTokens';
import { useRenderPendingStore } from '../store/useRenderPendingStore';

interface PartyVisibilityMenuProps {
    /** 非表示メンバーがいない時のアイコンボタン共通クラス (iconBtnBase+iconBtnDefault、形状込み) */
    btnClassName: string;
    /** 非表示メンバーが1人でもいる間に使う完全版クラス (iconBtnBase+iconBtnActive、形状込み) */
    btnActiveClassName: string;
    sortOrder: 'light_party' | 'role';
    readOnly: boolean;
}

const CELL = 36;
const GAP = 6;
const PANEL_PADDING = 8;
const GRID_CONTENT_W = 4 * CELL + 3 * GAP;
const GRID_CONTENT_H = 2 * CELL + GAP;
const PANEL_W = GRID_CONTENT_W + PANEL_PADDING * 2;
const PANEL_H = GRID_CONTENT_H + PANEL_PADDING * 2;
const VIEWPORT_PADDING = 8;

interface Pos {
    left: number;
    top: number;
}

// 個々のジョブアイコンがパネル内でバネ付きでポップインする(MobileFABのfan-outチップと
// 同じ質感)。パネル自体がガラスの箱として先に出るため、こちらはCSS Grid内での
// scale/opacityアニメだけで良い(位置計算が不要になった)。
// SPRING.bouncy(damping低め)は着地後も揺れ続けて気持ち悪いため、ポップイン後すぐ収まる
// SPRING.default(高めのdamping)を使う。overshootは軽く残るが往復振動はしない。
const cellVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: (i: number) => ({
        scale: 1,
        opacity: 1,
        transition: { ...SPRING.default, delay: i * 0.04 },
    }),
    exit: { scale: 0, opacity: 0, transition: { duration: 0.12, ease: 'easeIn' as const } },
};

/**
 * ヘッダーの「表示メンバー絞り込み」ボタン。見た目だけの絞り込みで、
 * 自動配置・競合チェック・ダメージ計算には一切影響しない(裏では8人分そのまま処理される)。
 *
 * ポップオーバーはガラスの箱(glass-tier3、モーダル/ポップオーバー用の正規トークン)に
 * 収めた上で、中のジョブアイコンは1個ずつバネでポップインする。箱を無くしていた前バージョンは
 * すぐ後ろのタイムライン列アイコンと誤クリックしやすかったため、視覚的に区切るために復活させた。
 *
 * 開閉はホバー主体(トリガーとパネルの間に150msの猶予を持たせ、その間にマウスが移動しても
 * 閉じない)。クリック/フォーカスでも開けるため、キーボード操作でも迷子にならない。
 * パネルはトリガーの中央下に出し、画面端では左右クランプ・上下反転で画面内に収める。
 */
export function PartyVisibilityMenu({ btnClassName, btnActiveClassName, sortOrder, readOnly }: PartyVisibilityMenuProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const cancelClose = () => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    };
    const scheduleClose = () => {
        cancelClose();
        closeTimerRef.current = setTimeout(() => setOpen(false), 150);
    };
    useEffect(() => () => cancelClose(), []);

    const partyMembers = useMitigationStore(state => state.partyMembers);
    const hiddenPartyMemberIds = useMitigationStore(state => state.hiddenPartyMemberIds);
    const toggleHiddenPartyMember = useMitigationStore(state => state.toggleHiddenPartyMember);
    const jobs = useJobs();

    const cells = React.useMemo(() => {
        return getSortedPartyMemberIds(sortOrder).map((id) => {
            const member = partyMembers.find(m => m.id === id);
            const job = member?.jobId ? jobs.find(j => j.id === member.jobId) : null;
            return { id, icon: job?.icon ?? null, hidden: hiddenPartyMemberIds.includes(id) };
        });
    }, [partyMembers, sortOrder, hiddenPartyMemberIds, jobs]);

    const hasHidden = hiddenPartyMemberIds.length > 0;

    // Timeline全体の重い再描画(実測: 数百ms級)を伴うため、先にインジケーターを1フレーム
    // 描かせてから本体のトグルを実行する(同期的に両方呼ぶとインジケーターの表示自体が
    // 重い描画に巻き込まれ、ユーザーからは何も表示されないまま固まって見える)。
    const handleToggleMember = (id: string) => {
        useRenderPendingStore.getState().show();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toggleHiddenPartyMember(id);
            });
        });
    };

    // パネル位置: トリガーの中央下が基本。画面端では収まるように補正する
    // (右にはみ出す→左にクランプ、下にはみ出す→ボタンの上に反転)。
    const [pos, setPos] = useState<Pos | null>(null);
    useEffect(() => {
        if (!open || !btnRef.current) {
            setPos(null);
            return;
        }
        const r = btnRef.current.getBoundingClientRect();
        let left = r.left + r.width / 2 - PANEL_W / 2;
        let top = r.bottom + 4;
        if (left + PANEL_W > window.innerWidth - VIEWPORT_PADDING) {
            left = window.innerWidth - VIEWPORT_PADDING - PANEL_W;
        }
        if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;
        if (top + PANEL_H > window.innerHeight - VIEWPORT_PADDING) {
            top = r.top - 4 - PANEL_H;
        }
        if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;
        setPos({ left, top });
    }, [open]);

    // 外側クリックで閉じる(キーボード/フォーカスで開いた場合の安全網)。
    useEffect(() => {
        if (!open) return;
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (btnRef.current?.contains(target)) return;
            if (panelRef.current?.contains(target)) return;
            setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    return (
        <>
            <Tooltip content={t('ui.party_visibility')}>
                <button
                    ref={btnRef}
                    type="button"
                    disabled={readOnly}
                    onClick={() => setOpen(prev => !prev)}
                    onMouseEnter={() => { cancelClose(); setOpen(true); }}
                    onMouseLeave={scheduleClose}
                    onFocus={() => { cancelClose(); setOpen(true); }}
                    className={clsx(hasHidden ? btnActiveClassName : btnClassName, readOnly && 'opacity-50 pointer-events-none', 'group/eye')}
                    aria-label={t('ui.party_visibility')}
                >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                        <g
                            className="group-hover/eye:animate-gear-spin-once"
                            style={{ transformOrigin: 'center center' }}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.5"
                        >
                            <path stroke="currentColor" d="M5.262 15.329l.486.842a1.49 1.49 0 002.035.55 1.486 1.486 0 012.036.529c.128.216.197.463.2.714a1.493 1.493 0 001.493 1.536h.979a1.486 1.486 0 001.485-1.493 1.493 1.493 0 011.493-1.471c.252.002.498.071.714.2a1.493 1.493 0 002.036-.55l.521-.857a1.493 1.493 0 00-.542-2.036 1.493 1.493 0 010-2.586c.71-.41.952-1.318.543-2.028l-.493-.85a1.493 1.493 0 00-2.036-.579 1.479 1.479 0 01-2.029-.543 1.428 1.428 0 01-.2-.714c0-.825-.668-1.493-1.492-1.493h-.98c-.82 0-1.488.664-1.492 1.486a1.485 1.485 0 01-1.493 1.493 1.521 1.521 0 01-.714-.2 1.493 1.493 0 00-2.036.542l-.514.858a1.486 1.486 0 00.543 2.035 1.486 1.486 0 01.543 2.036c-.13.226-.317.413-.543.543a1.493 1.493 0 00-.543 2.028v.008z" />
                            <path stroke="currentColor" d="M12.044 10.147a1.853 1.853 0 100 3.706 1.853 1.853 0 000-3.706z" />
                        </g>
                    </svg>
                </button>
            </Tooltip>

            {pos && createPortal(
                <AnimatePresence>
                    {open && (
                        <motion.div
                            ref={panelRef}
                            key="party-visibility-panel"
                            initial={{ opacity: 0, scale: 0.85 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={SPRING.default}
                            onMouseEnter={cancelClose}
                            onMouseLeave={scheduleClose}
                            className="glass-tier3 fixed grid grid-cols-4 gap-1.5 p-2 rounded-2xl z-[99999]"
                            style={{ left: pos.left, top: pos.top }}
                        >
                            {cells.map((m, i) => (
                                <Tooltip
                                    key={m.id}
                                    content={t('ui.party_visibility_toggle_tooltip', {
                                        id: m.id,
                                        action: m.hidden ? t('ui.party_visibility_show') : t('ui.party_visibility_hide'),
                                    })}
                                >
                                    <motion.button
                                        type="button"
                                        custom={i}
                                        variants={cellVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                        onClick={() => handleToggleMember(m.id)}
                                        className="group flex items-center justify-center rounded-lg cursor-pointer active:scale-90"
                                        style={{ width: CELL, height: CELL }}
                                    >
                                        {m.icon && (
                                            <img
                                                src={m.icon}
                                                alt={m.id}
                                                className={clsx(
                                                    'w-7 h-7 rounded-md object-cover transition-transform duration-150 group-hover:scale-110',
                                                    m.hidden && 'opacity-30 grayscale scale-90'
                                                )}
                                            />
                                        )}
                                    </motion.button>
                                </Tooltip>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
}
