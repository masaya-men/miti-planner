import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    HousingRegisterSnsUrlField,
    type YoutubeFetchedData,
    type OgpFetchedData,
} from './HousingRegisterSnsUrlField';
import { HousingRegisterTweetPreview } from './HousingRegisterTweetPreview';
import { HousingRegisterTypeSelector } from './HousingRegisterTypeSelector';
import { HousingRegisterRoomNumberField } from './HousingRegisterRoomNumberField';
import { HousingRegisterParentHouseSizeField } from './HousingRegisterParentHouseSizeField';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';
import { HousingRegisterFieldBadge } from './HousingRegisterFieldBadge';
import { HousingRegisterChecklist, type ChecklistItem } from './HousingRegisterChecklist';
import { HousingRegisterImageField } from './HousingRegisterImageField';
import { HousingRegisterSourceImageUrlsField } from './HousingRegisterSourceImageUrlsField';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import {
    parseHousingFromText,
    type HousingExtractSize,
} from '../../../lib/housing/parseHousingFromText';
import { serverMasterData, housingAreaMasterData } from '../../../data/masterData';
import type { TweetData } from '../../../lib/housing/useTweetFetch';
import type { CompressedImage } from '../../../lib/housing/imageCompression';
import {
    handleYoutubeThumbnailError,
    handleYoutubeThumbnailLoad,
} from '../../../lib/housing/youtubeImgFallback';

export type HousingRegisterFormValues = {
    dc?: string;
    server?: string;
    area?: string;
    ward?: number;
    plot?: number;
    size?: HousingExtractSize;
    /** 2026-05-27: アパート号棟 (1=本街 / 2=拡張街)。 size==='Apartment' 時に必須 */
    apartmentBuilding?: 1 | 2;
    roomNumber?: number;
    parentHouseSize?: 'S' | 'M' | 'L';
    description?: string;
    tags?: string[];
    postUrl?: string;
    ogImageUrl?: string;
    tweetId?: string;
    /**
     * 2026-05-26: YouTube 動画 ID (11 文字)。 tweetId とは排他、 SNS URL フィールドに
     * YouTube URL が入力されたら自動セット。 backend は imageMode='sns' + youtubeVideoId
     * として保存する。
     */
    youtubeVideoId?: string;
    /**
     * 2026-05-26: クライアント圧縮済の直接アップロード画像 (1-4 枚)。
     * register 後に upload-thumbnail API で index=0..N-1 と順次送る。
     * 空配列は画像なし扱い。
     */
    localImages?: CompressedImage[];
    /**
     * 2026-05-27: OGP (housingsnap / studio-xiv 等) 経由で取得した外部画像 URL リスト。
     * **LoPo の倉庫にコピーせず、 元サイトの URL を `<img src>` で直接表示する**。
     * 投稿削除で自動消失、 LoPo 帯域消費ゼロ。 最大 4 件保存 (handleSubmit で slice)。
     */
    sourceImageUrls?: string[];
};

type Props = {
    onSubmit: (values: HousingRegisterFormValues) => void;
    onCancel: () => void;
};

// size に応じて必須フィールドを変える。
// - S/M/L (家全体)        : dc/server/area/ward/plot/size
// - PrivateRoom (FC 個室) : 上記 + roomNumber + parentHouseSize
// - Apartment             : dc/server/area/ward/size + apartmentBuilding + roomNumber (plot は不要)
function requiredFieldsForSize(size: HousingExtractSize | undefined): string[] {
    const base = ['dc', 'server', 'area', 'ward', 'size'];
    if (size === 'Apartment') return [...base, 'apartmentBuilding', 'roomNumber'];
    if (size === 'PrivateRoom') return [...base, 'plot', 'parentHouseSize', 'roomNumber'];
    return [...base, 'plot'];
}

// 自動入力の段階的タイピング表現 (1 フィールドごとに 150ms ずらす)
const TYPING_STAGGER_MS = 150;

