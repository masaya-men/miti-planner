import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Job, PartyMember } from '../../types';
import { SlotItem } from './PartySlotItem';
import { mtGroupIndices, stGroupIndices } from './partyJobGroups';

interface PartySlotGroupsProps {
    draftMembers: PartyMember[];
    slotDropRefs: React.RefObject<Map<number, HTMLDivElement>>;
    focusedSlot: number | null;
    myMemberId: string | null;
    drag: { isDragging: boolean; activeTargetId: string | null };
    theme: string;
    JOBS: Job[];
    contentLanguage: string;
    handleFocusToggle: (index: number) => void;
    handleRemoveJob: (memberId: string) => void;
    handleMyJobToggle: (memberId: string, isMyJob: boolean) => void;
}

/** パーティ設定の MT グループと ST グループ(スロット 8 つ)。 */
export const PartySlotGroups: React.FC<PartySlotGroupsProps> = ({
    draftMembers, slotDropRefs, focusedSlot, myMemberId, drag, theme, JOBS, contentLanguage,
    handleFocusToggle, handleRemoveJob, handleMyJobToggle,
}) => {
    const { t } = useTranslation();
    return (<>
                        {/* MTグループ */}
                        <div>
                            <div className="flex items-center justify-between mb-2 pl-1 pr-2">
                                <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                    <h3 className="text-app-text text-app-md font-black tracking-widest uppercase dark:drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">MT Group</h3>
                                </div>
                                <span className="text-app-sm text-app-text font-bold hidden md:inline-block dark:drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)]">
                                    {t('party.my_job_instruction_new')}
                                </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {mtGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <div key={member.id} ref={(el) => { if (el) slotDropRefs.current.set(index, el); }}>
                                            <SlotItem
                                                index={index}
                                                member={member}
                                                isFocused={focusedSlot === index}
                                                isMyJob={myMemberId === member.id}
                                                isDropTarget={drag.isDragging && drag.activeTargetId === String(index)}
                                                theme={theme}
                                                jobs={JOBS}
                                                contentLanguage={contentLanguage}
                                                onFocusToggle={handleFocusToggle}
                                                onRemoveJob={handleRemoveJob}
                                                onMyJobToggle={handleMyJobToggle}
                                                {...(index === mtGroupIndices[1] ? { dataTutorial: 'party-healer-slot' } : {})}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* STグループ */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 pl-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-app-text"></span>
                                <h3 className="text-app-text text-app-md font-black tracking-widest uppercase dark:drop-shadow-[0_1px_3px_rgba(0,0,0,1)]">ST Group</h3>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {stGroupIndices.map(index => {
                                    const member = draftMembers[index];
                                    if (!member) return null;
                                    return (
                                        <div key={member.id} ref={(el) => { if (el) slotDropRefs.current.set(index, el); }}>
                                            <SlotItem
                                                index={index}
                                                member={member}
                                                isFocused={focusedSlot === index}
                                                isMyJob={myMemberId === member.id}
                                                isDropTarget={drag.isDragging && drag.activeTargetId === String(index)}
                                                theme={theme}
                                                jobs={JOBS}
                                                contentLanguage={contentLanguage}
                                                onFocusToggle={handleFocusToggle}
                                                onRemoveJob={handleRemoveJob}
                                                onMyJobToggle={handleMyJobToggle}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
    </>);
};
