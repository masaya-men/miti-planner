import type { SheetImportResult } from './buildPlanFromSheets';
import type { GridTable, GridColumn } from './gridTypes';
import type { Mitigation, Job } from '../../types/index';

type Lang = 'ja' | 'en' | 'ko' | 'zh';

/** LocalizedString から lang に対応する文字列を取得。なければ ja、それもなければ fallback。 */
function localize(name: { ja: string; en?: string; ko?: string; zh?: string } | undefined, lang: Lang): string {
  if (!name) return '';
  return name[lang] ?? name.ja ?? '';
}

/** 秒数を M:SS 形式に変換(負数対応)。 */
function formatTime(sec: number): string {
  const neg = sec < 0;
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = String(abs % 60).padStart(2, '0');
  return `${neg ? '-' : ''}${m}:${s}`;
}

/** result を表示用 GridTable に変換(読み取り専用プレビュー)。create には使わない。 */
export function gridRowsFromResult(
  result: SheetImportResult,
  deps: { mitigations: Mitigation[]; jobs: Job[] },
  lang: Lang,
): GridTable {
  // ─── 列定義 ───────────────────────────────────────────────────────────────
  const canonicalColumns: GridColumn[] = [
    { field: 'phase',      header: '' },
    { field: 'label',      header: '' },
    { field: 'time',       header: '' },
    { field: 'action',     header: '' },
    { field: 'damage',     header: '' },
    { field: 'target',     header: '' },
    { field: 'damageType', header: '' },
  ];

  const memberColumns: GridColumn[] = result.party.map(({ slot, jobId }) => {
    const job = deps.jobs.find((j) => j.id === jobId);
    const header = job ? localize(job.name, lang) : jobId;
    return { field: 'member', header, jobId, slot: slot as import('./partyAssignment').PartySlot };
  });

  const columns: GridColumn[] = [...canonicalColumns, ...memberColumns];

  // ─── 行データ ─────────────────────────────────────────────────────────────
  const sortedEvents = [...result.timelineEvents].sort((a, b) => a.time - b.time);

  const rows: string[][] = sortedEvents.map((event) => {
    // phase バンド名
    const phase = result.phases.find(
      (p) => p.startTime <= event.time && event.time < p.endTime,
    );
    const phaseCell = phase ? localize(phase.name, lang) : '';

    // label バンド名
    const label = result.labels.find(
      (lb) => lb.startTime <= event.time && event.time < lb.endTime,
    );
    const labelCell = label ? localize(label.name, lang) : '';

    // time
    const timeCell = formatTime(event.time);

    // action
    const actionCell = localize(event.name, lang);

    // damage
    const damageCell = event.damageAmount != null ? event.damageAmount.toLocaleString() : '';

    // target
    const targetCell = event.target ?? '';

    // damageType
    const damageTypeCell: string = event.damageType;

    // canonical セル
    const cells: string[] = [
      phaseCell, labelCell, timeCell, actionCell, damageCell, targetCell, damageTypeCell,
    ];

    // member セル: party エントリ順に並べる
    for (const { slot } of result.party) {
      const mits = result.timelineMitigations.filter(
        (m) => m.ownerId === slot && m.time === event.time,
      );
      const names = mits.map((m) => {
        const mit = deps.mitigations.find((x) => x.id === m.mitigationId);
        return mit ? localize(mit.name, lang) : '';
      });
      cells.push(names.join(' / '));
    }

    return cells;
  });

  return { columns, rows };
}
