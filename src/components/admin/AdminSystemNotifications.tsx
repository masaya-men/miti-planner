/**
 * 運営通知 管理画面
 * 一覧 (Firestore onSnapshot 直接購読、 rules で read=public)
 * 投稿 / 編集 / 公開停止 toggle / 削除 (apiFetch で admin API 経由、 admin SDK で書き込み)
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  collection,
  getFirestore,
  orderBy,
  query,
  onSnapshot,
} from 'firebase/firestore';
import { Pencil, Trash2, Eye, EyeOff, Plus } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import type { SystemNotification, LocalizedText } from '../../types/systemNotification';
import { AdminPage } from './AdminPage';

function emptyLocalized(): LocalizedText {
  return { ja: '', en: '' };
}

interface EditState {
  isOpen: boolean;
  editing: SystemNotification | null; // null = 新規
}

export const AdminSystemNotifications: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<SystemNotification[]>([]);
  const [edit, setEdit] = useState<EditState>({ isOpen: false, editing: null });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const q = query(collection(getFirestore(), 'system_notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SystemNotification, 'id'>) }));
      setItems(next);
    });
    return () => unsub();
  }, []);

  function openNew() {
    setEdit({ isOpen: true, editing: null });
    setErrorMsg('');
  }

  function openEdit(item: SystemNotification) {
    setEdit({ isOpen: true, editing: item });
    setErrorMsg('');
  }

  async function save(payload: {
    id?: string;
    title: LocalizedText;
    body: LocalizedText;
    published: boolean;
  }) {
    setSaving(true);
    setErrorMsg('');
    try {
      const method = payload.id ? 'PATCH' : 'POST';
      const res = await apiFetch('/api/admin?resource=system_notifications', {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('save_failed');
      setEdit({ isOpen: false, editing: null });
    } catch {
      setErrorMsg(t('system_notif.admin.save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(item: SystemNotification) {
    await apiFetch('/api/admin?resource=system_notifications', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id, published: !item.published }),
    });
  }

  async function remove(item: SystemNotification) {
    if (!confirm(t('system_notif.admin.delete_confirm'))) return;
    await apiFetch('/api/admin?resource=system_notifications', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: item.id }),
    });
  }

  return (
    <AdminPage
      title={t('system_notif.admin.page_title')}
      actions={
        <button
          type="button"
          onClick={openNew}
          className="px-3 py-2 rounded bg-app-text text-app-bg text-app-base font-bold hover:opacity-90 transition-opacity flex items-center gap-1"
        >
          <Plus size={16} /> {t('system_notif.admin.new_button')}
        </button>
      }
    >
      {items.length === 0 ? (
        <div className="text-app-text-muted py-8 text-center">{t('system_notif.admin.list_empty')}</div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="border border-app-text/15 rounded p-3 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{item.title.ja}</div>
                <div className="text-app-sm text-app-text-muted truncate">{item.body.ja}</div>
                <div className="text-app-xs text-app-text-muted mt-1">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-app-xs ${item.published ? 'bg-app-text/15' : 'bg-app-text/5 text-app-text-muted'}`}
              >
                {item.published ? t('system_notif.admin.publish_on') : t('system_notif.admin.publish_off')}
              </span>
              <button
                type="button"
                onClick={() => togglePublish(item)}
                aria-label={t('system_notif.admin.toggle_publish')}
                className="p-2 rounded hover:bg-app-text/10"
              >
                {item.published ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                onClick={() => openEdit(item)}
                aria-label={t('system_notif.admin.edit')}
                className="p-2 rounded hover:bg-app-text/10"
              >
                <Pencil size={16} />
              </button>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={t('system_notif.admin.delete')}
                className="p-2 rounded hover:bg-red-500/15 text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {edit.isOpen && (
        <EditModal
          initial={edit.editing}
          onCancel={() => setEdit({ isOpen: false, editing: null })}
          onSave={save}
          saving={saving}
          errorMsg={errorMsg}
        />
      )}
    </AdminPage>
  );
};

// ─────────────────────────────────────────────
// EditModal (内部コンポーネント)
// ─────────────────────────────────────────────

const EditModal: React.FC<{
  initial: SystemNotification | null;
  onCancel: () => void;
  onSave: (payload: {
    id?: string;
    title: LocalizedText;
    body: LocalizedText;
    published: boolean;
  }) => void;
  saving: boolean;
  errorMsg: string;
}> = ({ initial, onCancel, onSave, saving, errorMsg }) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState<LocalizedText>(initial?.title ?? emptyLocalized());
  const [body, setBody] = useState<LocalizedText>(initial?.body ?? emptyLocalized());
  const [published, setPublished] = useState<boolean>(initial?.published ?? true);

  const valid = title.ja && title.en && body.ja && body.en;

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="w-[min(640px,100%)] max-h-[90vh] overflow-auto bg-app-bg border border-app-text/15 rounded p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-app-xl font-bold mb-4">{initial ? t('system_notif.admin.edit') : t('system_notif.admin.new_button')}</h2>

        {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
          <div key={`title-${lang}`} className="mb-3">
            <label className="block text-app-sm mb-1">{t(`system_notif.admin.field_title_${lang}`)}</label>
            <input
              type="text"
              value={title[lang] ?? ''}
              onChange={(e) => setTitle({ ...title, [lang]: e.target.value })}
              className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base"
            />
          </div>
        ))}

        {(['ja', 'en', 'ko', 'zh'] as const).map((lang) => (
          <div key={`body-${lang}`} className="mb-3">
            <label className="block text-app-sm mb-1">{t(`system_notif.admin.field_body_${lang}`)}</label>
            <textarea
              value={body[lang] ?? ''}
              onChange={(e) => setBody({ ...body, [lang]: e.target.value })}
              rows={4}
              className="w-full px-2 py-1 bg-app-bg border border-app-text/20 rounded text-app-base"
            />
          </div>
        ))}

        <label className="flex items-center gap-2 mb-4">
          <input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          <span className="text-app-base">{t('system_notif.admin.field_published')}</span>
        </label>

        {errorMsg && <div className="text-red-500 text-app-sm mb-3">{errorMsg}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded border border-app-text/20"
          >
            {t('system_notif.admin.cancel')}
          </button>
          <button
            type="button"
            disabled={!valid || saving}
            onClick={() => onSave({
              id: initial?.id,
              title,
              body,
              published,
            })}
            className="px-3 py-1.5 rounded bg-app-text text-app-bg font-bold disabled:opacity-50"
          >
            {t('system_notif.admin.save')}
          </button>
        </div>
      </div>
    </div>
  );
};
