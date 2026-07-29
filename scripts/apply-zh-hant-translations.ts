/**
 * apply-zh-hant-translations.ts
 * 翻訳済みCSV(ID,ja,en,zh,zh-Hant,ko)を読み込み、Firestore の
 * master/skills(jobs[].name / mitigations[].name) または
 * master/contents(items[].name) の zh-Hant フィールドのみを更新する。
 * 既存の ja/en/zh/ko フィールドには一切触れない。
 *
 * 使い方:
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=jobs --csv=path/to/jobs.csv --dry-run
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=mitigations --csv=path/to/mitigations.csv --dry-run
 *   npx tsx scripts/apply-zh-hant-translations.ts --target=contents --csv=path/to/contents.csv --dry-run
 *   (--dry-run を外すと実際にFirestoreへ書き込む)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

export interface NamedItem {
  id: string;
  name: Record<string, string>;
  [key: string]: unknown;
}

export interface ApplyResult {
  updated: NamedItem[];
  appliedCount: number;
  skippedIds: string[];
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { cur += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { cells.push(cur); cur = ''; }
      else cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

export function applyTranslationsFromCsv(csvText: string, existingItems: NamedItem[]): ApplyResult {
  const text = csvText.replace(/^﻿/, '').trim();
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const idIdx = header.indexOf('ID');
  const zhHantIdx = header.indexOf('zh-Hant');
  if (idIdx === -1 || zhHantIdx === -1) {
    throw new Error('CSVヘッダーに ID または zh-Hant 列がありません');
  }

  const zhHantById = new Map<string, string>();
  const skippedIds: string[] = [];
  const existingIds = new Set(existingItems.map(i => i.id));

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const id = cells[idIdx]?.trim();
    const zhHant = cells[zhHantIdx]?.trim();
    if (!id || !zhHant) continue;
    if (!existingIds.has(id)) { skippedIds.push(id); continue; }
    zhHantById.set(id, zhHant);
  }

  let appliedCount = 0;
  const updated = existingItems.map(item => {
    const zhHant = zhHantById.get(item.id);
    if (!zhHant) return item;
    appliedCount++;
    return { ...item, name: { ...item.name, 'zh-Hant': zhHant } };
  });

  return { updated, appliedCount, skippedIds };
}

// ─────────────────────────────────────────────
// CLI エントリポイント
// ─────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const target = args.find(a => a.startsWith('--target='))?.split('=')[1];
  const csvPath = args.find(a => a.startsWith('--csv='))?.split('=')[1];
  const dryRun = args.includes('--dry-run');

  if (!target || !csvPath || !['jobs', 'mitigations', 'contents'].includes(target)) {
    console.error('使い方: npx tsx scripts/apply-zh-hant-translations.ts --target=jobs|mitigations|contents --csv=<path> [--dry-run]');
    process.exit(1);
  }

  function loadEnv(filePath: string): Record<string, string> {
    const text = readFileSync(filePath, 'utf-8');
    const env: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
    return env;
  }

  const ROOT = resolve(import.meta.dirname, '..');
  const env = loadEnv(resolve(ROOT, '.env.local'));
  const projectId = env.FIREBASE_PROJECT_ID;
  const clientEmail = env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.error('.env.local に FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY が必要です');
    process.exit(1);
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  const csvText = readFileSync(resolve(csvPath), 'utf-8');

  if (target === 'jobs' || target === 'mitigations') {
    const snap = await db.doc('master/skills').get();
    const data = snap.data() as { jobs: NamedItem[]; mitigations: NamedItem[]; displayOrder: string[] };
    const items = target === 'jobs' ? data.jobs : data.mitigations;
    const result = applyTranslationsFromCsv(csvText, items);
    console.log(`[${target}] 適用件数: ${result.appliedCount} / 未知ID: ${result.skippedIds.length}件 ${result.skippedIds.slice(0, 10).join(', ')}`);
    if (dryRun) { console.log('--dry-run のため書き込みません'); return; }
    const merged = target === 'jobs'
      ? { ...data, jobs: result.updated }
      : { ...data, mitigations: result.updated };
    await db.doc('master/skills').set(merged);
    console.log('master/skills に書き込みました');
  } else {
    const snap = await db.doc('master/contents').get();
    const data = snap.data() as { items: NamedItem[]; series: unknown[] };
    const result = applyTranslationsFromCsv(csvText, data.items);
    console.log(`[contents] 適用件数: ${result.appliedCount} / 未知ID: ${result.skippedIds.length}件 ${result.skippedIds.slice(0, 10).join(', ')}`);
    if (dryRun) { console.log('--dry-run のため書き込みません'); return; }
    await db.doc('master/contents').set({ ...data, items: result.updated });
    console.log('master/contents に書き込みました');
  }
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
}
