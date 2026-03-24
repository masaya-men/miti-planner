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

    // Helper to parse time string (e.g., "1:15" -> 75, "0:10" -> 10, "-0:10" -> -10)
    const parseTime = (timeStr: string): number | null => {
        const match = timeStr.trim().match(/^(-?)(\d+):(\d{2})$/);
        if (!match) return null;

        const isNegative = match[1] === '-';
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);

        const totalSeconds = (minutes * 60) + seconds;
        return isNegative ? -totalSeconds : totalSeconds;
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('Time,')) return; // Skip empty, comments, or headers

        // Split by comma, handling potential quotes (simplified)
        const parts = trimmed.split(',').map(p => p.trim());
        if (parts.length < 2) return; // Need at least time and name

        const time = parseTime(parts[0]);
        if (time === null) return; // Invalid time format

        const name = parts[1];
        const damageAmount = parts.length > 2 && parts[2] ? parseInt(parts[2], 10) : undefined;

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
            damageType: damageType as any, // Cast to any to bypass strict optional check since interface doesn't allow undefined but it exists in dataset 
            target
        });
    });

    return events;
};
