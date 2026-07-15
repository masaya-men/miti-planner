import { useTranslation } from 'react-i18next';
import type { RegisterChecklistItem } from '../../../lib/housing/registerChecklist';

/**
 * 確認セクションに渡す入力要約 (住所/タイトル/画像枚数/公開設定)。
 * 表示専用の整形済み値だけを持ち、原本 state には依存しない (RegisterPage 側で組み立てる)。
 */
export interface RegisterConfirmSummary {
  /** 整形済み住所テキスト (例「Elemental / Kugane / 森林 6区 12番地 M」)。未確定は null。 */
  address: string | null;
  /** タイトル (未入力は null)。 */
  title: string | null;
  /** 画像枚数 (localImages + sourceImageUrls の合計)。0 のときは「画像なし」注記。 */
  imageCount: number;
}

interface Props {
  /** 'create' (既定) で新規登録、 'edit' で既存物件編集 (Task3.2)。 主ボタン文言/エラー文言が変わる。 */
  mode?: 'create' | 'edit';
  summary: RegisterConfirmSummary;
  /** 必須項目 (住所/タイトル) が揃っているか。false なら送信ボタン disabled。 */
  canSubmit: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  /** 送信中フラグ。true の間はボタン disabled + ラベルを「登録中…」にする。 */
  submitting?: boolean;
  /** エラーコード (quota_exhausted / not_authenticated / generic / upload_failed)。静かな注記で表示。
   *  mode='edit' のときは値によらず housing.edit.error を表示する (edit の失敗経路は更新 API 呼び出し
   *  失敗のみで、 create 固有の quota_exhausted 等は起こり得ないため)。 */
  errorKey?: string | null;
  onSubmit: () => void;
  /** 入力チェックの導出結果 (未達の required 行を「不足アクション」として列挙する)。 */
  checklistItems: RegisterChecklistItem[];
  /** 住所確認ゲート (C案・2026-07-10)。true になるまで送信できない (checklistItems.address に反映済み)。 */
  addressConfirmed: boolean;
  /** 確認ボタン押下ハンドラ。 */
  onConfirmAddress: () => void;
}

/**
 * 登録フォーム中央カラム: 確認セクション (spec 正典⑤・Task14)。
 *
 * - 入力要約 (住所 / タイトル / 画像枚数 / 公開設定) を静かに提示する。
 * - `canSubmit === false` のときは、右カラム RegisterCheckPanel と同じ checklistItems を
 *   信頼源として「不足しているアクション」(required かつ未達の行) を列挙する
 *   (feedback_form_ux_progress: 数でなく具体的アクションで示す)。
 * - 主アクションボタンは visibility でラベルが変わる (公開=「公開する」/ 非公開=「非公開で保存する」)。
 *   質感A案の「ハニー = 主アクション」トークン (`.housing-btn-primary`) を使う。
 * - エラーは色付き alert 箱にせず、ヘアライン + グレー文字の静かな注記にする (housing-design.md)。
 */
