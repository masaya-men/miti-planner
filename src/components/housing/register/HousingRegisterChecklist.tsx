import { useTranslation } from 'react-i18next';
import type { FieldState } from '../../../lib/housing/housingFieldState';

export interface ChecklistItem {
  name: string;
  /** i18n key for the human-readable field label. */
  labelKey: string;
  state: FieldState;
  /** Current value (for auto-filled state display). */
  value: unknown;
  /** Called when the user clicks「そのままで OK」 for an auto-filled item. */
  onConfirm: () => void;
  /** Optional renderer to display the value (e.g. translate size enum). */
  renderValue?: (value: unknown) => string;
}

interface Props {
  items: ChecklistItem[];
}

/**
 * モーダル下部の進捗チェックリスト。 必須項目で state !== confirmed/edited のものを
 * 具体的アクションとして列挙し、 「そのままで OK」 ボタンで auto-filled → confirmed に
 * 切り替えできる。 全項目完了時は positive メッセージを表示。
 */
export const HousingRegisterChecklist: React.FC<Props> = ({ items }) => {
  const { t } = useTranslation();
  const incomplete = items.filter(
    (it) => it.state !== 'confirmed' && it.state !== 'edited',
  );

  if (incomplete.length === 0) {
    return (
      <div className="housing-register-checklist" data-ready="true">
        <span className="housing-register-checklist-ready">
          ✓ {t('housing.register.checklist.ready')}
        </span>
      </div>
    );
  }

  return (
    <div className="housing-register-checklist">
      <p className="housing-register-checklist-title">
        {t('housing.register.checklist.title')}
      </p>
      <ul className="housing-register-checklist-items">
        {incomplete.map((item) => {
          const label = t(item.labelKey);
          const valueText = item.value != null && item.value !== ''
            ? (item.renderValue ? item.renderValue(item.value) : String(item.value))
            : '';
          return (
            <li
              key={item.name}
              className="housing-register-checklist-item"
              data-state={item.state}
            >
              <span className="housing-register-checklist-icon" aria-hidden="true">
                {item.state === 'auto-filled' ? '⚠️' : item.state === 'error' ? '×' : '○'}
              </span>
              <span className="housing-register-checklist-text">
                {item.state === 'empty' &&
                  t('housing.register.checklist.empty', { field: label })}
                {item.state === 'auto-filled' &&
                  t('housing.register.checklist.autoFilled', { field: label, value: valueText })}
                {item.state === 'error' &&
                  t('housing.register.checklist.error', { field: label })}
              </span>
              {item.state === 'auto-filled' && (
                <button
                  type="button"
                  className="housing-register-checklist-confirm"
                  onClick={item.onConfirm}
                >
                  {t('housing.register.checklist.confirmBtn')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
