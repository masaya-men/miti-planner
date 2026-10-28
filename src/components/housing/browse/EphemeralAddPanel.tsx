import { useState } from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { HousingPanelModal } from '../HousingPanelModal';
import { RegisterSectionAddress, type RegisterAddressValues } from '../register/RegisterSectionAddress';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import {
  validateEphemeralInput,
  createEphemeralListing,
  EPHEMERAL_POOL_LIMIT,
  type EphemeralInput,
} from '../../../lib/housing/ephemeralListing';
import { useEphemeralListingsStore } from '../../../store/useEphemeralListingsStore';
import type { HousingArea } from '../../../types/housing';
import { regionForDC, type Region } from '../../../data/housing/dcServerMap';
import { canAddToTour } from '../../../lib/housing/tourCrossing';
import { useAllmarksImport } from '../../../lib/housing/useAllmarksImport';
import { AllmarksImportProgress } from './AllmarksImportProgress';
import { EphemeralUrlField } from './EphemeralUrlField';
import { useEphemeralUrlFetch, type SnsSource } from './useEphemeralUrlFetch';
import './EphemeralAddPanel.css';

export interface EphemeralAddPanelProps {
  open: boolean;
  onClose: () => void;
  /** 追加成功時に一時 listing の id (`ephemeral-` prefix) を通知。トレイ側で trayIds へ積む。 */
  onAdd: (id: string) => void;
  /**
   * 現在トレイに入っている家のリージョン (空トレイなら null/未指定)。
   * 指定時、別リージョンの DC を選んだ時点で注記を出し追加ボタンを無効化する
   * (跨ぎは不可能なため、住所を全部埋めさせてから弾く無駄入力を避ける・早期フィードバック)。
   */
  trayRegion?: Region | null;
}

/**
 * 「+ 住所から追加」モーダル (住所登録なし一時ツアー・spec §4.1 / 2026-07-12 フル構造化)。
 *
 * - 上段 URL 欄: `classifySnsUrl` で種別ルーティング → ツイート本文/YouTube概要欄
 *   `parseHousingFromText` / OGP `extractHousingAddressFromPage`。取れた住所は下の
 *   構造化フォームへ自動入力 (🟡)。
 * - 住所は**登録ページと同じ** `RegisterSectionAddress` (variant='tour') = 全部クリックのセレクト
 *   + 数字だけ入力。DC/サーバーも持つ (DC を跨いだツアーは日常的なため。将来のワールド判定にも効く)。
 *   フリーテキスト欄は廃止 (決められた書式で入れてもらう方が誤爆しない・ユーザー確定 2026-07-12)。
 * - 全項目充足で [ツアーに追加] 活性 → validate → create → store.add → `onAdd(id)` →
 *   入力だけクリアしてモーダルは開いたまま (連続追加)。
 */
