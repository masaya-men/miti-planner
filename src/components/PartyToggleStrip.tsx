// 標準ヘッダー右グループの「表示メンバー」トグル帯(ALL + 8 人)。
// 見た目だけの絞り込みで、自動配置・競合チェック・ダメージ計算には影響しない。
// 全表示/全非表示/反転/ダブルクリックは作らない(ALL = 全員表示のみ)。
import React from 'react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { useMitigationStore } from '../store/useMitigationStore';
import { useJobs } from '../hooks/useSkillsData';
import { PARTY_MEMBER_IDS } from '../constants/party';
import { Tooltip } from './ui/Tooltip';
import { useRenderPendingStore } from '../store/useRenderPendingStore';

interface PartyToggleStripProps {
    /** トグル 1 つの直径(px) */
    size?: number;
}

/** id から役割を引く(MT/ST=tank, H*=healer, D*=dps)。区切り線の判定用。 */
function roleOfId(id: string): 'tank' | 'healer' | 'dps' {
    if (id === 'MT' || id === 'ST') return 'tank';
    return id.startsWith('H') ? 'healer' : 'dps';
}

export function PartyToggleStrip({ size = 22 }: PartyToggleStripProps) {
    const { t } = useTranslation();
    const partyMembers = useMitigationStore(s => s.partyMembers);
    const hiddenPartyMemberIds = useMitigationStore(s => s.hiddenPartyMemberIds);
    const toggleHiddenPartyMember = useMitigationStore(s => s.toggleHiddenPartyMember);
    const setHiddenPartyMemberIds = useMitigationStore(s => s.setHiddenPartyMemberIds);
    const jobs = useJobs();

    // 並びは「並び替え」設定に関係なく固定: タンク | ヒーラー | DPS(MT ST | H1 H2 | D1〜D4)
    const ids = PARTY_MEMBER_IDS;
    const allShown = hiddenPartyMemberIds.length === 0;
    const iconPx = Math.round(size * 18 / 22);

    // Timeline 全体の重い再描画を伴うため、先にインジケーターを 1 フレーム描かせてから本体を実行する
    // (PartyVisibilityMenu と同じ段取り)。
    const runAfterIndicator = (fn: () => void) => {
        useRenderPendingStore.getState().show();
        requestAnimationFrame(() => {
            requestAnimationFrame(fn);
        });
    };

    return (
        <div className="h-8 rounded-full border border-app-border px-[5px] flex items-center gap-px">
            <Tooltip content={t('ui.party_visibility_all_tooltip')}>
                <button
                    type="button"
                    aria-label={t('ui.party_visibility_all_tooltip')}
                    // 全員表示中は何もしない(列が変わらず「更新中」表示を消す契機が来ないため出しっぱなしになる)
                    onClick={() => { if (!allShown) runAfterIndicator(() => setHiddenPartyMemberIds([])); }}
                    className={clsx(
                        'text-app-base font-black tracking-[0.06em] px-1.5 h-[22px] rounded-full cursor-pointer text-app-text',
                        allShown ? 'bg-app-text/10' : 'hover:bg-app-text/10',
                    )}
                >
                    {t('ui.party_visibility_all')}
                </button>
            </Tooltip>
            <div className="w-px h-4 bg-app-text/20 mx-[3px]" />
            {ids.map((id, i) => {
                const member = partyMembers.find(m => m.id === id);
                const icon = member?.jobId ? jobs.find(j => j.id === member.jobId)?.icon ?? null : null;
                const hidden = hiddenPartyMemberIds.includes(id);
                const prev = i > 0 ? ids[i - 1] : null;
                const sep = prev !== null && roleOfId(prev) !== roleOfId(id);
                const action = hidden ? t('ui.party_visibility_show') : t('ui.party_visibility_hide');
                return (
                    <React.Fragment key={id}>
                        {sep && <div data-member-sep className="w-px h-4 bg-app-text/20 mx-[3px]" />}
                        <Tooltip content={t('ui.party_visibility_toggle_tooltip', { id, action })}>
                            <button
                                type="button"
                                data-member-toggle={id}
                                aria-pressed={!hidden}
                                aria-label={t('ui.party_visibility_toggle_tooltip', { id, action })}
                                onClick={() => runAfterIndicator(() => toggleHiddenPartyMember(id))}
                                style={{ width: size, height: size }}
                                className={clsx(
                                    'flex items-center justify-center rounded-full cursor-pointer active:scale-90 transition-colors',
                                    hidden ? 'hover:bg-app-text/10' : 'bg-app-text/10',
                                )}
                            >
                                {icon ? (
                                    <img referrerPolicy="no-referrer"
                                        src={icon}
                                        alt=""
                                        style={{ width: iconPx, height: iconPx }}
                                        className={clsx('rounded object-cover transition-transform duration-150',
                                            hidden && 'grayscale opacity-30 scale-[.88]')}
                                    />
                                ) : (
                                    // ジョブ未設定の空席: ロール名を出す(PartyVisibilityMenu と同じ)
                                    <span className={clsx('text-app-sm font-black text-app-text/70 tracking-tight',
                                        hidden && 'opacity-30')}>
                                        {id}
                                    </span>
                                )}
                            </button>
                        </Tooltip>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
