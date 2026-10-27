export const getMitigationColorClasses = (jobId: string | undefined, ownerId: string, partySortOrder: string = 'role') => {
    if (partySortOrder === 'light_party') {
        const mtGroup = ['MT', 'H1', 'D1', 'D3'];
        if (mtGroup.includes(ownerId)) {
            return {
                bg: "bg-cyan-500/80",
                border: "border-cyan-400/30",
                shadow: "shadow-[0_0_5px_rgba(6,182,212,0.5)]"
            };
        } else {
            return {
                bg: "bg-amber-500/80",
                border: "border-amber-400/30",
                shadow: "shadow-[0_0_5px_rgba(245,158,11,0.5)]"
            };
        }
    }

    if (!jobId) return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };

    const tank = ['pld', 'war', 'drk', 'gnb'];
    const healer = ['whm', 'sch', 'ast', 'sge'];
    const melee = ['mnk', 'drg', 'nin', 'sam', 'rpr', 'vpr'];
    const ranged = ['brd', 'mch', 'dnc', 'blm', 'smn', 'rdm', 'pct'];

    if (tank.includes(jobId)) {
        return {
            bg: "bg-blue-500/80",
            border: "border-blue-400/30",
            shadow: "shadow-[0_0_5px_rgba(59,130,246,0.5)]"
        };
    }
    if (healer.includes(jobId)) {
        return {
            bg: "bg-green-500/80",
            border: "border-green-400/30",
            shadow: "shadow-[0_0_5px_rgba(34,197,94,0.5)]"
        };
    }
    if (melee.includes(jobId)) {
        return {
            bg: "bg-red-500/80",
            border: "border-red-400/30",
            shadow: "shadow-[0_0_5px_rgba(239,68,68,0.5)]"
        };
    }
    if (ranged.includes(jobId)) {
        return {
            bg: "bg-orange-500/80",
            border: "border-orange-400/30",
            shadow: "shadow-[0_0_5px_rgba(249,115,22,0.5)]"
        };
    }

    return {
        bg: "bg-slate-400/80",
        border: "border-slate-300/30",
        shadow: "shadow-[0_0_5px_rgba(148,163,184,0.5)]"
    };
};
