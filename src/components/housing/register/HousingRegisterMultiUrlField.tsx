import { useEffect, useRef, useState } from 'react';
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

  // 各欄の内部 state (入力テキスト・fetch 中/エラー) を持つのは子 (HousingRegisterSnsUrlField)
  // 自身で、親からは slotCount という「個数」しか渡らない。React の keyed-list reconciliation は
  // key の一致で既存インスタンスを使い回すため、key に配列 index をそのまま使うと「途中の欄を
  // 消す」操作で意図しない欄の state が入れ替わってしまう (末尾の欄だけが実際には unmount される)。
  // それを防ぐため、slotCount とは別に「安定 id の配列」をこのコンポーネント内部で保持し、
  // その id を key にする。slotCount 自体の増減ロジック (何番目を足す/消すかの意思決定) は
  // 引き続き親 (onAddSlot/onRemoveSlot 経由) が握ったまま — この id 配列は表示位置と
  // React インスタンスを紐付けるためだけの内部実装詳細で、props 契約は一切変えない。
  const nextSlotIdRef = useRef(0);
  const createSlotId = () => nextSlotIdRef.current++;
  const [slotIds, setSlotIds] = useState<number[]>(() =>
    Array.from({ length: slotCount }, () => createSlotId()),
  );

  // 「+ URLを追加」 は親が slotCount を +1 するだけ (このコンポーネントは onAddSlot を素通しする
  // だけで介入しない) なので、増分は slotCount の変化を見て追従するしかない。削除側は
  // handleRemove が同一 tick 内で id 配列を即座に詰めるため、通常はここで slotIds.length と
  // slotCount が既に一致しており (Object.is で同一参照を返せば React は再レンダーしない)、
  // 実質「増えた分だけ id を追加する」effect として働く。
  useEffect(() => {
    setSlotIds((prev) => {
      if (prev.length === slotCount) return prev;
      if (prev.length < slotCount) {
        const added = Array.from({ length: slotCount - prev.length }, () => createSlotId());
        return [...prev, ...added];
      }
      // 想定外に slotCount だけが単独で縮んだ場合の防御的フォールバック (通常経路は
      // handleRemove が先に詰めているのでここには来ない)。
      return prev.slice(0, slotCount);
    });
  }, [slotCount]);

  // 「✕」 は押された時点の表示位置 (index) から、その欄が今保持している安定 id を特定し、
  // 内部 id 配列から即座に取り除く。onRemoveSlot(index) は従来どおり index を渡して呼ぶので
  // 親の契約 (Task6 が前提にしている slotCount/onAddSlot/onRemoveSlot の形) は変えない。
  const handleRemove = (index: number) => {
    setSlotIds((prev) => prev.filter((_, i) => i !== index));
    onRemoveSlot(index);
  };

  return (
    <div className="housing-register-multi-url-field">
      {slotIds.map((slotId, index) => (
        <div className="housing-register-multi-url-row" key={slotId}>
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
              onClick={() => handleRemove(index)}
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
