import type { ParsedSheet, SheetColumn, SheetRow } from './types';

/** MM:SS（負値対応）→ 秒数。パースできなければ null */
function mmssToSec(v: string | undefined): number | null {
  if (v == null) return null;
  const m = v.trim().match(/^(-?)(\d+):([0-5]?\d)$/);
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/** ジョブ行検出用セット（タンク/LB3 等も含む） */
const JOB_JA_NAMES = new Set([
  'ナイト', '戦士', '暗黒騎士', 'ガンブレイカー', '白魔道士', '占星術師', '学者', '賢者',
  'モンク', '竜騎士', '忍者', '侍', 'リーパー', 'ヴァイパー', '吟遊詩人', '機工士',
  '踊り子', '黒魔道士', '召喚士', '赤魔道士', 'ピクトマンサー', 'タンク',
]);

/**
 * スプレッドシート 1 タブ分の TSV 文字列 → ParsedSheet（純粋関数）。
 * メタ情報・データ表が見つからなければ null を返す。
 */
export function parseMitigationSheet(tsv: string): ParsedSheet | null {
  if (!tsv) return null;

  // \r\n → \n 正規化 → 行分割 → タブ分割
  const lines: string[][] = tsv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.split('\t'));

  // --- ラベル列 index を全行走査で決定 ---
  let colPhase = -1;
  let colTotalTime = -1;
  let colAction = -1;
  let colType = -1;
  let colHit = -1;

  // 'Time' のフォールバック用（Total Time が無い場合）
  let colTimeFallback = -1;
  // 'Damage' のフォールバック用（Hit が無い場合）
  let colDamageFallback = -1;

  for (const cells of lines) {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (colPhase === -1 && cell === 'Phase') colPhase = i;
      if (colTotalTime === -1 && cell === 'Total Time') colTotalTime = i;
      if (colTimeFallback === -1 && cell === 'Time') colTimeFallback = i;
      if (colAction === -1 && cell === 'Action') colAction = i;
      if (colType === -1 && cell === 'Type') colType = i;
      if (colHit === -1 && cell === 'Hit') colHit = i;
      if (colDamageFallback === -1 && cell === 'Damage') colDamageFallback = i;
    }
  }

  // フォールバック適用
  if (colTotalTime === -1) colTotalTime = colTimeFallback;
  if (colHit === -1) colHit = colDamageFallback;

  // 必須列チェック
  if (colAction === -1 || colTotalTime === -1) return null;

  // --- Skill 行 を探す ---
  let skillRow: string[] | null = null;
  for (const cells of lines) {
    if (cells.some((c) => c === 'Skill')) {
      skillRow = cells;
      break;
    }
  }

  // --- ジョブ行 を探す（JOB_JA_NAMES を 3 つ以上含む行）---
  let jobRow: string[] | null = null;
  for (const cells of lines) {
    const count = cells.filter((c) => JOB_JA_NAMES.has(c.trim())).length;
    if (count >= 3) {
      jobRow = cells;
      break;
    }
  }

  // メタ行が揃っていなければ UI にエラーを返せるよう null で終了
  if (!skillRow || !jobRow) return null;

  // --- 軽減列 columns を構築 ---
  const columns: SheetColumn[] = [];
  const maxLen = Math.max(skillRow.length, jobRow.length);
  for (let i = 0; i < maxLen; i++) {
    const skill = (skillRow[i] ?? '').trim();
    const job = (jobRow[i] ?? '').trim();
    if (skill !== '' && JOB_JA_NAMES.has(job)) {
      columns.push({ index: i, job, skillNameRaw: skill });
    }
  }

  // --- データ行 を抽出 ---
  const rows: SheetRow[] = [];
  let lastPhase = '';

  for (const cells of lines) {
    const t = mmssToSec(cells[colTotalTime]);
    if (t === null) continue; // ヘッダー/メタ/空行
    if (t < 0) continue;     // 戦闘前カウントダウン

    // Phase 引き継ぎ
    const phaseCell = colPhase >= 0 ? (cells[colPhase] ?? '').trim() : '';
    if (phaseCell !== '') lastPhase = phaseCell;
    const phaseLabel = lastPhase;

    const action = (cells[colAction] ?? '').trim();

    // damageType
    const typeCell = colType >= 0 ? (cells[colType] ?? '').trim() : '';
    let damageType: 'physical' | 'magical' | null = null;
    if (typeCell === 'Physical') damageType = 'physical';
    else if (typeCell === 'Magic') damageType = 'magical';

    // damageAmount（カンマ除去・正の有限数のみ）
    let damageAmount: number | null = null;
    if (colHit >= 0) {
      const raw = (cells[colHit] ?? '').replace(/,/g, '');
      const n = Number(raw);
      if (isFinite(n) && n > 0) damageAmount = n;
    }

    // trueColumnIndexes（"TRUE" セルのみ）
    const trueColumnIndexes = columns
      .filter((c) => (cells[c.index] ?? '').trim() === 'TRUE')
      .map((c) => c.index);

    rows.push({ phaseLabel, totalTimeSec: t, action, damageAmount, damageType, trueColumnIndexes });
  }

  if (rows.length === 0) return null;

  return { columns, rows };
}
