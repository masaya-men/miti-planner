#!/usr/bin/env node

/**
 * scripts/add-content.mjs
 *
 * Interactive CLI for adding new content to contents.json.
 * Run: npm run add-content
 *
 * Uses only Node.js built-in modules (no dependencies).
 */

import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENTS_PATH = resolve(__dirname, '../src/data/contents.json');

const rl = createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
    return new Promise((resolve) => rl.question(question, resolve));
}

function askChoice(question, choices) {
    const choiceStr = choices.map((c, i) => `  ${i + 1}. ${c}`).join('\n');
    return new Promise(async (resolve) => {
        while (true) {
            console.log(choiceStr);
            const answer = await ask(question);
            const idx = parseInt(answer, 10) - 1;
            if (idx >= 0 && idx < choices.length) {
                resolve(choices[idx]);
                return;
            }
            console.log('❌ 無効な選択です。もう一度入力してください。\n');
        }
    });
}

async function main() {
    console.log('');
    console.log('┌─────────────────────────────────────┐');
    console.log('│   Grapl コンテンツ追加ツール         │');
    console.log('│   Add new content to contents.json  │');
    console.log('└─────────────────────────────────────┘');
    console.log('');

    // Read existing data
    const contents = JSON.parse(readFileSync(CONTENTS_PATH, 'utf-8'));
    const existingIds = new Set(contents.map((c) => c.id));

    // 1. ID
    let id;
    while (true) {
        id = (await ask('コンテンツID (例: m13s, fru2): ')).trim().toLowerCase();
        if (!id) {
            console.log('❌ IDは必須です。\n');
            continue;
        }
        if (existingIds.has(id)) {
            console.log(`❌ ID "${id}" は既に存在します。\n`);
            continue;
        }
        break;
    }

    // 2. Japanese name
    const ja = (await ask('日本語名: ')).trim();
    if (!ja) {
        console.log('❌ 日本語名は必須です。中断します。');
        rl.close();
        return;
    }

    // 3. English name
    const en = (await ask('英語名: ')).trim();
    if (!en) {
        console.log('❌ 英語名は必須です。中断します。');
        rl.close();
        return;
    }

    // 4. Category
    console.log('\nカテゴリを選択:');
    const category = await askChoice('番号を入力: ', ['savage', 'ultimate', 'dungeon', 'raid', 'custom']);

    // 5. Level
    console.log('\nレベルを選択:');
    const levelStr = await askChoice('番号を入力: ', ['100', '90', '80', '70']);
    const level = parseInt(levelStr, 10);

    // 6. Patch
    const patch = (await ask('\nパッチ番号 (例: 7.60): ')).trim() || '0.00';

    // 7. Short name (optional)
    const shortNameJa = (await ask('略称 (省略可, 例: FRU): ')).trim() || undefined;

    // 8. Checkpoint
    const hasCheckpointStr = (await ask('チェックポイントあり？ (y/n): ')).trim().toLowerCase();
    const hasCheckpoint = hasCheckpointStr === 'y' || hasCheckpointStr === 'yes' ? true : undefined;

    // Build entry
    const entry = { id, category, level, patch, ja, en };
    if (shortNameJa) entry.shortNameJa = shortNameJa;
    if (hasCheckpoint) entry.hasCheckpoint = true;

    // Confirm
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('追加するコンテンツ:');
    console.log(JSON.stringify(entry, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const confirm = (await ask('\nこの内容で追加しますか？ (y/n): ')).trim().toLowerCase();
    if (confirm !== 'y' && confirm !== 'yes') {
        console.log('中断しました。');
        rl.close();
        return;
    }

    // Save
    contents.push(entry);
    writeFileSync(CONTENTS_PATH, JSON.stringify(contents, null, 2) + '\n', 'utf-8');
    console.log(`\n✅ "${ja}" を contents.json に追加しました！`);
    console.log(`   合計コンテンツ数: ${contents.length}`);

    rl.close();
}

main().catch((err) => {
    console.error('エラー:', err);
    rl.close();
    process.exit(1);
});