export const EphemeralAddPanel: React.FC<EphemeralAddPanelProps> = ({ open, onClose, onAdd, trayRegion }) => {
  const { t } = useTranslation();

  const [url, setUrl] = useState('');
  const [address, setAddress] = useState<RegisterAddressValues>({});
  const [parseError, setParseError] = useState(false);
  const [urlInvalid, setUrlInvalid] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [added, setAdded] = useState(false);
  const [source, setSource] = useState<SnsSource | null>(null);

  // RegisterSectionAddress が要求する fieldState (自動入力 🟡 バッジ + onChange 契約)。
  const fieldState = useHousingFieldState();

  // Allmarksまとめてインポート (2026-08-19)。URL欄にAllmarksの共有リンクが来たときだけ
  // このモードに切り替わり、通常の構造化フォームの代わりに進捗表示を出す。
  const allmarksImport = useAllmarksImport();
  const isAllmarksImporting = allmarksImport.progress.status !== 'idle';

  const {
    tweetStatus, ogpStatus, youtubeStatus,
    resetTweet, resetOgp, resetYoutube,
    urlRef, handleUrlChange,
  } = useEphemeralUrlFetch({
    fieldState, allmarksImport, trayRegion, onAdd,
    setUrl, setAddress, setParseError, setUrlInvalid, setLimitReached, setAdded, setSource,
  });


  // RegisterSectionAddress からの各フィールド変更 (登録ページの handleAddressChange と同型)。
  const handleAddressChange = (name: string, value: unknown) => {
    setAdded(false);
    setLimitReached(false);
    setAddress((prev) => ({ ...prev, [name]: value }));
    fieldState.userEdit(name, value);
  };

  const isHouse = address.buildingType === 'house';
  const isApartment = address.buildingType === 'apartment';
  // 建物タイプ未選択は追加不可 (RegisterSectionAddress の厳密化に合わせる。未選択では番地/部屋番号の
  // 欄自体が出ないため、個人宅かアパートを選ぶまで complete=false)。
  const complete =
    address.dc !== undefined &&
    address.dc !== '' &&
    address.server !== undefined &&
    address.server !== '' &&
    address.area !== undefined &&
    address.area !== '' &&
    address.ward !== undefined &&
    (isHouse ? address.plot !== undefined : isApartment ? address.roomNumber !== undefined : false);

  // 選んだ DC のリージョンがトレイと違えば、住所を埋め切る前でも早期に弾く (canAddToTour が唯一の判定源)。
  const candidateRegion = address.dc ? regionForDC(address.dc) : null;
  const crossRegionBlocked =
    trayRegion != null && candidateRegion != null && !canAddToTour(trayRegion, candidateRegion);

  // フォーム送信(Enter/クリック双方が経由)。追加ボタンは type="submit" にして委譲する
  // ため、複合フォーム(URL欄・番地欄など)のどこで Enter を押しても反応する。ボタンが
  // disabled(=complete でない)間はブラウザが implicit submission を発火させないので、
  // ここでの complete チェックは handleAdd 側の既存ガードに任せて重複させない。
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleAdd();
  };

  const handleAdd = () => {
    if (!complete || address.area === undefined || address.ward === undefined) return;
    const input: EphemeralInput = {
      area: address.area as HousingArea,
      ward: address.ward,
      buildingType: isApartment ? 'apartment' : 'house',
      plot: isApartment ? undefined : address.plot,
      // ツアーは区画へ行くので個室区分は持たない。size は house 任意 (表示/並べ替え補助)。
      size:
        !isApartment && (address.size === 'S' || address.size === 'M' || address.size === 'L')
          ? address.size
          : undefined,
      apartmentBuilding: isApartment ? (address.apartmentBuilding ?? 1) : undefined,
      roomNumber: isApartment ? address.roomNumber : undefined,
      postUrl: source?.postUrl,
      ogImageUrl: source?.ogImageUrl,
      sourceImageUrls: source?.sourceImageUrls,
      dc: address.dc,
      server: address.server,
    };
    const validation = validateEphemeralInput(input);
    if (!validation.ok) {
      // セレクトは範囲固定なので通常来ない (防御的ガード)。
      setParseError(true);
      return;
    }
    const listing = createEphemeralListing(input);
    const accepted = useEphemeralListingsStore.getState().add(listing);
    if (!accepted) {
      setLimitReached(true);
      return;
    }
    onAdd(listing.id);
    // 連続追加: 入力だけクリアしてモーダルは開いたまま (spec §4.1-5)。
    setUrl('');
    urlRef.current = '';
    setAddress({});
    fieldState.reset();
    setParseError(false);
    setUrlInvalid(false);
    setSource(null);
    resetTweet();
    resetOgp();
    resetYoutube();
    setLimitReached(false);
    setAdded(true);
  };

  // 書きかけ(URL か住所のどれか)がある間は外側クリックで閉じない。追加すると両方空に戻るので、
  // 続けて追加したあとは外側クリックで閉じられる(入力したら開き直すまで閉じない自動判定は使わない)。
  const hasDraft =
    url.trim() !== '' || Object.values(address).some((v) => v !== undefined && v !== '');

  const fetching = tweetStatus === 'loading' || ogpStatus === 'loading' || youtubeStatus === 'loading';
  const fetchFailed = urlInvalid || tweetStatus === 'error' || ogpStatus === 'error';

  // Allmarksインポートの「やめる」/「閉じる」。通常の追加パネルへ戻る(ここまで追加済みの
  // 分は一時ツアーに残る。取り消さない)。
  const handleAllmarksClose = () => {
    allmarksImport.cancel();
    setUrl('');
    urlRef.current = '';
  };

  // モーダル化 (2026-07-12): 右カラムのトレイに直置きすると固定高さ+overflow:hidden で
  // お気に入りと重なりスクロールできなかった (実機バグ)。HousingPanelModal は body 直下へ
  // portal し独自にスクロールするので、連続追加しても崩れない。ヘッダー(閉じる含む)はモーダル側。
  return (
    <HousingPanelModal
      open={open}
      onClose={onClose}
      title={t('housing.ephemeral.panel_title')}
      closeLabel={t('common.close')}
      maxWidth={480}
      backdrop="frost"
      backdropOptions={{ autoGuard: false, dirty: hasDraft }}
    >
      <form className="housing-ephemeral-panel" onSubmit={handleSubmit}>
        {/* 使い捨て挙動の説明は最上部で最初に読ませる (下部だと見落とすため・ユーザー要望 2026-07-13)。 */}
        <p className="housing-ephemeral-note housing-ephemeral-note-lead">
          {t('housing.ephemeral.note_volatile')}
        </p>

        {isAllmarksImporting ? (
          <AllmarksImportProgress
            progress={allmarksImport.progress}
            onClose={handleAllmarksClose}
            onChooseRegion={allmarksImport.chooseRegion}
          />
        ) : (
          <>
            <EphemeralUrlField
              url={url}
              handleUrlChange={handleUrlChange}
              fetching={fetching}
              fetchFailed={fetchFailed}
              tweetStatus={tweetStatus}
              youtubeStatus={youtubeStatus}
            />

            {/* Allmarksまとめてインポートの導線 (2026-08-19)。この機能自体を知らない人向けの
                控えめな案内 (発見の主経路はDiscordアップデート告知)。別タブで開き、
                作成中のツアーからは離脱させない。 */}
            <p className="housing-ephemeral-note">
              <Trans
                i18nKey="housing.ephemeral.allmarks_hint"
                components={{
                  lnk: <a href="https://allmarks.app" target="_blank" rel="noopener noreferrer" />,
                }}
              />
            </p>

            {parseError && (
              <p className="housing-error-text">{t('housing.ephemeral.parse_error')}</p>
            )}

            {/* 住所は登録ページと同じ構造化フォーム (variant='tour' で登録固有部を隠す)。 */}
            <RegisterSectionAddress
              variant="tour"
              fieldState={fieldState}
              values={address}
              onChange={handleAddressChange}
              crossRegionNotice={crossRegionBlocked ? t('housing.tour.region_block') : null}
            />

            {limitReached && (
              <p className="housing-error-text">
                {t('housing.ephemeral.limit_note', { max: EPHEMERAL_POOL_LIMIT })}
              </p>
            )}
            {added && <p className="housing-ephemeral-added">{t('housing.ephemeral.added')}</p>}

            {/* スクロールしても押せる位置に留まるよう、ボタンだけ最下部に固定する
                (実機フィードバック: 住所が埋まるとボタンがスクロール外に出て押しにくかった)。 */}
            <div className="housing-ephemeral-footer">
              <button
                type="submit"
                className="housing-ephemeral-add"
                disabled={!complete || crossRegionBlocked}
              >
                {t('housing.ephemeral.add')}
              </button>
            </div>
          </>
        )}
      </form>
    </HousingPanelModal>
  );
};
