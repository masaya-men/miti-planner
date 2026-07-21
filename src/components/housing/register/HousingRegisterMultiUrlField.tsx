import { useTranslation } from 'react-i18next';
import {
  HousingRegisterSnsUrlField,
  type YoutubeFetchedData,
  type OgpFetchedData,
} from './HousingRegisterSnsUrlField';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

export interface HousingRegisterMultiUrlFieldProps {
  /** 現在表示する URL 入力欄の数 (1..maxSlots)。 */
  slotCount: number;
  /** 「+ URLを追加」押下時 (親が slotCount を +1 する)。 */
  onAddSlot: () => void;
  /** 各欄の「✕」押下時、その index の欄を取り除く (親が slotCount を -1 する)。 */
  onRemoveSlot: (index: number) => void;
  /** 最大欄数。既定 5 (Batch2 設計書準拠)。 */
  maxSlots?: number;
  onTweetFetched: (
    data: TweetData,
    source: { postUrl: string; tweetId: string } | null,
  ) => void;
  onYoutubeFetched: (data: YoutubeFetchedData | null) => void;
  onOgpFetched: (data: OgpFetchedData | null) => void;
}

/**
 * 複数投稿URL登録 (Batch2・2026-07-21) の入力欄ラッパー。
 *
 * `HousingRegisterSnsUrlField` 自体は1URL分の取得ロジックしか持たないため変更しない。
 * このコンポーネントは単に slotCount 個のインスタンスを並べて「+ URLを追加」「✕ 削除」の
 * UI だけを足す。各インスタンスの取得結果 (onTweetFetched 等) は**全スロット共通の同じ
 * コールバックにそのまま流す** (スロット番号は親に渡さない)。重複URL検出・動画1本制限・
 * 住所の「最初に見つかった方を採用」は親 (RegisterPage / HousingEditSourcePanel) 側が
 * 集約済み state を見て判定する設計 (multiSourceGuards.ts 参照) — 個々のスロットが
 * 「自分が何番目か」を意識する必要がない、単純な構造にするため。
 */
export function HousingRegisterMultiUrlField({
  slotCount,
  onAddSlot,
  onRemoveSlot,
  maxSlots = 5,
  onTweetFetched,
  onYoutubeFetched,
  onOgpFetched,
}: HousingRegisterMultiUrlFieldProps) {
  const { t } = useTranslation();
  return (
    <div className="housing-register-multi-url-field">
      {Array.from({ length: slotCount }).map((_, index) => (
        <div className="housing-register-multi-url-row" key={index}>
          <HousingRegisterSnsUrlField
            onTweetFetched={onTweetFetched}
            onYoutubeFetched={onYoutubeFetched}
            onOgpFetched={onOgpFetched}
            suppressInlineFetchStatus={false}
          />
          {slotCount > 1 && (
            <button
              type="button"
              className="housing-register-multi-url-remove"
              data-testid={`housing-multi-url-remove-${index}`}
              aria-label={t('housing.register.media.remove_url')}
              onClick={() => onRemoveSlot(index)}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      {slotCount < maxSlots && (
        <button
          type="button"
          className="housing-register-multi-url-add"
          data-testid="housing-multi-url-add"
          onClick={onAddSlot}
        >
          {t('housing.register.media.add_url')}
        </button>
      )}
    </div>
  );
}
