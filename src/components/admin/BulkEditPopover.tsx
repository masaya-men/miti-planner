/**
 * テンプレートエディター 一括変更ポップアップ
 * 選択された行のフィールドを一括で更新する
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BulkEditPopoverProps {
  selectedCount: number;
  onApply: (changes: Record<string, unknown>) => void;
  onClose: () => void;
}

const SENTINEL_NO_CHANGE = '__no_change__';

export function BulkEditPopover({ selectedCount, onApply, onClose }: BulkEditPopoverProps) {
  const { t } = useTranslation();
  const [nameJa, setNameJa] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [target, setTarget] = useState(SENTINEL_NO_CHANGE);
  const [damageAmount, setDamageAmount] = useState('');
  const [damageType, setDamageType] = useState(SENTINEL_NO_CHANGE);

  const handleApply = () => {
    const changes: Record<string, unknown> = {};
    if (nameJa) changes['name.ja'] = nameJa;
    if (nameEn) changes['name.en'] = nameEn;
    if (target !== SENTINEL_NO_CHANGE) changes['target'] = target;
    if (damageAmount) {
      const num = parseInt(damageAmount, 10);
      if (!isNaN(num)) changes['damageAmount'] = num;
    }
    if (damageType !== SENTINEL_NO_CHANGE) changes['damageType'] = damageType;

    if (Object.keys(changes).length > 0) {
      onApply(changes);
    }
    onClose();
  };

  const inputClass =
    'w-full px-2 py-1 text-app-lg bg-transparent border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text';
  const selectClass =
    'w-full px-2 py-1 text-app-lg bg-app-bg border border-app-text/20 rounded focus:outline-none focus:border-app-text/50 text-app-text [&>option]:bg-app-bg [&>option]:text-app-text';
  const labelClass = 'text-app-base text-app-text-muted';

  return (
    <div className="absolute top-full mt-1 right-0 z-50 bg-app-bg border border-app-text/20 rounded-lg p-4 shadow-lg min-w-[280px]">
      <h3 className="text-app-lg font-medium mb-3">
        {t('admin.tpl_bulk_edit_title', { count: selectedCount })}
      </h3>

      <div className="space-y-2">
        {/* 技名(JA) */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_name_ja')}</label>
          <input
            type="text"
            value={nameJa}
            onChange={(e) => setNameJa(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 技名(EN) */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_name_en')}</label>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 対象 */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_target')}</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={selectClass}>
            <option value={SENTINEL_NO_CHANGE}>{t('admin.tpl_bulk_edit_no_change')}</option>
            <option value="MT">MT</option>
            <option value="ST">ST</option>
            <option value="AoE">AoE</option>
          </select>
        </div>

        {/* ダメージ */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_damage')}</label>
          <input
            type="number"
            value={damageAmount}
            onChange={(e) => setDamageAmount(e.target.value)}
            placeholder={t('admin.tpl_bulk_edit_no_change')}
            className={inputClass}
          />
        </div>

        {/* 種別 */}
        <div>
          <label className={labelClass}>{t('admin.tpl_bulk_edit_damage_type')}</label>
          <select value={damageType} onChange={(e) => setDamageType(e.target.value)} className={selectClass}>
            <option value={SENTINEL_NO_CHANGE}>{t('admin.tpl_bulk_edit_no_change')}</option>
            <option value="physical">Physical</option>
            <option value="magical">Magical</option>
            <option value="unavoidable">Unavoidable</option>
          </select>
        </div>
      </div>

      {/* ボタン */}
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onClose}
          className="text-app-lg px-3 py-1 rounded border border-app-text/20 text-app-text-muted hover:bg-app-text/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_bulk_edit_cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          className="text-app-lg px-3 py-1 rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer"
        >
          {t('admin.tpl_bulk_edit_apply')}
        </button>
      </div>
    </div>
  );
}
