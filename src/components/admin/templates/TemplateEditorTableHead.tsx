/**
 * テンプレートエディター — テーブルの列幅と見出し行
 */
import { useTranslation } from 'react-i18next';

interface TemplateEditorTableHeadProps {
  allSelected: boolean;
  onToggleSelectAll: () => void;
}

export function TemplateEditorTableHead({ allSelected, onToggleSelectAll }: TemplateEditorTableHeadProps) {
  const { t } = useTranslation();

  return (
    <>
        <colgroup>
          <col style={{ width: '32px' }} />  {/* チェックボックス */}
          <col style={{ width: '70px' }} />  {/* フェーズ */}
          <col style={{ width: '120px' }} /> {/* ラベル */}
          <col style={{ width: '55px' }} />  {/* 時間 */}
          <col className="min-w-[100px]" />  {/* 技名JA */}
          <col className="min-w-[100px]" />  {/* 技名EN */}
          <col className="min-w-[100px]" />  {/* 技名ZH */}
          <col className="min-w-[100px]" />  {/* 技名ZH-Hant */}
          <col className="min-w-[100px]" />  {/* 技名KO */}
          <col className="min-w-[90px]" />   {/* or技名JA */}
          <col className="min-w-[90px]" />   {/* or技名EN */}
          <col className="min-w-[90px]" />   {/* or技名ZH */}
          <col className="min-w-[90px]" />   {/* or技名ZH-Hant */}
          <col className="min-w-[90px]" />   {/* or技名KO */}
          <col style={{ width: '70px' }} />  {/* 種別 */}
          <col style={{ width: '64px' }} />  {/* デバフ軽減不可 */}
          <col style={{ width: '60px' }} />  {/* 対象 */}
          <col className="min-w-[110px]" />  {/* スプシ表記 */}
          <col style={{ width: '80px' }} />  {/* ダメージ */}
          <col style={{ width: '40px' }} />  {/* 削除 */}
        </colgroup>

        <thead>
          <tr className="border-b border-app-text/10 text-left text-app-text-muted">
            <th className="pb-2 pr-1">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleSelectAll}
                className="cursor-pointer accent-blue-500"
              />
            </th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_phase')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_label')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_time')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ja')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_en')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_zh')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_zh_hant')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_name_ko')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_ja')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_en')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_zh')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_zh_hant')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_altname_ko')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage_type')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_debuff_immune')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_target')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_sheet_aliases')}</th>
            <th className="pb-2 pr-2 font-normal">{t('admin.tpl_editor_damage')}</th>
            <th className="pb-2 font-normal">{t('admin.tpl_editor_delete')}</th>
          </tr>
        </thead>
    </>
  );
}
