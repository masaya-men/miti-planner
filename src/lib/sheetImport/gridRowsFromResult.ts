import type { SheetImportResult } from './buildPlanFromSheets';
import type { GridTable, GridColumn } from './gridTypes';
import type { Mitigation, Job } from '../../types/index';

type Lang = 'ja' | 'en' | 'ko' | 'zh';

/** ダメージ種別 enum → 表示ラベルの 4 言語マップ。 */
const DAMAGE_TYPE_LABELS: Record<string, Record<Lang, string>> = {
  physical:    { ja: '物理',   en: 'Physical',    ko: '물리',       zh: '物理'     },
  magical:     { ja: '魔法',   en: 'Magic',       ko: '마법',       zh: '魔法'     },
  enrage:      { ja: '時間切れ', en: 'Enrage',    ko: '시간 초과',  zh: '超时'     },
  unavoidable: { ja: '回避不可', en: 'Unavoidable', ko: '회피 불가', zh: '无法回避' },
};

/** damageType enum を lang に対応するラベルに変換。未知の値は ja フォールバック、それもなければ元の値を返す。 */
function localizeDamageType(damageType: string, lang: Lang): string {
  const map = DAMAGE_TYPE_LABELS[damageType];
  if (!map) return damageType;
  return map[lang] ?? map.ja;
}

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

  // band-start 表示: 「フェーズ」「ラベル」列は帯の先頭行だけ名前を出し、同じ帯が続く行は空にする。
  // 帯は id 単位で比較する(同名でも別帯=別 id なら先頭行に再掲)。前行の帯 id を保持して判定。
  let prevPhaseId: string | null = null;
  let prevLabelId: string | null = null;

  const rows: string[][] = sortedEvents.map((event) => {
    // phase バンド名(帯先頭行のみ。続く同帯行は空)
    const phase = result.phases.find(
      (p) => p.startTime <= event.time && event.time < p.endTime,
    );
    const phaseId = phase ? phase.id : null;
    const phaseCell = phase && phaseId !== prevPhaseId ? localize(phase.name, lang) : '';
    prevPhaseId = phaseId;

    // label バンド名(帯先頭行のみ。続く同帯行は空)
    const label = result.labels.find(
      (lb) => lb.startTime <= event.time && event.time < lb.endTime,
    );
    const labelId = label ? label.id : null;
    const labelCell = label && labelId !== prevLabelId ? localize(label.name, lang) : '';
    prevLabelId = labelId;

    // time
    const timeCell = formatTime(event.time);

    // action
    const actionCell = localize(event.name, lang);

    // damage
    const damageCell = event.damageAmount != null ? event.damageAmount.toLocaleString() : '';

    // target
    const targetCell = event.target ?? '';

    // damageType: enum → ローカライズ済みラベル
    const damageTypeCell = localizeDamageType(event.damageType, lang);

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
      // 同 (slot,time) で skip された生スキル名も足す(GridView が未解決として黄色表示)
      const skippedHere = result.skipped
        .filter((s) => s.slot === slot && (s.times ?? []).includes(event.time))
        .map((s) => s.skillName);
      cells.push([...names, ...skippedHere].filter((x) => x !== '').join(' / '));
    }

    return cells;
  });

  return { columns, rows };
}
