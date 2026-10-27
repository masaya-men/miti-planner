import type { RegisterAddressValues } from '../RegisterSectionAddress';
import { RegisterGuide } from '../RegisterGuide';
import { RegisterCheckPanel } from '../RegisterCheckPanel';
import { RegisterDuplicatePanel, type RegisterDuplicateState } from '../RegisterDuplicatePanel';
import { RegisterAddressMap } from '../RegisterAddressMap';
import type { DuplicateEntry } from '../../../../lib/housingApiClient';
import type { ComponentProps } from 'react';

export const RegisterRightColumn: React.FC<{ mode: 'create' | 'edit'; checkPanelItems: ComponentProps<typeof RegisterCheckPanel>['items']; duplicateState: RegisterDuplicateState; duplicates: DuplicateEntry[]; privateMatchCount: number; address: RegisterAddressValues }> = ({ mode, checkPanelItems, duplicateState, duplicates, privateMatchCount, address }) => {
  return (
    <section className="housing-register-panel" data-region="right">
      <div className="housing-register-col housing-register-col-right">
        <RegisterCheckPanel items={checkPanelItems} />
        {/* 重複照会パネルは create 専用。編集モードは自分の doc が必ずヒットして誤「重複」に
            なるため出さない (ライブ照会 effect 側も mode==='edit' で走らせない・I 根治)。 */}
        {mode !== 'edit' && (
          <RegisterDuplicatePanel
            state={duplicateState}
            duplicates={duplicates}
            privateMatchCount={privateMatchCount}
          />
        )}
        {/* #5: 静的ミニマップから、ツアーと同じ「動くマップ」に統一。住所が地図解決
            できるまで (area+plot / area+apartmentBuilding) は何も出さない。 */}
        <RegisterAddressMap address={address} />

        {/* 「登録の流れ」を左から移設。左のライブステッパー (現在地) と役割が重複していたため、
            教育的な説明はこちら (参照材料) に置き、左は現在地表示に専念させる。 */}
        <RegisterGuide />
      </div>
    </section>
  );
};
