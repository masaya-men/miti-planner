/**
 * LoginModal 内に配置する SNS アカウント連携セクション (Phase B-2)
 *
 * 連携済み / 未連携を出し分け、 連携ボタン → 警告ダイアログ → OAuth 開始、
 * 解除ボタン → 解除確認 → 削除 + トースト。
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    getLinkedProviders,
    unlinkAccount,
    startLinkFlow,
    type LinkProvider,
    type LinkedProviders,
} from '../lib/accountLinks';
import { useAuthStore } from '../store/useAuthStore';
import { ConfirmDialog } from './ConfirmDialog';
import { showToast } from './Toast';

const PROVIDER_LABEL: Record<LinkProvider, string> = {
    discord: 'Discord',
    twitter: 'X (Twitter)',
};

function detectCurrentProvider(uid: string | undefined | null): LinkProvider | null {
    if (!uid) return null;
    if (uid.startsWith('discord:')) return 'discord';
    if (uid.startsWith('twitter:')) return 'twitter';
    return null;
}

export function AccountLinkSection() {
    const { t } = useTranslation();
    const user = useAuthStore(s => s.user);
    const [links, setLinks] = useState<LinkedProviders | null>(null);
    const [loading, setLoading] = useState(true);
    const [linkConfirm, setLinkConfirm] = useState<LinkProvider | null>(null);
    const [unlinkConfirm, setUnlinkConfirm] = useState<LinkProvider | null>(null);

    const currentProvider = detectCurrentProvider(user?.uid);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        (async () => {
            try {
                const result = await getLinkedProviders();
                if (!cancelled) setLinks(result);
            } catch (e) {
                console.error('getLinkedProviders failed', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    useEffect(() => {
        const completed = localStorage.getItem('lopo_link_completed');
        if (completed) {
            try {
                const { provider } = JSON.parse(completed);
                showToast(
                    t('account_link.toast_link_success', { provider: PROVIDER_LABEL[provider as LinkProvider] }),
                    'success',
                );
            } catch {
                // ignore parse error
            }
            localStorage.removeItem('lopo_link_completed');
        }
        const errorCode = localStorage.getItem('lopo_link_error');
        if (errorCode) {
            showToast(t('account_link.toast_link_error'), 'error');
            localStorage.removeItem('lopo_link_error');
        }
    }, [t]);

    const handleLink = async (provider: LinkProvider) => {
        setLinkConfirm(null);
        try {
            await startLinkFlow(provider);
            // 遷移するのでこの後の return には来ない
        } catch (e) {
            console.error('startLinkFlow failed', e);
            showToast(t('account_link.toast_link_error'), 'error');
        }
    };

    const handleUnlink = async (provider: LinkProvider) => {
        setUnlinkConfirm(null);
        try {
            await unlinkAccount(provider);
            const result = await getLinkedProviders();
            setLinks(result);
            showToast(
                t('account_link.toast_unlink_success', { provider: PROVIDER_LABEL[provider] }),
                'success',
            );
        } catch (e) {
            console.error('unlinkAccount failed', e);
            showToast(t('account_link.toast_unlink_error'), 'error');
        }
    };

    if (!user) return null;
    if (loading || !links) return null;

    const linkedProviders = (['discord', 'twitter'] as const).filter(p => links[p]);
    const unlinkedProviders = (['discord', 'twitter'] as const).filter(p => !links[p]);

    return (
        <div className="space-y-4 mb-4">
            {/* 連携済みセクション */}
            {linkedProviders.length > 0 && (
                <div>
                    <h3 className="text-app-xs font-bold uppercase tracking-wider text-app-text-muted mb-2">
                        {t('account_link.linked_section')}
                    </h3>
                    <ul className="space-y-2">
                        {linkedProviders.map(p => (
                            <li
                                key={p}
                                className="flex items-center justify-between px-3 py-2 rounded-xl border border-app-border bg-app-surface2/30"
                            >
                                <span className="text-app-md text-app-text flex items-center gap-2">
                                    <span className="text-app-toggle">✓</span>
                                    {PROVIDER_LABEL[p]}
                                    {currentProvider === p && (
                                        <span className="ml-1 text-app-xs text-app-text-muted">
                                            ({t('account_link.current_login_badge')})
                                        </span>
                                    )}
                                </span>
                                {currentProvider !== p && (
                                    <button
                                        type="button"
                                        onClick={() => setUnlinkConfirm(p)}
                                        className="text-app-xs text-app-red hover:bg-app-red-dim px-2 py-1 rounded transition-colors cursor-pointer"
                                    >
                                        {t('account_link.unlink_button')}
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 未連携セクション */}
            {unlinkedProviders.length > 0 && (
                <div>
                    <h3 className="text-app-xs font-bold uppercase tracking-wider text-app-text-muted mb-2">
                        {t('account_link.unlinked_section')}
                    </h3>
                    <p className="text-app-xs text-app-text-muted/70 mb-2">
                        {t('account_link.benefit_text')}
                    </p>
                    <ul className="space-y-2">
                        {unlinkedProviders.map(p => (
                            <li
                                key={p}
                                className="flex items-center justify-between px-3 py-2 rounded-xl border border-app-border"
                            >
                                <span className="text-app-md text-app-text">{PROVIDER_LABEL[p]}</span>
                                <button
                                    type="button"
                                    onClick={() => setLinkConfirm(p)}
                                    className="text-app-xs px-3 py-1 rounded-lg border border-app-border hover:bg-app-surface2 hover:border-app-text/30 transition-colors cursor-pointer"
                                >
                                    {t('account_link.link_button')}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 連携確認ダイアログ */}
            {linkConfirm && (
                <ConfirmDialog
                    isOpen
                    title={t('account_link.confirm_link_title', { provider: PROVIDER_LABEL[linkConfirm] })}
                    message={
                        t('account_link.confirm_link_body', { provider: PROVIDER_LABEL[linkConfirm] })
                        + '\n\n⚠ '
                        + t('account_link.confirm_link_warning', { provider: PROVIDER_LABEL[linkConfirm] })
                    }
                    confirmLabel={t('account_link.confirm_link_cta')}
                    cancelLabel={t('account_link.confirm_link_cancel')}
                    variant="warning"
                    onConfirm={() => handleLink(linkConfirm)}
                    onCancel={() => setLinkConfirm(null)}
                />
            )}

            {/* 解除確認ダイアログ */}
            {unlinkConfirm && (
                <ConfirmDialog
                    isOpen
                    title={t('account_link.confirm_unlink_title', { provider: PROVIDER_LABEL[unlinkConfirm] })}
                    message={t('account_link.confirm_unlink_body', { provider: PROVIDER_LABEL[unlinkConfirm] })}
                    confirmLabel={t('account_link.unlink_button')}
                    cancelLabel={t('account_link.confirm_link_cancel')}
                    variant="danger"
                    onConfirm={() => handleUnlink(unlinkConfirm)}
                    onCancel={() => setUnlinkConfirm(null)}
                />
            )}
        </div>
    );
}
