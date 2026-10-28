// HousingEditSourcePanel*.test.tsx 共通の準備 (vi.mock は hoist されるため各テストファイルに直接書く)
import { render } from '@testing-library/react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import i18n from 'i18next';
import jaTranslations from '../../../../locales/ja.json';
import { ToastContainer } from '../../../Toast';
import { HousingEditSourcePanel } from '../HousingEditSourcePanel';

export function initTestI18n() {
  i18n.use(initReactI18next).init({
    lng: 'ja',
    fallbackLng: 'ja',
    resources: { ja: { translation: jaTranslations } },
    interpolation: { escapeValue: false },
  });
}
// vi.fn() の戻り値 (Mock<Procedure | Constructable>) はコンポーネントの厳密な関数型と構造的に
// 一致しないため、テスト内では any 経由で HousingEditSourcePanel の props 型に合わせる
// (.mock.calls での検証は呼び出し元の変数の型のまま行う)。
export function buildTree(props: {
  sourceImageUrls: string[];
  onSourceImageUrlsChange: (next: string[]) => void;
  videoPreview: { url: string; posterUrl: string; aspectRatio?: number } | null;
  sourcePostUrls: string[];
  onCommitSnsFetch: any;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <HousingEditSourcePanel
        listingId="listing1"
        sourceImageUrls={props.sourceImageUrls}
        onSourceImageUrlsChange={props.onSourceImageUrlsChange}
        videoPreview={props.videoPreview}
        sourcePostUrls={props.sourcePostUrls}
        onCommitSnsFetch={props.onCommitSnsFetch}
      />
      <ToastContainer />
    </I18nextProvider>
  );
}

export function renderPanel(
  overrides: Partial<Omit<Parameters<typeof buildTree>[0], 'onCommitSnsFetch'>> & {
    onCommitSnsFetch?: any;
  } = {},
) {
  const onSourceImageUrlsChange = overrides.onSourceImageUrlsChange ?? vi.fn();
  const onCommitSnsFetch = overrides.onCommitSnsFetch ?? vi.fn().mockResolvedValue({ ok: true });
  const utils = render(
    buildTree({
      sourceImageUrls: overrides.sourceImageUrls ?? ['a', 'b'],
      onSourceImageUrlsChange,
      videoPreview: overrides.videoPreview ?? null,
      sourcePostUrls: overrides.sourcePostUrls ?? [],
      onCommitSnsFetch,
    }),
  );
  return { ...utils, onSourceImageUrlsChange, onCommitSnsFetch };
}
