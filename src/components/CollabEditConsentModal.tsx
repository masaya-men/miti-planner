import React from "react";
import { useTranslation } from "react-i18next";
import { ModalShell } from "./ui/ModalShell";
import { ModalHeader, ModalFooter, ModalButton } from "./ui/ModalParts";

interface Props {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

/** ⑤-3c: 部屋ごとの初回フル警告モーダル（同意必須・cancel で閲覧のみ）。機能色 赤=危険。 */
export const CollabEditConsentModal: React.FC<Props> = ({ isOpen, onAccept, onCancel }) => {
  const { t } = useTranslation();
  return (
    <ModalShell isOpen={isOpen} onClose={onCancel} className="w-[400px] max-w-[90vw]">
      <ModalHeader title={t("collab.consent_title")} onClose={onCancel} closeLabel={t("common.close")} />
      <div className="p-6 overflow-y-auto">
        <p className="text-app-lg text-app-text-muted leading-relaxed mb-3">{t("collab.consent_body_1")}</p>
        <p className="text-app-lg text-app-text-muted leading-relaxed">{t("collab.consent_body_2")}</p>
      </div>
      <ModalFooter>
        <ModalButton variant="secondary" onClick={onCancel}>{t("collab.consent_cancel")}</ModalButton>
        <ModalButton variant="danger" onClick={onAccept}>{t("collab.consent_accept")}</ModalButton>
      </ModalFooter>
    </ModalShell>
  );
};
