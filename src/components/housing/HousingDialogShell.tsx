import { useEscapeClose } from '../../hooks/useEscapeClose';
import { backdropClose, type BackdropCloseOptions } from '../../utils/backdropClose';

export interface HousingDialogShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  onClose: () => void;
  /** true の間(削除中など)は Esc も外側クリックも効かない */
  locked?: boolean;
  backdropOptions?: BackdropCloseOptions;
  children: React.ReactNode;
}

/**
 * ハウジングの小さな確認窓の「閉じ方」だけを揃える殻(2026-10-27 整頓⑥)。
 * 見た目は持たない: 背景のクラス・style は各窓がそのまま渡す(カードは children)。
 * - Esc で閉じる(重なっていたら一番上だけ・useEscapeClose)
 * - 外側クリックで閉じる(中で押して外で離したら閉じない・入力後は閉じずに枠を縁取る・backdropClose)
 * 見出し付きのガラス窓は HousingPanelModal を使う。新しい窓はどちらかを使う(HousingDialog.guard.test が見張る)。
 */
export const HousingDialogShell: React.FC<HousingDialogShellProps> = ({
  onClose,
  locked = false,
  backdropOptions,
  children,
  ...rest
}) => {
  useEscapeClose(true, () => {
    if (!locked) onClose();
  });

  return (
    <div {...rest} {...backdropClose(locked ? undefined : onClose, backdropOptions)}>
      {children}
    </div>
  );
};
