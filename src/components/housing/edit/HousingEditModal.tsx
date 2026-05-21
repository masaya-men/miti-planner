/**
 * Phase 3: 家主が自分の物件を編集するモーダル。
 *
 * 実装は HousingRegisterModal を mode='edit' + initialValues で呼ぶ薄ラッパー。
 * フォーム UI / バリデーション / API 呼び出しは HousingRegisterView 内に集約。
 */
import { HousingRegisterModal } from '../workspace/HousingRegisterModal';
import type { HousingListing } from '../../../types/housing';

export interface HousingEditModalProps {
  open: boolean;
  onClose: () => void;
  listing: HousingListing;
  /** 保存成功時に呼ぶ callback (詳細の再 fetch + 関連通報の解決を親側でやる) */
  onSaved?: () => void;
}

export const HousingEditModal: React.FC<HousingEditModalProps> = ({
  open,
  onClose,
  listing,
  onSaved,
}) => {
  return (
    <HousingRegisterModal
      open={open}
      onClose={onClose}
      mode="edit"
      initialValues={listing}
      onSaved={onSaved}
    />
  );
};
