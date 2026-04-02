/**
 * 管理画面ダッシュボード
 * アクションカード・最近の変更・バックアップ復元への導線を表示
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../../lib/apiClient';

// ---- 型定義 ----
interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  target: string;
  timestamp?: { _seconds: number };
  adminUid?: string;
}

// ---- ヘルパー関数 ----
function relativeTime(seconds: number, isJa: boolean): string {
  const diff = Date.now() / 1000 - seconds;
  if (diff < 60) return isJa ? 'たった今' : 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}${isJa ? '分前' : 'm ago'}`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}${isJa ? '時間前' : 'h ago'}`;
  return `${Math.floor(diff / 86400)}${isJa ? '日前' : 'd ago'}`;
}

function parseTarget(target: string, isJa: boolean): string {
  if (target.startsWith('template.')) return `${isJa ? 'テンプレート' : 'Template'} ${target.slice(9)}`;
  if (target.startsWith('content.')) return `${isJa ? 'コンテンツ' : 'Content'} ${target.slice(8)}`;
  if (target.startsWith('backup.')) return isJa ? 'バックアップ' : 'Backup';
  if (target === 'skills') return isJa ? 'スキル' : 'Skills';
  if (target === 'stats') return isJa ? 'ステータス' : 'Stats';
  if (target === 'config') return isJa ? '設定' : 'Settings';
  if (target === 'servers') return isJa ? 'サーバー' : 'Servers';
  return target;
}

// ---- アクションカードの定義 ----
const ACTION_CARDS = [
  {
    titleKey: 'admin.dash_add_content' as const,
    descKey: 'admin.dash_add_content_desc' as const,
    route: '/admin/content-wizard',
  },
  {
    titleKey: 'admin.dash_add_template' as const,
    descKey: 'admin.dash_add_template_desc' as const,
    route: '/admin/template-wizard',
  },
  {
    titleKey: 'admin.dash_edit_skills' as const,
    descKey: 'admin.dash_edit_skills_desc' as const,
    route: '/admin/skill-wizard',
  },
  {
    titleKey: 'admin.dash_edit_stats' as const,
    descKey: 'admin.dash_edit_stats_desc' as const,
    route: '/admin/stats-wizard',
  },
  {
    titleKey: 'admin.dash_edit_servers' as const,
    descKey: 'admin.dash_edit_servers_desc' as const,
    route: '/admin/servers',
  },
  {
    titleKey: 'admin.dash_config' as const,
    descKey: 'admin.dash_config_desc' as const,
    route: '/admin/config',
  },
] as const;

// ---- コンポーネント ----
export function AdminDashboard() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isJa = i18n.language.startsWith('ja');

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      try {
        const res = await apiFetch('/api/admin?resource=templates&type=logs');
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setLogs((data.logs ?? []).slice(0, 5));
        }
      } catch {
        // ログ取得失敗は無視（セクション自体は表示）
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    }
    loadLogs();
    return () => { cancelled = true; };
  }, []);

  const actionLabel = (action: AuditLog['action']): string => {
    switch (action) {
      case 'create': return t('admin.logs_action_create');
      case 'update': return t('admin.logs_action_update');
      case 'delete': return t('admin.logs_action_delete');
      case 'restore': return t('admin.logs_action_restore');
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="text-app-3xl font-bold">{t('admin.dashboard')}</h1>

      {/* セクション 1: アクションカード */}
      <section>
        <h2 className="text-app-2xl font-semibold mb-4 text-[var(--app-text-muted)] uppercase tracking-wide">
          {t('admin.dash_what_to_do')}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ACTION_CARDS.map((card) => (
            <button
              key={card.route}
              onClick={() => navigate(card.route)}
              className="border border-[var(--app-text)]/20 p-6 text-left hover:border-[var(--app-text)]/40 hover:bg-[var(--app-text)]/5 transition-colors"
            >
              <div className="text-app-2xl font-bold">{t(card.titleKey)}</div>
              <div className="text-app-lg text-[var(--app-text-muted)] mt-1">{t(card.descKey)}</div>
            </button>
          ))}
        </div>
      </section>

      {/* セクション 2: 最近の変更 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-app-2xl font-semibold text-[var(--app-text-muted)] uppercase tracking-wide">
            {t('admin.dash_recent_changes')}
          </h2>
          <button
            onClick={() => navigate('/admin/logs')}
            className="text-app-lg underline underline-offset-2 hover:opacity-60 transition-opacity"
          >
            {t('admin.dash_view_all')}
          </button>
        </div>

        {logsLoading ? (
          <p className="text-app-lg text-[var(--app-text-muted)]">{t('common.loading')}</p>
        ) : logs.length === 0 ? (
          <p className="text-app-lg text-[var(--app-text-muted)]">{t('admin.dash_no_recent')}</p>
        ) : (
          <div className="divide-y divide-[var(--app-text)]/10 border border-[var(--app-text)]/10">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-app-lg font-mono shrink-0 opacity-70">{actionLabel(log.action)}</span>
                  <span className="text-app-lg truncate">{parseTarget(log.target, isJa)}</span>
                </div>
                <span className="text-app-lg text-[var(--app-text-muted)] shrink-0">
                  {log.timestamp ? relativeTime(log.timestamp._seconds, isJa) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* セクション 3: バックアップから復元 */}
      <section>
        <button
          onClick={() => navigate('/admin/backups')}
          className="border border-[var(--app-text)]/20 p-4 text-left hover:border-[var(--app-text)]/40 hover:bg-[var(--app-text)]/5 transition-colors w-full"
        >
          <div className="text-app-2xl font-bold">{t('admin.dash_restore_backup')}</div>
        </button>
      </section>
    </div>
  );
}
