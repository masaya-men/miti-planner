import { useTranslation } from 'react-i18next';
import type { RegisterChecklistItem } from '../../../lib/housing/registerChecklist';

interface Props {
  items: RegisterChecklistItem[];
}

/**
 * 登録ページ右カラム「入力チェックパネル」(Task13)。
 * 親 (RegisterPage) から渡る items をライブ表示。done は✓、not done は⚠ の行で
 * 「何が足りないか」を具体的アクションで示す (feedback_form_ux_progress: 数でなく具体行)。
 * 質感A案: 色付き alert 箱にせず、行アイコンの色 (青=done/グレー=todo) だけで差をつける。
 */
export const RegisterCheckPanel: React.FC<Props> = ({ items }) => {
  const { t } = useTranslation();

  return (
    <div className="housing-register-check-panel" data-testid="housing-register-check-panel">
      <h2 className="housing-register-check-panel-title">{t('housing.register.check.title')}</h2>
      <ul className="housing-register-check-list">
        {items.map((item) => (
          <li
            key={item.key}
            className={`housing-register-check-row ${item.done ? 'is-done' : 'is-todo'}`}
            data-testid={`housing-register-check-${item.key}`}
          >
            <span className="housing-register-check-icon" aria-hidden="true">
              {item.done ? '✓' : '⚠'}
            </span>
            <span className="housing-register-check-label">{t(item.labelKey)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
