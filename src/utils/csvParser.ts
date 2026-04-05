import type { TimelineEvent } from '../types';

/**
 * Parses a simple CSV format into TimelineEvents.
 * Expected format: Time,Name,DamageAmount,DamageType,Target
 * Example: 0:15,Raidwide,120000,magical,PT
 * @param csvString The raw CSV text
 * @returns Array of parsed TimelineEvents
 */
export const parseCSVToEvents = (csvString: string): TimelineEvent[] => {
    const lines = csvString.split('\n');
    const events: TimelineEvent[] = [];

    // Auto-detect delimiter: tab (spreadsheet paste) or comma
    const hasTab = lines.some(l => l.includes('\t'));

    const parseTime = (timeStr: string): number | null => {
        const match = timeStr.trim().match(/^(-?)(\d+):(\d{1,2})(?:\.\d+)?$/);
        if (!match) return null;

        const isNegative = match[1] === '-';
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);

        const totalSeconds = (minutes * 60) + seconds;
        return isNegative ? -totalSeconds : totalSeconds;
    };

    const isHeaderRow = (s: string): boolean => {
        const lower = s.toLowerCase();
        return /^(time|時間|タイム)[\t,]/.test(lower);
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || isHeaderRow(trimmed)) return;

        const parts = hasTab
            ? trimmed.split('\t').map(p => p.trim())
            : trimmed.split(',').map(p => p.trim());
        if (parts.length < 2) return;

        const time = parseTime(parts[0]);
        if (time === null) return;

        const name = parts[1];
        const rawDamage = parts.length > 2 && parts[2] ? parts[2].replace(/,/g, '') : '';
        const damageAmount = rawDamage ? parseInt(rawDamage, 10) : undefined;

        let damageType: 'physical' | 'magical' | 'unavoidable' | 'enrage' | undefined = undefined;
        if (parts.length > 3) {
            const typeStr = parts[3].toLowerCase();
            if (['physical', 'magical', 'unavoidable', 'enrage'].includes(typeStr)) {
                damageType = typeStr as 'physical' | 'magical' | 'unavoidable' | 'enrage';
            }
        }

        let target: 'MT' | 'ST' | 'AoE' | undefined = undefined;
        if (parts.length > 4) {
            const tgtStr = parts[4].toUpperCase();
            if (['MT', 'ST', 'AOE', 'PT'].includes(tgtStr)) {
                target = (tgtStr === 'PT' ? 'AoE' : tgtStr) as any;
            }
        }

        events.push({
            id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'evt_' + Math.random().toString(36).substring(2, 9),
            time,
            name: { ja: name, en: name },
            damageAmount: isNaN(damageAmount as number) ? undefined : damageAmount,
            damageType: damageType as any,
            target
        });
    });

    return events;
};
