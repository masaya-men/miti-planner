import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HousingPanelModal } from '../HousingPanelModal';
import { AllmarksImportProgress } from '../browse/AllmarksImportProgress';
import type { AllmarksImportProgress as AllmarksImportProgressState } from '../../../lib/housing/useAllmarksImport';

const IMPORTING: AllmarksImportProgressState = {
  status: 'importing',
  total: 50,
  processed: 23,
  added: 20,
  failed: 3,
  limitReached: false,
  shareNotFound: false,
  regionChoices: [],
  regionExcluded: 0,
};

const CHOOSING_REGION: AllmarksImportProgressState = {
  status: 'choosing-region',
  total: 12,
  processed: 12,
  added: 12,
  failed: 0,
  limitReached: false,
  shareNotFound: false,
  regionChoices: [
    { region: 'JP', count: 8 },
    { region: 'NA', count: 4 },
  ],
  regionExcluded: 0,
};

const DONE: AllmarksImportProgressState = {
  status: 'done',
  total: 50,
  processed: 50,
  added: 45,
  failed: 5,
  limitReached: false,
  shareNotFound: false,
  regionChoices: [],
  regionExcluded: 0,
};

const PRESETS = { importing: IMPORTING, 'choosing-region': CHOOSING_REGION, done: DONE } as const;
type PresetKey = keyof typeof PRESETS;

/**
 * DEV専用: Allmarksまとめてインポートの進捗表示を、実際に本番で使われている
 * `HousingPanelModal` + `AllmarksImportProgress` そのものを使って確認するプレビュー。
 * 実際のインポート操作(Allmarksリンク貼り付け)無しで、本番と全く同じ見た目(モーダルの
 * 大きさ・余白・背景)を単体確認・微調整できる。
 * 本番build非露出(/housing/dev/allmarks-animation、import.meta.env.DEV ガード)。
 */
export const AllmarksAnimationPreviewPage: React.FC = () => {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<PresetKey>('importing');

  return (
    <>
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 10000, display: 'flex', gap: 8 }}>
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setPreset(key)}
            style={{ padding: '6px 10px', fontWeight: preset === key ? 700 : 400 }}
          >
            {key}
          </button>
        ))}
      </div>
      <HousingPanelModal
        open
        onClose={() => {}}
        title={t('housing.ephemeral.panel_title')}
        closeLabel={t('common.close')}
        maxWidth={480}
        backdrop="frost"
      >
        <form className="housing-ephemeral-panel">
          <p className="housing-ephemeral-note housing-ephemeral-note-lead">
            {t('housing.ephemeral.note_volatile')}
          </p>
          <AllmarksImportProgress progress={PRESETS[preset]} onClose={() => {}} onChooseRegion={() => {}} />
        </form>
      </HousingPanelModal>
    </>
  );
};
