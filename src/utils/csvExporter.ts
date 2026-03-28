/**
 * 軽減表データをCSVとしてエクスポート
 * タイムラインイベント + 各イベントに適用されている軽減を1行にまとめる
 */
import type { TimelineEvent, AppliedMitigation, PartyMember } from '../types';
import { getMitigationsFromStore, getJobsFromStore } from '../hooks/useSkillsData';

/** 秒を m:ss 形式に変換 */
function formatTime(seconds: number): string {
  const neg = seconds < 0;
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = Math.abs(abs % 60);
  return `${neg ? '-' : ''}${m}:${s.toString().padStart(2, '0')}`;
}

/** BOM付きUTF-8のCSV文字列を生成してダウンロード */
export function exportPlanToCSV(
  planTitle: string,
  events: TimelineEvent[],
  mitigations: AppliedMitigation[],
  partyMembers: PartyMember[],
  lang: 'ja' | 'en',
) {
  const JOBS = getJobsFromStore();
  const MITS = getMitigationsFromStore();
  const mitMap = new Map(MITS.map(m => [m.id, m]));
  const jobMap = new Map(JOBS.map(j => [j.id, j]));

  // ヘッダー
  const headers = [
    lang === 'ja' ? '時間' : 'Time',
    lang === 'ja' ? '技名' : 'Skill Name',
    lang === 'ja' ? 'ダメージ' : 'Damage',
    lang === 'ja' ? 'タイプ' : 'Type',
    lang === 'ja' ? '対象' : 'Target',
    lang === 'ja' ? '軽減' : 'Mitigations',
  ];

  // イベントを時間順にソート
  const sorted = [...events].sort((a, b) => a.time - b.time);

  const rows: string[][] = [headers];

  for (const evt of sorted) {
    // このイベントの時間にアクティブな軽減を検索
    const active = mitigations.filter(m => {
      const start = m.time;
      const end = m.time + m.duration;
      return evt.time >= start && evt.time < end;
    });

    // 軽減を「ジョブ名: スキル名」形式で表示
    const mitLabels = active.map(m => {
      const mitDef = mitMap.get(m.mitigationId);
      const owner = partyMembers.find(p => p.id === m.ownerId);
      const jobDef = owner?.jobId ? jobMap.get(owner.jobId) : null;
      const jobName = jobDef ? jobDef.name[lang] : m.ownerId;
      const mitName = mitDef ? mitDef.name[lang] : m.mitigationId;
      return `${jobName}: ${mitName}`;
    });

    rows.push([
      formatTime(evt.time),
      evt.name[lang] || evt.name.ja || evt.name.en,
      evt.damageAmount?.toString() || '',
      evt.damageType || '',
      evt.target || '',
      mitLabels.join(' / '),
    ]);
  }

  // CSV文字列を生成（値にカンマや改行が含まれる場合をエスケープ）
  const csvContent = rows.map(row =>
    row.map(cell => {
      if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');

  // BOM付きUTF-8でダウンロード
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${planTitle.replace(/[/\\?%*:|"<>]/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