export const RegisterSectionConfirm: React.FC<Props> = ({
  mode = 'create',
  summary,
  canSubmit,
  visibility,
  submitting = false,
  errorKey = null,
  onSubmit,
  checklistItems,
  addressConfirmed,
  onConfirmAddress,
}) => {
  const { t } = useTranslation();

  // 不足アクション = required かつ未達の行だけ (画像は推奨なので required=false → 出さない)。
  const missing = checklistItems.filter((i) => i.required && !i.done);

  const submitLabel = submitting
    ? t('housing.register.submitting')
    : mode === 'edit'
      ? t('housing.edit.save')
      : visibility === 'private'
        ? t('housing.register.confirm.save_private')
        : t('housing.register.confirm.publish');

  return (
    <section className="housing-register-section" data-testid="housing-register-section-confirm">
      <h2 className="housing-register-section-title">{t('housing.register.confirm.section_title')}</h2>

      {/* 住所確認ゲート (C案・2026-07-10): 値が妥当でも、この確認ボタンを押すまで送信できない。
          住所を変えれば自動で未確認に戻る (RegisterPage handleAddressChange / applyExtractedResult 側)。
          静かな注記トーン (色付き alert 箱にしない)。確認済みはハニーではなく確認済みトークンを使う。 */}
      <div className="housing-register-confirm-gate" data-testid="housing-register-confirm-address-gate">
        <p className="housing-register-confirm-gate-lead">{t('housing.register.confirm.gate_lead_prompt')}</p>
        {summary.address && (
          <p className="housing-register-confirm-gate-address">{summary.address}</p>
        )}
        <button
          type="button"
          className="housing-action-btn housing-register-confirm-gate-btn"
          data-testid="housing-register-confirm-address-btn"
          data-confirmed={addressConfirmed ? 'true' : 'false'}
          disabled={addressConfirmed}
          onClick={onConfirmAddress}
        >
          {addressConfirmed ? (
            <>
              <span aria-hidden="true">✓</span>
              {t('housing.register.confirm.address_gate_confirmed')}
            </>
          ) : (
            t('housing.register.confirm.address_gate_button')
          )}
        </button>
      </div>

      {/* 入力要約 */}
      <dl className="housing-register-confirm-summary">
        <div className="housing-register-confirm-summary-row">
          <dt>{t('housing.register.section_address')}</dt>
          <dd>
            {summary.address ?? (
              <span className="housing-register-confirm-summary-empty">
                {t('housing.register.confirm.summary_missing')}
              </span>
            )}
          </dd>
        </div>
        <div className="housing-register-confirm-summary-row">
          <dt>{t('housing.register.field_title_label')}</dt>
          <dd>
            {summary.title ?? (
              <span className="housing-register-confirm-summary-empty">
                {t('housing.register.confirm.summary_missing')}
              </span>
            )}
          </dd>
        </div>
        {/* mode='edit' は写真を扱わない (方式A) ため画像枚数を要約しない。 edit は画像 state を
            プリフィルしないので imageCount は常に 0 になり、「0 枚」表示が家主に「写真が消えた?」
            と誤認させるため非表示にする (写真自体はサーバー側で保持されたまま)。 */}
        {mode !== 'edit' && (
          <div className="housing-register-confirm-summary-row">
            <dt>{t('housing.register.section_media')}</dt>
            <dd>{t('housing.register.confirm.summary_image_count', { count: summary.imageCount })}</dd>
          </div>
        )}
        <div className="housing-register-confirm-summary-row">
          <dt>{t('housing.register.confirm.summary_visibility')}</dt>
          <dd>
            {visibility === 'private'
              ? t('housing.register.visibility.private')
              : t('housing.register.visibility.public')}
          </dd>
        </div>
      </dl>

      {/* 不足アクション (canSubmit=false のとき) */}
      {missing.length > 0 && (
        <div className="housing-register-confirm-missing">
          <p className="housing-register-confirm-missing-lead">
            {t('housing.register.confirm.missing_lead')}
          </p>
          <ul className="housing-register-confirm-missing-list">
            {missing.map((item) => (
              <li key={item.key} data-testid={`housing-register-confirm-missing-${item.key}`}>
                {/* 不足アクションは命令文キー (チェック行は名詞キー) — 2026-07-10 で 2 系統に分離。 */}
                {t(item.missingLabelKey)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* エラー: 静かな注記 (色付き alert 箱にしない) */}
      {errorKey && (
        <p className="housing-register-confirm-error" role="alert" data-testid="housing-register-confirm-error">
          {mode === 'edit' ? t('housing.edit.error') : t(`housing.register.confirm.errors.${errorKey}`)}
        </p>
      )}

      <button
        type="button"
        className="housing-action-btn housing-btn-primary housing-register-confirm-submit"
        data-testid="housing-register-confirm-submit"
        disabled={!canSubmit || submitting}
        onClick={onSubmit}
      >
        {submitLabel}
      </button>
    </section>
  );
};
