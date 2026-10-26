import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Save } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { ModalHeader, ModalFooter, ModalButton, INPUT_CLASS } from './ui/ModalParts';

interface SaveDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string) => void;
    defaultTitle?: string;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({ 
    isOpen, 
    onClose, 
    onSave, 
    defaultTitle = '' 
}) => {
    const { t } = useTranslation();
    const [title, setTitle] = useState(defaultTitle);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTitle(defaultTitle);
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [isOpen, defaultTitle]);

    const handleSave = () => {
        if (title.trim()) {
            onSave(title.trim());
        }
    };

    return (
        <ModalShell isOpen={isOpen} onClose={onClose} className="w-full max-w-[400px]">
            <ModalHeader title={t('save_dialog.title', 'Save Plan')} onClose={onClose} closeLabel={t('common.close')} />

            <div className="p-6 space-y-6">
                <div className="space-y-2">
                    <label className="text-app-base font-bold text-app-text pl-1">
                        {t('save_dialog.plan_name_label', 'Plan Name')}
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                            if (e.key === 'Escape') onClose();
                        }}
                        placeholder={t('save_dialog.plan_name_placeholder', 'Enter plan name...')}
                        className={INPUT_CLASS}
                    />
                </div>
            </div>

            <ModalFooter>
                <ModalButton variant="secondary" onClick={onClose}>
                    {t('common.cancel', 'Cancel')}
                </ModalButton>
                <ModalButton variant="primary" onClick={handleSave} disabled={!title.trim()}>
                    <Save size={16} />
                    {t('common.save', 'Save')}
                </ModalButton>
            </ModalFooter>
        </ModalShell>
    );
};
