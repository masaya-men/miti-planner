import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanData, AppliedMitigation, PartyMember } from '../types';
import { getPhaseName } from '../types';
import { useJobs } from '../hooks/useSkillsData';

interface Props {
  planData: PlanData | null;
  loading: boolean;
}

export const MitigationSheetPreview: React.FC<Props> = ({ planData, loading }) => {
  const jobs = useJobs();
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('ja') ? 'ja' : i18n.language.startsWith('zh') ? 'zh' : i18n.language.startsWith('ko') ? 'ko' : 'en';

  // ジョブ略称取得
  const getJobLabel = (jobId: string | null): string => {
    if (!jobId) return '-';
    const job = jobs.find(j => j.id === jobId);
    if (!job) return jobId.substring(0, 3).toUpperCase();
    return (job.name.en ?? job.name.ja).substring(0, 3).toUpperCase();
  };

  // ロール別ピップカラー
  const getPipStyle = (memberId: string, members: PartyMember[]): React.CSSProperties | null => {
    const member = members.find(m => m.id === memberId);
    if (!member) return null;
    const jobId = member.jobId;
    if (!jobId) return null;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { background: 'rgba(128,128,128,0.4)', border: '1px solid rgba(128,128,128,0.3)' };
    switch (job.role) {
      case 'tank':
        return { background: 'rgba(59,130,246,0.5)', border: '1px solid rgba(59,130,246,0.3)' };
      case 'healer':
        return { background: 'rgba(34,197,94,0.5)', border: '1px solid rgba(34,197,94,0.3)' };
      case 'dps':
        return { background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.3)' };
      default:
        return { background: 'rgba(128,128,128,0.4)', border: '1px solid rgba(128,128,128,0.3)' };
    }
  };

  // 時間フォーマット M:SS（timeは秒単位）
  const formatTime = (seconds: number): string => {
    const totalSec = Math.floor(seconds);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // イベントごとに各メンバーが軽減を持っているかの判定テーブル
  const rows = useMemo(() => {
    if (!planData) return [];
    const events = planData.timelineEvents;
    const mitigations = planData.timelineMitigations;
    const members = planData.partyMembers;
    const phases = planData.phases;

    // フェーズ名を表示するか判定用
    let lastPhaseId = '';

    return events
      .slice()
      .sort((a, b) => a.time - b.time)
      .map(event => {
        // このイベントが属するフェーズを検索
        const phase = phases.find(p => event.time >= p.startTime && event.time < p.endTime);
        const phaseId = phase?.id ?? '';
        const showPhase = phaseId !== lastPhaseId;
        if (showPhase) lastPhaseId = phaseId;
        const phaseName = showPhase && phase ? getPhaseName(phase.name, lang) : '';

        // 各メンバーについて、このイベント時刻にアクティブな軽減があるかチェック
        const memberHasMiti = members.map(member => {
          return mitigations.some(
            (m: AppliedMitigation) =>
              m.ownerId === member.id &&
              event.time >= m.time &&
              event.time <= m.time + m.duration
          );
        });

        const eventName = typeof event.name === 'string'
          ? event.name
          : (event.name[lang as keyof typeof event.name] ?? event.name.en ?? event.name.ja ?? '');

        return {
          event,
          phaseName,
          time: formatTime(event.time),
          name: eventName,
          memberHasMiti,
        };
      });
  }, [planData, lang, jobs]);

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
          {rows.map((row, idx) => (
            <tr key={row.event.id ?? idx}>
              <td className="phase-col">{row.phaseName}</td>
              <td className="time-col">{row.time}</td>
              <td className="attack-col" title={row.name}>{row.name}</td>
              {row.memberHasMiti.map((hasMiti, memberIdx) => {
                const style = hasMiti ? getPipStyle(members[memberIdx].id, members) : null;
                return (
                  <td key={members[memberIdx].id}>
                    {hasMiti && style && (
                      <span className="miti-skill-pip" style={style} />
                    )}
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
