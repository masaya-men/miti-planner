import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingRegisterSnsUrlField } from './HousingRegisterSnsUrlField';
import { HousingRegisterTweetPreview } from './HousingRegisterTweetPreview';
import { HousingRegisterTypeSelector } from './HousingRegisterTypeSelector';
import { HousingRegisterRoomNumberField } from './HousingRegisterRoomNumberField';
import { HousingRegisterParentHouseSizeField } from './HousingRegisterParentHouseSizeField';
import { HousingRegisterDescriptionField } from './HousingRegisterDescriptionField';
import { HousingRegisterTagPicker } from './HousingRegisterTagPicker';
import { HousingRegisterFieldBadge } from './HousingRegisterFieldBadge';
import { HousingRegisterChecklist, type ChecklistItem } from './HousingRegisterChecklist';
import { useHousingFieldState } from '../../../lib/housing/housingFieldState';
import {
    parseHousingFromText,
    type HousingExtractSize,
} from '../../../lib/housing/parseHousingFromText';
import { serverMasterData, housingAreaMasterData } from '../../../data/masterData';
import type { TweetData } from '../../../lib/housing/useTweetFetch';

export type HousingRegisterFormValues = {
    dc?: string;
    server?: string;
    area?: string;
    ward?: number;
    plot?: number;
    size?: HousingExtractSize;
    roomNumber?: number;
    parentHouseSize?: 'S' | 'M' | 'L';
    description?: string;
    tags?: string[];
    postUrl?: string;
    ogImageUrl?: string;
    tweetId?: string;
};

type Props = {
    onSubmit: (values: HousingRegisterFormValues) => void;
    onCancel: () => void;
};

// 必須フィールド: 提出ボタン解除条件 (auto-filled / empty / error は不可、 confirmed / edited のみ可)
const REQUIRED_FIELDS = ['dc', 'server', 'area', 'ward', 'plot', 'size'];
// 自動入力の段階的タイピング表現 (1 フィールドごとに 150ms ずらす)
const TYPING_STAGGER_MS = 150;

export function HousingRegisterForm({ onSubmit, onCancel }: Props) {
    const { t } = useTranslation();
    const fieldState = useHousingFieldState(REQUIRED_FIELDS);
    const [tweetData, setTweetData] = useState<TweetData | null>(null);
    const [tweetSource, setTweetSource] = useState<{ postUrl: string; tweetId: string } | null>(null);
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);

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
    const roomNumber = fieldState.getValue('roomNumber') as number | undefined;
    const parentHouseSize = fieldState.getValue('parentHouseSize') as
        | 'S'
        | 'M'
        | 'L'
        | undefined;

    const showRoomNumber = size === 'Apartment' || size === 'PrivateRoom';
    const showParentSize = size === 'PrivateRoom';

    const dcKeys = Object.keys(serverMasterData);
    const serverKeys = dc ? Object.keys(serverMasterData[dc]?.servers ?? {}) : [];
    const areaKeys = Object.keys(housingAreaMasterData);

    // size が変わった結果、 不要になった条件付きフィールドはクリア
    useEffect(() => {
        if (!showRoomNumber && roomNumber !== undefined) {
            fieldState.clearField('roomNumber');
        }
        if (!showParentSize && parentHouseSize !== undefined) {
            fieldState.clearField('parentHouseSize');
        }
    }, [showRoomNumber, showParentSize, roomNumber, parentHouseSize, fieldState]);

    const handleSubmit = () => {
        const photo = tweetData?.photos?.[0];
        const image =
            tweetSource && photo
                ? { postUrl: tweetSource.postUrl, ogImageUrl: photo, tweetId: tweetSource.tweetId }
                : {};
        onSubmit({
            dc,
            server,
            area,
            ward,
            plot,
            size,
            roomNumber,
            parentHouseSize,
            description,
            tags,
            ...image,
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
            <HousingRegisterSnsUrlField onTweetFetched={handleTweetFetched} />
            {tweetData && <HousingRegisterTweetPreview data={tweetData} />}

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

            {/* Plot */}
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

            {/* Size (type selector) */}
            <div className="housing-field" data-state={fieldState.getState('size')}>
                <HousingRegisterTypeSelector
                    value={size ?? null}
                    onChange={(s) => fieldState.userEdit('size', s)}
                />
                {renderFieldBadge('size')}
            </div>

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
                        { name: 'plot', labelKey: 'housing.register.plot', value: plot },
                        { name: 'size', labelKey: 'housing.register.size', value: size, renderValue: (v) => t(`housing.register.type.${v === 'PrivateRoom' ? 'private' : v === 'Apartment' ? 'apartment' : v}`) },
                    ] as Array<Omit<ChecklistItem, 'state' | 'onConfirm'>>
                ).map((spec) => ({
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
