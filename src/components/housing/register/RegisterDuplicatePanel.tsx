import { useTranslation } from 'react-i18next';
import type { DuplicateEntry } from '../../../lib/housingApiClient';

export type RegisterDuplicateState = 'idle' | 'checking' | 'clear' | 'found';

interface Props {
  state: RegisterDuplicateState;
  /** 公開重複 (id/createdAt/tags のみカード表示・HousingDuplicateWarningDialog と同じ範囲)。 */
  duplicates: DuplicateEntry[];
  /**
   * 非公開重複の件数のみ。ownerUid や座標詳細など非公開 doc の中身は一切渡さない設計
   * (呼び出し側の checkDuplicate レスポンスも privateMatchCount は数値のみ)。
   */
  privateMatchCount: number;
}

/**
 * 登録ページ右カラム「重複チェックパネル」(Task13)。
 *
 * セキュリティ上の要点 (housing 管理基盤設計書・非公開データ保護の中核):
 * 非公開一致は「件数」のみを受け取り描画する。ownerUid・座標詳細等の非公開 doc の中身は
 * このコンポーネントの props にすら存在しないため、実装ミスでレンダーしてしまう経路が
 * 構造的に無い (props の型に無いものは描画しようがない)。
 */
export const RegisterDuplicatePanel: React.FC<Props> = ({ state, duplicates, privateMatchCount }) => {
  const { t } = useTranslation();

  return (
    // data-state で「重複あり」を CSS に降ろす (見出し/枠を赤くする・#重複を目立たせる)。
    <div className="housing-register-dup-panel" data-state={state} data-testid="housing-register-dup-panel">
      <h2 className="housing-register-dup-panel-title">{t('housing.register.duplicate.title')}</h2>

      {state === 'idle' && (
        <p className="housing-register-dup-quiet-text" data-testid="housing-register-dup-idle">
          {t('housing.register.duplicate.idle')}
        </p>
      )}

      {state === 'checking' && (
        <div className="housing-register-dup-skeleton" data-testid="housing-register-dup-checking" aria-hidden="true">
          <div className="housing-register-dup-skeleton-row" />
          <div className="housing-register-dup-skeleton-row" />
        </div>
      )}

      {state === 'clear' && (
        <p className="housing-register-dup-quiet-text" data-testid="housing-register-dup-clear">
          {t('housing.register.duplicate.clear')}
        </p>
      )}

      {state === 'found' && (
        <div className="housing-register-dup-found" data-testid="housing-register-dup-found">
          {/* 重複は見落とすと二重登録になるため、赤いヘアライン + 赤文字 + ⚠ で強く出す。
              色地の alert 箱にはしない (housing-design.md「色付き alert 箱を避ける」と両立)。 */}
          <p className="housing-register-dup-found-lead" data-testid="housing-register-dup-found-lead">
            <span className="housing-register-dup-found-icon" aria-hidden="true">⚠</span>
            {t('housing.register.duplicate.found_lead')}
          </p>

          {duplicates.length > 0 && (
            <ul className="housing-register-dup-public-list" data-testid="housing-register-dup-public">
              {duplicates.map((d) => (
                <li key={d.id} className="housing-register-dup-public-card">
                  <p className="housing-register-dup-public-date">
                    {t('housing.duplicate.created_at', {
                      date: new Date(d.createdAt).toLocaleDateString(),
                    })}
                  </p>
                  {d.tags.length > 0 && (
                    <p className="housing-register-dup-public-tags">
                      {d.tags.slice(0, 3).map((tag) => t(`housing.tag.${tag}`)).join(' / ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {privateMatchCount > 0 && (
            <p className="housing-register-dup-private-note" data-testid="housing-register-dup-private">
              {t('housing.register.duplicate.private_note', { count: privateMatchCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
