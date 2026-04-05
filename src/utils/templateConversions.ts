/**
 * src/utils/templateConversions.ts
 *
 * テンプレートデータ変換ユーティリティ。
 * モーダル・フックから使われる純粋関数群。
 */

import type { TimelineEvent, Phase } from '../types';
import type { TemplateData } from '../data/templateLoader';

// ─────────────────────────────────────────────
// 公開型定義
// ─────────────────────────────────────────────

export type ColumnType = 'time' | 'name' | 'damage' | 'type' | 'target' | 'phase' | 'mechanic' | 'skip';

export interface ColumnMapping {
  index: number;
  type: ColumnType;
}

export interface ParsedRow {
  cells: string[];
}

// ─────────────────────────────────────────────
// 1. parseTimeString
// ─────────────────────────────────────────────

/**
 * "M:SS"、"M:SS.x"、または裸の秒数文字列を秒数（整数）に変換する。
 * 小数点以下は切り捨て。パースできない場合は null を返す。
 */
export function parseTimeString(input: string): number | null {
  if (!input || input.trim() === '') return null;

  const trimmed = input.trim();

  // M:SS または M:SS.x 形式（負の時間にも対応）
  const colonMatch = trimmed.match(/^(-?)(\d+):(\d{1,2})(?:\.\d+)?$/);
  if (colonMatch) {
    const sign = colonMatch[1] === '-' ? -1 : 1;
    const minutes = parseInt(colonMatch[2], 10);
    const seconds = parseInt(colonMatch[3], 10);
    return sign * (minutes * 60 + seconds);
  }

  // 裸の数値（小数可、負も可）
  const numMatch = trimmed.match(/^(-?\d+(?:\.\d+)?)$/);
  if (numMatch) {
    return Math.floor(parseFloat(numMatch[1]));
  }

  return null;
}

// ─────────────────────────────────────────────
// 2. formatTime
// ─────────────────────────────────────────────

/**
 * 秒数を "M:SS" 形式の文字列に変換する。
 * 例: 90 → "1:30"、5 → "0:05"
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─────────────────────────────────────────────
// 3. parseTsv
// ─────────────────────────────────────────────

/**
 * TSVテキストをパースして ParsedRow の配列を返す。
 * 空行はスキップし、各セルをトリムする。
 */
export function parseTsv(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => ({
      cells: line.split('\t').map(cell => cell.trim()),
    }));
}

// ─────────────────────────────────────────────
// 4. guessColumnType
// ─────────────────────────────────────────────

/**
 * ヘッダー文字列からカラムの種別を推測する。
 * 日本語・英語キーワードに対応。
 */
export function guessColumnType(header: string): ColumnType {
  const h = header.toLowerCase().trim();

  if (/時間|time|タイム/.test(h)) return 'time';
  if (/技名|name|ability/.test(h)) return 'name';
  if (/ダメージ|damage/.test(h)) return 'damage';
  if (/攻撃種別|種別|type/.test(h)) return 'type';
  if (/対象|target/.test(h)) return 'target';
  if (/フェーズ|phase/.test(h)) return 'phase';
  if (/ラベル|ギミック|mechanic|group|label/.test(h)) return 'mechanic';

  return 'skip';
}

// ─────────────────────────────────────────────
// 5. parseDamageType
// ─────────────────────────────────────────────

/**
 * ダメージ種別文字列を TimelineEvent['damageType'] に変換する。
 * デフォルトは 'magical'。
 */
export function parseDamageType(value: string): TimelineEvent['damageType'] {
  const v = value.trim();

  if (/物理|physical/i.test(v)) return 'physical';
  if (/回避不可|unavoidable/i.test(v)) return 'unavoidable';
  if (/時間切れ|enrage/i.test(v)) return 'enrage';

  return 'magical';
}

// ─────────────────────────────────────────────
// 6. parseTarget
// ─────────────────────────────────────────────

/**
 * ターゲット文字列を TimelineEvent['target'] に変換する。
 * デフォルトは 'AoE'。
 */
export function parseTarget(value: string): TimelineEvent['target'] {
  const v = value.trim().toUpperCase();

  if (v === 'MT') return 'MT';
  if (v === 'ST') return 'ST';

  return 'AoE';
}

// ─────────────────────────────────────────────
// ヘルパー: ランダム6文字生成
// ─────────────────────────────────────────────

