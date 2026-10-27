import { useState } from 'react';
import type { TimelineEvent, Mitigation, AppliedMitigation, LocalizedString, Phase, Label } from '../../types';

/*
 * 窓(モーダル・ポップオーバー・ドロップダウン・選択モード)の開閉 state。Timeline 本体から移したもの。
 * 本体では離れた位置に散らばっていたが、useState のみで effect を含まないため、
 * 最初に使う位置(プレビュー強調フックより前)へまとめて呼んでも順序への影響はない。
 */
export function useTimelineDialogs() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
    const [selectedTime, setSelectedTime] = useState<number>(0);
    const [eventModalPosition, setEventModalPosition] = useState({ x: 0, y: 0 });
    const [eventPopover, setEventPopover] = useState<{ event: TimelineEvent; position: { x: number; y: number } } | null>(null);

    const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);
    const [selectedPhase, setSelectedPhase] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedPhaseTime, setSelectedPhaseTime] = useState<number>(0);
    const [phaseModalPosition, setPhaseModalPosition] = useState({ x: 0, y: 0 });
    const [timelineSelectMode, setTimelineSelectMode] = useState<{ phaseId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);
    const [labelSelectMode, setLabelSelectMode] = useState<{ labelId: string; startTime: number; field: 'startTime' | 'endTime' } | null>(null);

    const [phasePopover, setPhasePopover] = useState<{ phase: Phase; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
    const [selectedLabel, setSelectedLabel] = useState<{ id: string; name: LocalizedString; startTime: number; endTime: number } | null>(null);
    const [selectedLabelTime, setSelectedLabelTime] = useState<number>(0);
    const [labelModalPosition, setLabelModalPosition] = useState({ x: 0, y: 0 });
    const [labelPopover, setLabelPopover] = useState<{ label: Label; position: { x: number; y: number }; clickTime: number } | null>(null);

    const [mobileMitiFlow, setMobileMitiFlow] = useState<{
        isOpen: boolean;
        time: number;
        step: 'job' | 'skill';
        selectedMemberId: string | null;
        // 対象/鼓舞の選択が必要なスキルをタップしたとき、サブ選択ビューに渡す情報。null = 通常のスキル一覧。
        pending?:
            | { mode: 'target'; mit: Mitigation; ownerId: string }
            | { mode: 'shield'; mit: Mitigation; ownerId: string; shields: AppliedMitigation[] }
            | null;
    }>({ isOpen: false, time: 0, step: 'job', selectedMemberId: null, pending: null });

    const [mobileContextMenu, setMobileContextMenu] = useState<{
        isOpen: boolean;
        event: TimelineEvent | null;
        time: number;
    } | null>(null);

    const [mitigationSelectorOpen, setMitigationSelectorOpen] = useState(false);
    const [selectorPosition, setSelectorPosition] = useState({ x: 0, y: 0 });
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [selectedMitigationTime, setSelectedMitigationTime] = useState<number>(0);

    const [jobPickerOpen, setJobPickerOpen] = useState(false);
    const [jobPickerPosition, setJobPickerPosition] = useState({ x: 0, y: 0 });
    const [jobPickerMemberId, setJobPickerMemberId] = useState<string | null>(null);

    // ヘッダーナビゲーション
    const [phaseDropdownOpen, setPhaseDropdownOpen] = useState(false);
    const [gimmickDropdownOpen, setGimmickDropdownOpen] = useState(false);
    const [timeInputOpen, setTimeInputOpen] = useState(false);
    const [mechanicSearchOpen, setMechanicSearchOpen] = useState(false);

    const [migrationConfig, setMigrationConfig] = useState<{
        isOpen: boolean;
        memberId: string;
        oldJobId: string;
        newJobId: string;
    } | null>(null);

    // 取り込み・確認ダイアログ・全消しメニュー
    const [importModalOpen, setImportModalOpen] = useState(false);
    const [showGridImport, setShowGridImport] = useState(false);
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void; variant?: 'danger' | 'warning'; confirmLabel?: string; cancelLabel?: string } | null>(null);
    const [clearMenuOpen, setClearMenuOpen] = useState(false);

    return {
        isModalOpen, setIsModalOpen, selectedEvent, setSelectedEvent, selectedTime, setSelectedTime,
        eventModalPosition, setEventModalPosition, eventPopover, setEventPopover,
        isPhaseModalOpen, setIsPhaseModalOpen, selectedPhase, setSelectedPhase, selectedPhaseTime, setSelectedPhaseTime,
        phaseModalPosition, setPhaseModalPosition, timelineSelectMode, setTimelineSelectMode, labelSelectMode, setLabelSelectMode,
        phasePopover, setPhasePopover,
        isLabelModalOpen, setIsLabelModalOpen, selectedLabel, setSelectedLabel, selectedLabelTime, setSelectedLabelTime,
        labelModalPosition, setLabelModalPosition, labelPopover, setLabelPopover,
        mobileMitiFlow, setMobileMitiFlow, mobileContextMenu, setMobileContextMenu,
        mitigationSelectorOpen, setMitigationSelectorOpen, selectorPosition, setSelectorPosition,
        selectedMemberId, setSelectedMemberId, selectedMitigationTime, setSelectedMitigationTime,
        jobPickerOpen, setJobPickerOpen, jobPickerPosition, setJobPickerPosition, jobPickerMemberId, setJobPickerMemberId,
        phaseDropdownOpen, setPhaseDropdownOpen, gimmickDropdownOpen, setGimmickDropdownOpen,
        timeInputOpen, setTimeInputOpen, mechanicSearchOpen, setMechanicSearchOpen,
        migrationConfig, setMigrationConfig,
        importModalOpen, setImportModalOpen, showGridImport, setShowGridImport, confirmDialog, setConfirmDialog,
        clearMenuOpen, setClearMenuOpen,
    };
}
