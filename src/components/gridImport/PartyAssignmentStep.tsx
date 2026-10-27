import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Job } from '../../types';
import type { PartyAssignment, PartySlot, SlotRole } from '../../lib/sheetImport/partyAssignment';
import type { Lang4 } from './gridImportModel';

/** ステップ3: 検出ジョブをロール別に MT/ST・H1/H2・D1〜D4 へ割り当てる。自動仮割当済み・入れ替え可。 */
export const PartyAssignmentStep: React.FC<{
  assignment: PartyAssignment;
  detectedByRole: Record<SlotRole, string[]>;
  jobs: Job[];
  onSlotChange: (slot: PartySlot, jobId: string | null) => void;
  gridLang: Lang4;
}> = ({ assignment, detectedByRole, jobs, onSlotChange, gridLang }) => {
  const { t } = useTranslation();
  const ROWS: { role: SlotRole; slots: PartySlot[]; label: string }[] = [
    { role: 'tank', slots: ['MT', 'ST'], label: t('roles.tank') },
    { role: 'healer', slots: ['H1', 'H2'], label: t('roles.healer') },
    { role: 'dps', slots: ['D1', 'D2', 'D3', 'D4'], label: t('roles.dps') },
  ];
  const anyDetected = ROWS.some((r) => detectedByRole[r.role].length > 0);
  const jobName = (id: string) => {
    const j = jobs.find((x) => x.id === id);
    return j ? ((j.name[gridLang as keyof typeof j.name] ?? j.name.ja) || j.id) : id;
  };

  if (!anyDetected) {
    return (
      <div className="flex-1 overflow-y-auto px-5 py-5 flex items-center justify-center">
        <p className="text-app-2xl text-app-text-muted text-center">{t('gridImport.no_party_detected')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
      {ROWS.filter((r) => detectedByRole[r.role].length > 0).map(({ role, slots, label }) => (
        <div key={role} className="flex flex-col gap-2">
          <span className="text-app-lg font-bold text-app-text-muted">{label}</span>
          <div className="flex flex-wrap items-center gap-3">
            {slots.map((slot) => (
              <label key={slot} className="flex items-center gap-2">
                <span className="w-10 text-app-2xl font-bold text-app-text">{slot}</span>
                <select
                  className="min-w-[140px] appearance-none bg-app-surface2 border border-app-border rounded-lg px-3 py-1.5 text-app-2xl text-app-text focus:outline-none focus:border-app-text"
                  value={assignment[slot] ?? ''}
                  onChange={(e) => onSlotChange(slot, e.target.value || null)}
                  aria-label={slot}
                >
                  <option value="">{t('gridImport.slot_empty')}</option>
                  {detectedByRole[role].map((id) => (
                    <option key={id} value={id}>{jobName(id)}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
