import type { SavedPlan, Job } from '../../types';
import { getContentById } from '../../data/contentRegistry';
import { getPhaseName } from '../../types';
import i18n from '../../i18n';

export const getContentLabel = (plan: SavedPlan): string => {
    if (!plan.contentId) return '';
    const content = getContentById(plan.contentId);
    if (!content) return plan.contentId;
    return getPhaseName(content.name, i18n.language);
};

export const getMemberJobIcons = (plan: SavedPlan, jobs: Job[]): { id: string; icon: string; jobName: string }[] => {
    const members = plan.data?.partyMembers ?? [];
    return members
        .map(m => {
            if (!m.jobId) return null;
            const job = jobs.find(j => j.id === m.jobId);
            if (!job) return null;
            return { id: m.id, icon: job.icon, jobName: getPhaseName(job.name, i18n.language) };
        })
        .filter((x): x is { id: string; icon: string; jobName: string } => x !== null);
};
