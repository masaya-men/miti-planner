import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanData, AppliedMitigation, PartyMember } from '../types';
import { getPhaseName } from '../types';
import { useJobs, useMitigations } from '../hooks/useSkillsData';

interface Props {
  planData: PlanData | null;
  loading: boolean;
}

const ROW_HEIGHT = 22; // px — 各行の高さ

export const MitigationSheetPreview: React.FC<Props> = ({ planData, loading }) => {
  const jobs = useJobs();
  const mitigationDefs = useMitigations();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ja') ? 'ja' : i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ko') ? 'ko' : 'en';

  const getJobLabel = (jobId: string | null): string => {
    if (!jobId) return '-';
    const job = jobs.find(j => j.id === jobId);
    if (!job) return jobId.substring(0, 3).toUpperCase();
    return (job.name.en ?? job.name.ja).substring(0, 3).toUpperCase();
  };

  const formatTime = (seconds: number): string => {
    const totalSec = Math.floor(seconds);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ロール色
  const getRoleColor = (memberId: string, members: PartyMember[]): { bg: string; border: string } => {
    const member = members.find(m => m.id === memberId);
    const jobId = member?.jobId;
    if (!jobId) return { bg: 'rgba(128,128,128,0.4)', border: 'rgba(128,128,128,0.3)' };
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { bg: 'rgba(128,128,128,0.4)', border: 'rgba(128,128,128,0.3)' };
    switch (job.role) {
      case 'tank':
        return { bg: 'rgba(59,130,246,0.55)', border: 'rgba(59,130,246,0.35)' };
      case 'healer':
        return { bg: 'rgba(34,197,94,0.55)', border: 'rgba(34,197,94,0.35)' };
      case 'dps':
        return { bg: 'rgba(239,68,68,0.45)', border: 'rgba(239,68,68,0.30)' };
      default:
        return { bg: 'rgba(128,128,128,0.4)', border: 'rgba(128,128,128,0.3)' };
    }
  };

  // 行データ構築
  const { rows, rowTimes } = useMemo(() => {
    if (!planData) return { rows: [], rowTimes: [] };
    const events = planData.timelineEvents;
    const phases = planData.phases;

    let lastPhaseId = '';
    const sorted = events.slice().sort((a, b) => a.time - b.time);
    const times = sorted.map(e => e.time);

    const built = sorted.map(event => {
      const phase = phases.find(p => event.time >= p.startTime && event.time < p.endTime);
      const phaseId = phase?.id ?? '';
      const showPhase = phaseId !== lastPhaseId;
      if (showPhase) lastPhaseId = phaseId;
      const phaseName = showPhase && phase ? getPhaseName(phase.name, lang) : '';

      const eventName = typeof event.name === 'string'
        ? event.name
        : (event.name[lang as keyof typeof event.name] ?? event.name.en ?? event.name.ja ?? '');

      return { event, phaseName, time: formatTime(event.time), name: eventName };
    });

    return { rows: built, rowTimes: times };
  }, [planData, lang, jobs]);

  // 各セル: この行で「開始する」軽減と「アクティブだが開始済み」の軽減を分離
  const cellData = useMemo(() => {
    if (!planData) return [];
    const mitigations = planData.timelineMitigations;
    const members = planData.partyMembers;

    return rows.map((row, rowIdx) => {
      const eventTime = row.event.time;
      return members.map(member => {
        // この行で開始する軽減
        const starting = mitigations.filter((m: AppliedMitigation) => {
          if (m.ownerId !== member.id) return false;
          // 最も近い行を見つける（この軽減の開始時刻に最も近いイベント行）
          let closestRowIdx = 0;
          let minDist = Infinity;
          for (let i = 0; i < rowTimes.length; i++) {
            const dist = Math.abs(rowTimes[i] - m.time);
            if (dist < minDist) { minDist = dist; closestRowIdx = i; }
          }
          return closestRowIdx === rowIdx;
        });

        // アクティブだが別行で開始（バー継続のみ）
        const active = mitigations.some((m: AppliedMitigation) =>
          m.ownerId === member.id &&
          eventTime >= m.time &&
          eventTime <= m.time + m.duration
        );

        return { starting, active };
      });
    });
  }, [planData, rows, rowTimes]);

  if (loading) {
    return (
      <div className="miti-table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="miti-spinner" />
      </div>
    );
  }

  if (!planData) {
    return (
      <div className="miti-table-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>-</span>
      </div>
    );
  }

  const members = planData.partyMembers;

  // エフェクト棒の高さ計算: duration秒 → 何行分か
  const getBarHeight = (mit: AppliedMitigation): number => {
    // この軽減が何行にまたがるか計算
    const endTime = mit.time + mit.duration;
    let rowSpan = 0;
    for (const t of rowTimes) {
      if (t > mit.time && t <= endTime) rowSpan++;
    }
    return Math.max(0, rowSpan * ROW_HEIGHT);
  };

  return (
    <div className="miti-table-wrap">
      <table className="miti-table">
        <thead>
          <tr>
            <th className="phase-col" />
            <th className="time-col">TIME</th>
            <th className="attack-col">SKILL</th>
            {members.map(member => (
              <th key={member.id}>{getJobLabel(member.jobId)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={row.event.id ?? rowIdx} style={{ height: ROW_HEIGHT }}>
              <td className="phase-col">{row.phaseName}</td>
              <td className="time-col">{row.time}</td>
              <td className="attack-col" title={row.name}>{row.name}</td>
              {members.map((member, memberIdx) => {
                const cell = cellData[rowIdx]?.[memberIdx];
                if (!cell) return <td key={member.id} />;

                const roleColor = getRoleColor(member.id, members);

                return (
                  <td key={member.id} style={{ position: 'relative', overflow: 'visible' }}>
                    {/* 開始する軽減: アイコン + エフェクト棒 */}
                    {cell.starting.map((mit, i) => {
                      const def = mitigationDefs.find(d => d.id === mit.mitigationId);
                      const barH = getBarHeight(mit);
                      return (
                        <span key={mit.id ?? i} className="miti-icon-wrap">
                          {def?.icon && (
                            <img
                              className="miti-skill-icon"
                              src={def.icon}
                              alt=""
                              loading="lazy"
                            />
                          )}
                          {!def?.icon && (
                            <span
                              className="miti-skill-pip"
                              style={{ background: roleColor.bg, border: `1px solid ${roleColor.border}` }}
                            />
                          )}
                          {/* エフェクト棒 */}
                          {barH > 0 && (
                            <span
                              className="miti-duration-bar"
                              style={{
                                height: barH,
                                background: roleColor.bg,
                                borderColor: roleColor.border,
                              }}
                            />
                          )}
                        </span>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
