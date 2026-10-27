// ─── 時刻パース（MM:SS → 秒） ───
export function parseTime(timeStr) {
    if (!timeStr) return null;
    const cleaned = timeStr.trim().replace(/^-/, '');
    const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) return null;
    return parseInt(match[1]) * 60 + parseInt(match[2]);
}

// ─── ダメージ種別の判定 ───
export function parseDamageType(typeCell) {
    if (!typeCell) return 'magical';
    const lower = typeCell.toLowerCase().trim();
    if (lower.includes('physical') || lower.includes('物理')) return 'physical';
    if (lower.includes('magic') || lower.includes('魔法')) return 'magical';
    if (lower.includes('unique') || lower.includes('無属性')) return 'magical';
    return 'magical';
}

// ─── ダメージ値パース ───
export function parseDamage(dmgStr) {
    if (!dmgStr) return undefined;
    const cleaned = dmgStr.replace(/[,\s]/g, '');
    const num = parseInt(cleaned);
    return isNaN(num) || num <= 0 ? undefined : num;
}

// ─── シートのタイムラインデータをパース ───
export function parseTimelineSheet(rows) {
    const events = [];

    // ヘッダー行を探す（"Time" と "Action" を含む行）
    let headerRow = -1;
    let colTime = -1, colAction = -1, colType = -1, colDamage = -1;

    for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        for (let j = 0; j < row.length; j++) {
            const cell = (row[j] || '').trim().toLowerCase();
            if (cell.startsWith('time')) colTime = j;
            if (cell.startsWith('action')) colAction = j;
            if (cell.startsWith('type')) colType = j;
            if (cell.startsWith('damage') || cell.startsWith('hit')) colDamage = j;
        }
        if (colTime >= 0 && colAction >= 0) { headerRow = i; break; }
    }

    // Damage列がまだ見つからない場合、"Damage"ヘッダーの直下列を探す
    if (headerRow >= 0 && colDamage < 0) {
        // Damageヘッダーの位置を探す
        const row = rows[headerRow];
        for (let j = 0; j < row.length; j++) {
            if ((row[j] || '').trim().toLowerCase().startsWith('damage')) {
                colDamage = j; // Damage列の開始位置（Hit列はその直下）
                break;
            }
        }
    }

    if (headerRow < 0 || colTime < 0 || colAction < 0) {
        console.log(`      ⚠️ ヘッダーが見つかりません (headerRow=${headerRow}, colTime=${colTime}, colAction=${colAction})`);
        return events;
    }

    console.log(`      📋 Columns: Time=${colTime}, Action=${colAction}, Type=${colType}, Damage=${colDamage}`);

    // データ行を処理（ヘッダーから3行後 = サブヘッダー2行をスキップ）
    const dataStart = headerRow + 3;
    for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i];
        const timeStr = row[colTime]?.trim();
        const action = row[colAction]?.trim();
        const typeStr = colType >= 0 ? row[colType]?.trim() : '';
        const dmgStr = colDamage >= 0 ? row[colDamage]?.trim() : '';

        if (!action) continue;
        if (action === '戦闘開始！' || action === '戦闘開始') continue;

        const time = parseTime(timeStr);
        if (time === null) continue;

        // ダメージ値がないイベント（バフ/デバフ名、ギミック説明）は除外
        const damage = parseDamage(dmgStr);
        if (damage === undefined) continue;

        // 括弧書きの注釈を除去: (プレイヤー), (TB), (着弾), （覚醒1）等
        const cleanAction = action.replace(/\s*[\(（][^）\)]*[\)）]/g, '').trim();

        events.push({
            time,
            name: { ja: cleanAction, en: '' },
            damageType: parseDamageType(typeStr),
            damageAmount: damage,
            target: 'AoE',
        });
    }

    return events;
}
