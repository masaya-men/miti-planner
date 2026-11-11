/**
 * ハウジング「色の取り直し」管理画面 (色で探す・2026-11-12)
 *
 * 色がまだ無い既存の家について、管理者のブラウザで代表の写真から色を計算して保存する。
 * 押す順番は 2 つだけ: ①「始める」(途中で止めても続きから)→ ②「反映する」(最後に 1 回だけ)。
 * 反映するまで、利用者の画面は変わらない。
 */
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { AdminPage } from './AdminPage';
import { useHousingColorBackfill } from './useHousingColorBackfill';
import { buildListingDetailPath } from '../../constants/housing';

const BTN_MAIN = 'flex items-center gap-1.5 px-4 py-2 rounded-lg bg-app-text text-app-bg font-semibold text-app-lg hover:opacity-90 transition-opacity disabled:opacity-40';
const BTN_SUB = 'px-4 py-2 rounded-lg border border-app-border text-app-text font-semibold text-app-lg hover:bg-app-surface2 transition-colors disabled:opacity-40';

export function AdminHousingColors() {
  const { t } = useTranslation();
  const b = useHousingColorBackfill();
  const running = b.phase === 'running';
  const busy = running || b.phase === 'publishing' || b.phase === 'loading';
  const percent = b.progress.total > 0 ? Math.round((b.progress.done / b.progress.total) * 100) : 0;

  return (
    <AdminPage title={t('admin.housing_colors.title')}>
      <div className="max-w-2xl flex flex-col gap-6">
        <p className="text-app-lg text-app-text-muted">{t('admin.housing_colors.description')}</p>

        {b.phase === 'loading' && (
          <div className="flex items-center gap-2 text-app-lg text-app-text-muted">
            <Loader2 size={14} className="animate-spin" />
            {t('admin.housing_colors.loading')}
          </div>
        )}

        {b.error && (
          <div className="p-3 rounded-lg bg-app-red-dim border border-app-red-border text-app-red text-app-lg">
            {t('admin.housing_colors.error', { message: b.error })}
          </div>
        )}

        {/* ① 始める */}
        <section className="border border-app-border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-app-lg">{t('admin.housing_colors.step1_title')}</h2>
          <p className="text-app-lg">{t('admin.housing_colors.count_pending', { count: b.pendingCount })}</p>
          {b.phase !== 'loading' && b.pendingCount === 0 && b.doneTotal === 0 && (
            <p className="text-app-lg text-app-text-muted">{t('admin.housing_colors.nothing_to_do')}</p>
          )}
          {running && (
            <div className="flex flex-col gap-1">
              <div className="h-2 rounded bg-app-surface2 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-app-text" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-app-lg text-app-text-muted">
                {t('admin.housing_colors.progress', { done: b.progress.done, total: b.progress.total })}
              </p>
            </div>
          )}
          <div className="flex gap-2">
            {!running && (
              <button className={BTN_MAIN} onClick={b.start} disabled={busy || b.freshCount === 0}>
                {b.doneTotal > 0 ? t('admin.housing_colors.resume') : t('admin.housing_colors.start')}
              </button>
            )}
            {running && (
              <button className={BTN_SUB} onClick={b.stop}>{t('admin.housing_colors.stop')}</button>
            )}
          </div>
          <p className="text-app-lg text-app-text-muted">{t('admin.housing_colors.start_hint')}</p>
          {b.doneTotal > 0 && (
            <p className="text-app-lg">{t('admin.housing_colors.count_done', { count: b.doneTotal })}</p>
          )}
        </section>

        {/* ② 反映する */}
        <section className="border border-app-border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="font-semibold text-app-lg">{t('admin.housing_colors.step2_title')}</h2>
          <p className="text-app-lg text-app-text-muted">{t('admin.housing_colors.publish_hint')}</p>
          <div className="flex gap-2">
            <button
              className={BTN_MAIN}
              onClick={() => { if (confirm(t('admin.housing_colors.publish_confirm'))) void b.publish(); }}
              disabled={busy || b.doneTotal === 0}
            >
              {b.phase === 'publishing' && <Loader2 size={14} className="animate-spin" />}
              {t('admin.housing_colors.publish')}
            </button>
          </div>
          {b.phase === 'published' && (
            <div className="p-3 rounded-lg bg-app-blue-dim border border-app-blue-border text-app-blue text-app-lg">
              {t('admin.housing_colors.published')}
            </div>
          )}
        </section>

        {/* 読めなかった家 */}
        {b.unreadable.length > 0 && (
          <section className="border border-app-border rounded-lg p-4 flex flex-col gap-3">
            <h2 className="font-semibold text-app-lg">{t('admin.housing_colors.unreadable_title', { count: b.unreadable.length })}</h2>
            <p className="text-app-lg text-app-text-muted">{t('admin.housing_colors.unreadable_hint')}</p>
            <ul className="flex flex-col gap-1 max-h-48 overflow-auto text-app-lg">
              {b.unreadable.map((u) => (
                <li key={u.id}>
                  <a className="underline" href={buildListingDetailPath(u.id)} target="_blank" rel="noreferrer">{u.id}</a>
                </li>
              ))}
            </ul>
            <div>
              <button className={BTN_SUB} onClick={b.retry} disabled={busy || b.retryCount === 0}>
                {t('admin.housing_colors.retry')}
              </button>
            </div>
          </section>
        )}
      </div>
    </AdminPage>
  );
}
