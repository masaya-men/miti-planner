// ─── Damage rounding (same as damageRounding.ts) ───
function roundDamageCeil(value) {
    if (value <= 999 || value <= 0) return value;
    const digits = Math.floor(Math.log10(value)) + 1;
    const divisor = Math.pow(10, digits - 3);
    return Math.ceil(value / divisor) * divisor;
}

// ─── Step 7: Multi-log merge ───
export function mergeTimelines(timelines) {
    if (timelines.length === 0) return [];
    if (timelines.length === 1) return timelines[0];

    // Start with first timeline as base
    const merged = timelines[0].map(ev => ({ ...ev }));
    const MERGE_WINDOW_SEC = 2;

    for (let tIdx = 1; tIdx < timelines.length; tIdx++) {
        const other = timelines[tIdx];

        for (const oEv of other) {
            const isAA = oEv.name.en === 'AA';

            // AAはtargetを無視して時刻のみでマッチ（ログごとにMT/STが異なるため）
            // 非AAは従来通り name + target + 時刻でマッチ
            const matchIdx = merged.findIndex(mEv =>
                mEv.name.en === oEv.name.en &&
                (isAA || mEv.target === oEv.target) &&
                Math.abs(mEv.time - oEv.time) <= MERGE_WINDOW_SEC
            );

            if (matchIdx >= 0) {
                // Update damage to maximum
                const mEv = merged[matchIdx];
                if (oEv.damageAmount !== undefined) {
                    if (mEv.damageAmount === undefined || oEv.damageAmount > mEv.damageAmount) {
                        mEv.damageAmount = oEv.damageAmount;
                    }
                }
                // AAのtargetは多数決：同じ時刻でMT/STどちらが多いかを追跡
                if (isAA) {
                    if (!mEv._targetVotes) mEv._targetVotes = { MT: 0, ST: 0 };
                    mEv._targetVotes[mEv.target] = (mEv._targetVotes[mEv.target] || 0) + 1;
                    mEv._targetVotes[oEv.target] = (mEv._targetVotes[oEv.target] || 0) + 1;
                }
            } else {
                // New event not in base — add it
                merged.push({ ...oEv });
            }
        }
    }

    // AAイベントのtargetを多数決で確定し、内部プロパティを除去
    for (const ev of merged) {
        if (ev._targetVotes) {
            ev.target = (ev._targetVotes.ST || 0) > (ev._targetVotes.MT || 0) ? 'ST' : 'MT';
            delete ev._targetVotes;
        }
    }

    // Re-sort
    merged.sort((a, b) => a.time !== b.time ? a.time - b.time : ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[a.target] ?? 0) - ({ 'AoE': 0, 'MT': 1, 'ST': 2 }[b.target] ?? 0));

    return merged;
}

// ─── Step 8: Apply rounding and generate IDs ───
export function finalizeTimeline(events) {
    let counter = 0;
    return events.map(ev => ({
        id: `tpl_${counter++}_${Math.random().toString(36).slice(2, 8)}`,
        time: ev.time,
        name: ev.name,
        damageType: ev.damageType,
        damageAmount: ev.damageAmount !== undefined ? roundDamageCeil(ev.damageAmount) : undefined,
        target: ev.target,
    }));
}

// ─── Phase extraction from fight metadata ───
export function extractPhases(fight, phaseNames = {}) {
    if (!fight.phaseTransitions || fight.phaseTransitions.length === 0) return [];

    const ref = fight.startTime;
    const raw = fight.phaseTransitions.map(pt => {
        const phaseName = phaseNames[String(pt.id)];
        let name;
        if (phaseName) {
            name = typeof phaseName === 'string'
                ? { ja: '', en: phaseName }
                : phaseName;
        }
        return {
            id: pt.id,
            startTimeSec: Math.floor((pt.startTime - ref) / 1000),
            ...(name ? { name } : {}),
        };
    });

    // 同じstartTimeSecが連続するフェーズを修正（例: DSRのP1/P2が両方0s）
    // 後続フェーズのstartTimeSecから区間を按分して境界を推定する
    for (let i = 1; i < raw.length; i++) {
        if (raw[i].startTimeSec === raw[i - 1].startTimeSec) {
            // 次の異なるstartTimeSecを持つフェーズを探す
            const nextDiff = raw.find((p, j) => j > i && p.startTimeSec > raw[i].startTimeSec);
            if (nextDiff) {
                // P1=0s, P2=0s, P3=182s の場合 → P2の開始を P3の半分付近に設定
                // ただしフェーズ数に応じて按分
                const span = nextDiff.startTimeSec - raw[i - 1].startTimeSec;
                const duplicateCount = raw.filter((p, j) => j >= i - 1 && j < raw.indexOf(nextDiff) && p.startTimeSec === raw[i - 1].startTimeSec).length;
                for (let k = i; k < raw.indexOf(nextDiff); k++) {
                    if (raw[k].startTimeSec === raw[i - 1].startTimeSec) {
                        const idx = k - (i - 1);
                        raw[k].startTimeSec = raw[i - 1].startTimeSec + Math.floor(span * idx / duplicateCount);
                    }
                }
            }
        }
    }

    return raw;
}