export function HousingRegisterForm({ onSubmit, onCancel }: Props) {
    const { t } = useTranslation();
    // size を初期取得用に state で持つと循環参照になるので、 fieldState の getValue を信頼する
    const [sizeForRequired, setSizeForRequired] = useState<HousingExtractSize | undefined>(undefined);
    const requiredFields = useMemo(() => requiredFieldsForSize(sizeForRequired), [sizeForRequired]);
    const fieldState = useHousingFieldState(requiredFields);
    const [tweetData, setTweetData] = useState<TweetData | null>(null);
    const [tweetSource, setTweetSource] = useState<{ postUrl: string; tweetId: string } | null>(null);
    const [youtubeData, setYoutubeData] = useState<YoutubeFetchedData | null>(null);
    // 2026-05-27 (B): OGP 取得結果。 imageBase64 があれば localImages に push 済み (useEffect 経由)。
    const [ogpResult, setOgpResult] = useState<OgpFetchedData | null>(null);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [localImages, setLocalImages] = useState<CompressedImage[]>([]);
    /**
     * 2026-05-27: OGP 経由で取得した外部画像 URL リスト (housingsnap / studio-xiv 等)。
     * ドラッグで並び替え可、 先頭 4 件が物件画像として保存される。
     * Twitter / YouTube は ogImageUrl 1 枚維持 (次セッションで sourceImageUrls 統合予定)。
     */
    const [sourceImageUrls, setSourceImageUrls] = useState<string[]>([]);

    const handleTweetFetched = useCallback(
        (data: TweetData, source: { postUrl: string; tweetId: string } | null) => {
            setTweetData(data);
            setTweetSource(source);
            const result = parseHousingFromText(data.text);
            const fills: Array<[string, unknown]> = [];
            if (result.dc) fills.push(['dc', result.dc]);
            if (result.server) fills.push(['server', result.server]);
            if (result.area) fills.push(['area', result.area]);
            if (result.ward != null) fills.push(['ward', result.ward]);
            if (result.plot != null) fills.push(['plot', result.plot]);
            if (result.size) fills.push(['size', result.size]);

            const reduce =
                typeof window !== 'undefined' &&
                window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
            if (reduce) {
                fills.forEach(([name, value]) => fieldState.setAutoFilled(name, value));
            } else {
                fills.forEach(([name, value], i) => {
                    window.setTimeout(
                        () => fieldState.setAutoFilled(name, value),
                        i * TYPING_STAGGER_MS,
                    );
                });
            }
        },
        [fieldState],
    );

    const dc = fieldState.getValue('dc') as string | undefined;
    const server = fieldState.getValue('server') as string | undefined;
    const area = fieldState.getValue('area') as string | undefined;
    const ward = fieldState.getValue('ward') as number | undefined;
    const plot = fieldState.getValue('plot') as number | undefined;
    const size = fieldState.getValue('size') as HousingExtractSize | undefined;
    const apartmentBuilding = fieldState.getValue('apartmentBuilding') as 1 | 2 | undefined;
    const roomNumber = fieldState.getValue('roomNumber') as number | undefined;
    const parentHouseSize = fieldState.getValue('parentHouseSize') as
        | 'S'
        | 'M'
        | 'L'
        | undefined;

    // size 変化を requiredFields に反映 (fieldState の getValue を信頼源にする)
    useEffect(() => {
        setSizeForRequired(size);
    }, [size]);

    const isApartment = size === 'Apartment';
    const isPrivateRoom = size === 'PrivateRoom';
    const showPlot = !isApartment; // アパートでは番地 (plot) は無い
    const showApartmentBuilding = isApartment;
    const showRoomNumber = isApartment || isPrivateRoom;
    const showParentSize = isPrivateRoom;

    const dcKeys = Object.keys(serverMasterData);
    const serverKeys = dc ? Object.keys(serverMasterData[dc]?.servers ?? {}) : [];
    const areaKeys = Object.keys(housingAreaMasterData);

    // 2026-05-27: OGP 取得成功時に画像 URL リストを sourceImageUrls state に反映。
    // 画像本体は LoPo 倉庫にコピーせず、 元サイトの URL を `<img src>` 直接表示する方針
    // (= 投稿削除で自動消失、 LoPo 帯域消費ゼロ、 設計書 §6.2 sns モード)。
    useEffect(() => {
        if (!ogpResult) {
            setSourceImageUrls([]);
            return;
        }
        setSourceImageUrls(ogpResult.data.images ?? []);
    }, [ogpResult]);

    // size が変わった結果、 不要になった条件付きフィールドはクリア
    useEffect(() => {
        if (!showPlot && plot !== undefined) {
            fieldState.clearField('plot');
        }
        if (!showApartmentBuilding && apartmentBuilding !== undefined) {
            fieldState.clearField('apartmentBuilding');
        }
        if (!showRoomNumber && roomNumber !== undefined) {
            fieldState.clearField('roomNumber');
        }
        if (!showParentSize && parentHouseSize !== undefined) {
            fieldState.clearField('parentHouseSize');
        }
    }, [
        showPlot,
        showApartmentBuilding,
        showRoomNumber,
        showParentSize,
        plot,
        apartmentBuilding,
        roomNumber,
        parentHouseSize,
        fieldState,
    ]);

    const handleSubmit = () => {
        // 画像源の優先順位 (2026-05-27 更新):
        //   ① ローカルアップロード (1 枚以上) → imageMode='thumbnail'。 SNS 系は無視
        //   ② YouTube URL → imageMode='sns' + youtubeVideoId + ogImageUrl 1 枚
        //   ③ Twitter URL (本文取得済 + 画像 1 枚目あり) → imageMode='sns' + tweetId + ogImageUrl 1 枚
        //   ④ OGP (housingsnap / studio-xiv 等) → imageMode='sns' + ogImageUrl (代表)
        //      + sourceImageUrls (取得した全 URL、 ドラッグ並び替え後の先頭 4 件)
        //   ⑤ どれも無し → imageMode='none'
        const hasLocalImages = localImages.length > 0;
        // 静止画ツイートは photos[0]、 動画ツイートは Task Group 2 で videoUrl 系を別経路で保存する
        const photo = tweetData?.photos?.[0];

        let snsImage: Partial<HousingRegisterFormValues> = {};
        if (!hasLocalImages) {
            if (youtubeData) {
                snsImage = {
                    postUrl: youtubeData.postUrl,
                    ogImageUrl: youtubeData.ogImageUrl,
                    youtubeVideoId: youtubeData.videoId,
                };
            } else if (tweetSource && photo) {
                snsImage = {
                    postUrl: tweetSource.postUrl,
                    ogImageUrl: photo,
                    tweetId: tweetSource.tweetId,
                };
            } else if (ogpResult && sourceImageUrls.length > 0) {
                // 2026-05-27: OGP 経由は sourceImageUrls (並び替え後) を保存。
                // 1 枚目を ogImageUrl 代表に置いて HousingCard 後方互換を維持。
                const trimmed = sourceImageUrls.slice(0, 4);
                snsImage = {
                    postUrl: ogpResult.postUrl,
                    ogImageUrl: trimmed[0],
                    sourceImageUrls: trimmed,
                };
            } else if (ogpResult && ogpResult.data.image) {
                // sourceImageUrls 空 (画像抽出ゼロ) のとき og:image だけで fallback
                snsImage = {
                    postUrl: ogpResult.postUrl,
                    ogImageUrl: ogpResult.data.image,
                };
            }
        }

        // hotfix25: アップロード経路は 12 枚まで取り込み可、 登録時は先頭 4 枚保存。
        const localImagesToSubmit = localImages.slice(0, 4);

        onSubmit({
            dc,
            server,
            area,
            ward,
            plot,
            size,
            apartmentBuilding,
            roomNumber,
            parentHouseSize,
            description,
            tags,
            ...snsImage,
            ...(hasLocalImages ? { localImages: localImagesToSubmit } : {}),
        });
    };

    const renderFieldBadge = (name: string) => (
        <HousingRegisterFieldBadge
            state={fieldState.getState(name)}
            onConfirm={() => fieldState.confirm(name)}
        />
    );

    return (
        <div className="housing-register-form">
            <HousingRegisterSnsUrlField
                onTweetFetched={handleTweetFetched}
                onYoutubeFetched={setYoutubeData}
                onOgpFetched={setOgpResult}
            />
            {tweetData && <HousingRegisterTweetPreview data={tweetData} />}
            {youtubeData && (
                <div className="housing-register-youtube-preview">
                    <img
                        src={youtubeData.ogImageUrl}
                        alt=""
                        className="housing-register-youtube-thumb"
                        loading="lazy"
                        onError={handleYoutubeThumbnailError}
                        onLoad={handleYoutubeThumbnailLoad}
                    />
                    <span className="housing-register-youtube-label">
                        {t('housing.register.snsUrl.youtube_detected')}
                    </span>
                </div>
            )}
            {ogpResult && (
                <div className="housing-register-ogp-preview">
                    <span className="housing-register-ogp-site">
                        {ogpResult.data.siteName ?? new URL(ogpResult.postUrl).hostname}
                    </span>
                    {ogpResult.data.title && (
                        <span className="housing-register-ogp-title">
                            {ogpResult.data.title}
                        </span>
                    )}
                </div>
            )}

            {/* 2026-05-27: OGP 経由で取れた外部画像 URL リスト。 ドラッグで並び替え + 個別削除。
                画像本体は LoPo に取り込まず、 元サイトの URL を <img src> 直接表示する。 */}
            <HousingRegisterSourceImageUrlsField
                value={sourceImageUrls}
                onChange={setSourceImageUrls}
                maxImages={4}
            />

            {/* 2026-05-26: 画像アップロード経路。 SNS URL と並ぶ第 2 の画像入力手段。 両方ある場合は画像優先。 最大 4 枚。 */}
            <HousingRegisterImageField
                value={localImages}
                onChange={setLocalImages}
                hasSnsUrl={!!tweetSource || !!youtubeData || !!ogpResult}
                maxImages={12}
            />

            {/* DC */}
            <div className="housing-field" data-state={fieldState.getState('dc')}>
                <label htmlFor="housing-register-dc" className="housing-label">
                    {t('housing.register.dc')}
                </label>
                <select
                    id="housing-register-dc"
                    className="housing-input"
                    value={dc ?? ''}
                    onChange={(e) => fieldState.userEdit('dc', e.target.value || undefined)}
                >
                    <option value="">—</option>
                    {dcKeys.map((k) => (
                        <option key={k} value={k}>
                            {k}
                        </option>
                    ))}
                </select>
                {renderFieldBadge('dc')}
            </div>

            {/* Server */}
            <div className="housing-field" data-state={fieldState.getState('server')}>
                <label htmlFor="housing-register-server" className="housing-label">
                    {t('housing.register.server')}
                </label>
                <select
                    id="housing-register-server"
                    className="housing-input"
                    value={server ?? ''}
                    disabled={!dc}
                    onChange={(e) => fieldState.userEdit('server', e.target.value || undefined)}
                >
                    <option value="">—</option>
                    {serverKeys.map((k) => (
                        <option key={k} value={k}>
                            {k}
                        </option>
                    ))}
                </select>
                {renderFieldBadge('server')}
            </div>

            {/* Area */}
            <div className="housing-field" data-state={fieldState.getState('area')}>
                <label htmlFor="housing-register-area" className="housing-label">
                    {t('housing.register.area')}
                </label>
                <select
                    id="housing-register-area"
                    className="housing-input"
                    value={area ?? ''}
                    onChange={(e) => fieldState.userEdit('area', e.target.value || undefined)}
                >
                    <option value="">—</option>
                    {areaKeys.map((k) => (
                        <option key={k} value={k}>
                            {k}
                        </option>
                    ))}
                </select>
                {renderFieldBadge('area')}
            </div>

            {/* Ward */}
            <div className="housing-field" data-state={fieldState.getState('ward')}>
                <label htmlFor="housing-register-ward" className="housing-label">
                    {t('housing.register.ward')}
                </label>
                <input
                    id="housing-register-ward"
                    type="number"
                    min={1}
                    max={30}
                    className="housing-input"
                    value={ward ?? ''}
                    onChange={(e) =>
                        fieldState.userEdit(
                            'ward',
                            e.target.value ? Number(e.target.value) : undefined,
                        )
                    }
                />
                {renderFieldBadge('ward')}
            </div>

            {/* Size (type selector) — buildingType と部屋区分の 5 択。 順序的に番地より上に置いて、 アパート選択時に番地を隠すフローに */}
            <div className="housing-field" data-state={fieldState.getState('size')}>
                <HousingRegisterTypeSelector
                    value={size ?? null}
                    onChange={(s) => fieldState.userEdit('size', s)}
                />
                {renderFieldBadge('size')}
            </div>

            {/* Plot — アパート以外 (S/M/L/PrivateRoom) のみ表示 */}
            {showPlot && (
                <div className="housing-field" data-state={fieldState.getState('plot')}>
                    <label htmlFor="housing-register-plot" className="housing-label">
                        {t('housing.register.plot')}
                    </label>
                    <input
                        id="housing-register-plot"
                        type="number"
                        min={1}
                        max={60}
                        className="housing-input"
                        value={plot ?? ''}
                        onChange={(e) =>
                            fieldState.userEdit(
                                'plot',
                                e.target.value ? Number(e.target.value) : undefined,
                            )
                        }
                    />
                    {plot != null && plot >= 31 && plot <= 60 && (
                        <p className="housing-address-note">
                            {t('housing.register.address.expansionWardNote')}
                        </p>
                    )}
                    {renderFieldBadge('plot')}
                </div>
            )}

            {/* Apartment building (1=本街 / 2=拡張街) — アパート時のみ */}
            {showApartmentBuilding && (
                <div
                    className="housing-conditional-field housing-field"
                    data-state={fieldState.getState('apartmentBuilding')}
                >
                    <label className="housing-label">
                        {t('housing.register.apartment_building.label')}
                    </label>
                    <div className="flex flex-col gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="housing-register-apartment-building"
                                value="1"
                                checked={apartmentBuilding === 1}
                                onChange={() => fieldState.userEdit('apartmentBuilding', 1)}
                            />
                            {t('housing.register.apartment_building.main')}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="housing-register-apartment-building"
                                value="2"
                                checked={apartmentBuilding === 2}
                                onChange={() => fieldState.userEdit('apartmentBuilding', 2)}
                            />
                            {t('housing.register.apartment_building.sub')}
                        </label>
                    </div>
                    {renderFieldBadge('apartmentBuilding')}
                </div>
            )}

            {/* Room number (Apartment or PrivateRoom) */}
            {showRoomNumber && (
                <div
                    className="housing-conditional-field housing-field"
                    data-state={fieldState.getState('roomNumber')}
                >
                    <HousingRegisterRoomNumberField
                        mode={size === 'Apartment' ? 'Apartment' : 'PrivateRoom'}
                        value={roomNumber ?? null}
                        onChange={(n) => {
                            if (n == null) fieldState.clearField('roomNumber');
                            else fieldState.userEdit('roomNumber', n);
                        }}
                    />
                </div>
            )}

            {/* Parent house size (PrivateRoom only) */}
            {showParentSize && (
                <div
                    className="housing-conditional-field housing-field"
                    data-state={fieldState.getState('parentHouseSize')}
                >
                    <HousingRegisterParentHouseSizeField
                        value={parentHouseSize ?? null}
                        onChange={(s) => fieldState.userEdit('parentHouseSize', s)}
                    />
                </div>
            )}

            <HousingRegisterDescriptionField
                value={description}
                onChange={setDescription}
                error={undefined}
            />
            <HousingRegisterTagPicker selected={tags} onChange={setTags} />

            <HousingRegisterChecklist
                items={(
                    [
                        { name: 'dc', labelKey: 'housing.register.dc', value: dc },
                        { name: 'server', labelKey: 'housing.register.server', value: server },
                        { name: 'area', labelKey: 'housing.register.area', value: area },
                        { name: 'ward', labelKey: 'housing.register.ward', value: ward },
                        { name: 'size', labelKey: 'housing.register.size', value: size, renderValue: (v) => t(`housing.register.type.${v === 'PrivateRoom' ? 'private' : v === 'Apartment' ? 'apartment' : v}`) },
                        ...(showPlot
                            ? [{ name: 'plot', labelKey: 'housing.register.plot', value: plot }]
                            : []),
                        ...(showApartmentBuilding
                            ? [{ name: 'apartmentBuilding', labelKey: 'housing.register.apartment_building.label', value: apartmentBuilding }]
                            : []),
                        ...(showRoomNumber
                            ? [{ name: 'roomNumber', labelKey: 'housing.register.room_number', value: roomNumber }]
                            : []),
                        ...(showParentSize
                            ? [{ name: 'parentHouseSize', labelKey: 'housing.register.parent_house_size', value: parentHouseSize }]
                            : []),
                    ] as Array<Omit<ChecklistItem, 'state' | 'onConfirm'>>
                ).map((spec): ChecklistItem => ({
                    ...spec,
                    state: fieldState.getState(spec.name),
                    onConfirm: () => fieldState.confirm(spec.name),
                }))}
            />

            <footer className="housing-register-form-footer">
                <button type="button" onClick={onCancel}>
                    {t('housing.register.cancel')}
                </button>
                <button
                    type="button"
                    disabled={!fieldState.isReadyToSubmit()}
                    onClick={handleSubmit}
                >
                    {t('housing.register.submit')}
                </button>
            </footer>
        </div>
    );
}