function randomChars(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// ─────────────────────────────────────────────
// 7. convertCsvToEvents
// ─────────────────────────────────────────────

/**
 * ParsedRow の配列とカラムマッピングから TimelineEvent と phases を生成する。
 * - 名前のない行はスキップ
 * - フェーズ変化はフェーズカラムの値変化で検出
 * - フェーズが1件も検出されない場合は { id: 1, startTimeSec: 0 } を生成
 */
export function convertCsvToEvents(
  rows: ParsedRow[],
  mappings: ColumnMapping[],
): { events: TimelineEvent[]; phases: TemplateData['phases'] } {
  const events: TimelineEvent[] = [];
  const phases: TemplateData['phases'] = [];

  let phaseCounter = 0;
  let currentPhaseName: string | null = null;
  let currentMechanicGroup: string | undefined = undefined;

  rows.forEach((row, rowIndex) => {
    const get = (type: ColumnType): string => {
      const mapping = mappings.find(m => m.type === type);
      if (!mapping) return '';
      return row.cells[mapping.index] ?? '';
    };

    const nameVal = get('name');
    if (!nameVal) return; // 名前のない行はスキップ

    // ギミックグループ検出
    const mechanicVal = get('mechanic');
    if (mechanicVal) {
      currentMechanicGroup = mechanicVal;
    }

    // フェーズ検出
    const phaseVal = get('phase');
    if (phaseVal && phaseVal !== currentPhaseName) {
      currentPhaseName = phaseVal;
      phaseCounter++;
      const timeVal = get('time');
      const startTimeSec = parseTimeString(timeVal) ?? 0;
      phases.push({
        id: phaseCounter,
        startTimeSec,
        name: phaseVal,
      });
    }

    const timeVal = get('time');
    const time = parseTimeString(timeVal) ?? 0;

    const damageVal = get('damage');
    const damageAmount = damageVal ? parseInt(damageVal.replace(/,/g, ''), 10) || undefined : undefined;

    const typeVal = get('type');
    const damageType = typeVal ? parseDamageType(typeVal) : 'magical';

    const targetVal = get('target');
    const target = targetVal ? parseTarget(targetVal) : 'AoE';

    const event: TimelineEvent = {
      id: `tpl_${rowIndex}_${randomChars(6)}`,
      time,
      name: { ja: nameVal, en: '' },
      damageType,
      target,
    };

    if (currentMechanicGroup) {
      event.mechanicGroup = { ja: currentMechanicGroup, en: '' };
    }

    if (damageAmount !== undefined && !isNaN(damageAmount)) {
      event.damageAmount = damageAmount;
    }

    events.push(event);
  });

  // フェーズが1件も検出されなかった場合はデフォルトを追加
  if (phases.length === 0) {
    phases.push({ id: 1, startTimeSec: 0 });
  }

  return { events, phases };
}

// ─────────────────────────────────────────────
// 8. convertPlanToTemplate
// ─────────────────────────────────────────────

/**
 * PlanData の timelineEvents と phases を TemplateData 形式に変換する。
 *
 * - Phase id: "phase_2" → 2
 * - Phase name: "Phase 1\nP1" → "P1"（最後の改行以降）
 * - Phase 1 の startTimeSec = 0、Phase N の startTimeSec = Phase N-1 の endTime
 * - timelineEvents は標準フィールドのみコピー
 */
export function convertPlanToTemplate(
  planData: { timelineEvents: TimelineEvent[]; phases: Phase[] },
  contentId: string,
): Omit<TemplateData, '_warning'> {
  // フェーズ変換
  const templatePhases: TemplateData['phases'] = planData.phases.map((phase, index) => {
    // id: "phase_2" → 2（数字部分を抽出）
    const idMatch = phase.id.match(/\d+/);
    const numericId = idMatch ? parseInt(idMatch[0], 10) : index + 1;

    // startTimeSec: Phase 1 = 0、それ以降 = 前のフェーズの endTime
    const startTimeSec = index === 0 ? 0 : planData.phases[index - 1].endTime;

    // name: 最後の改行以降の部分を使う
    const rawName = phase.name ?? '';
    const lastNewline = rawName.lastIndexOf('\n');
    const name = lastNewline >= 0 ? rawName.substring(lastNewline + 1) : rawName;

    const result: TemplateData['phases'][number] = { id: numericId, startTimeSec };
    if (name) result.name = name;

    return result;
  });

  // timelineEvents: 標準フィールドのみコピー
  const templateEvents: TimelineEvent[] = planData.timelineEvents.map(event => {
    const e: TimelineEvent = {
      id: event.id,
      time: event.time,
      name: { ja: event.name.ja, en: event.name.en },
      damageType: event.damageType,
    };
    if (event.damageAmount !== undefined) e.damageAmount = event.damageAmount;
    if (event.target !== undefined) e.target = event.target;
    if (event.warning !== undefined) e.warning = event.warning;
    if (event.mechanicGroup !== undefined) e.mechanicGroup = event.mechanicGroup;
    return e;
  });

  return {
    contentId,
    generatedAt: new Date().toISOString(),
    sourceLogsCount: 0,
    timelineEvents: templateEvents,
    phases: templatePhases,
  };
}
