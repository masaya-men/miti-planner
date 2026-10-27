// ─── スプレッドシート定義 ───
export const SPREADSHEETS = {
    // 絶コンテンツ
    fru:  { sheetId: '1SE42_C609lQnsgbyeXwyB3xVu-6Fjl6cjP1nY5g_DAU' },
    top:  { sheetId: '1VpwyDq9uc0W3i4rJZgI3YILVfpgUv_wmWT-csBhPQKI' },
    // DSR: P1タブ→dsr_p1、P2以降→dsr
    dsr_p1: { sheetId: '1N-ZrBSEzxsVRsCmwScSeAGSCfaGMwv-Tl99zGozC5ss', tabFilter: name => name === 'P1_蒼天騎士' },
    dsr:    { sheetId: '1N-ZrBSEzxsVRsCmwScSeAGSCfaGMwv-Tl99zGozC5ss', tabFilter: name => name !== 'P1_蒼天騎士' },
    tea:  { sheetId: '1UvYuBB2v87TFz8ISMTA68wC1o7kSn5LXw57_7PJYWaw' },
    uwu:  { sheetId: '1WY8yeJ4fpxudiUNcSbawGZJx0X79_VjjhE2f73wZMQ0' },
    ucob: { sheetId: '187eHoXZ4Z6Pf7KeRUWQtvccmVaDXUXvCe8c4gwTgB30' },
    // 零式
    // ヘビー級（M9S-M12S）: 1つのスプシに複数コンテンツ
    'm9s,m10s,m11s,m12s_p1,m12s_p2': { sheetId: '1w0JT2aHnGtqtSq_YmntjUBuFdga6jhS5_VCBQvgCSHk' },
    // クルーザー級（M5S-M8S）
    'm5s,m6s,m7s,m8s': { sheetId: '1_Xgu2xfV3uw_rDyoRJr1UrO5XCmsLuLBWQWSjEFOp-0' },
};

// ─── Google Sheets タブ（シート）名を取得 ───
export async function getSheetTabs(sheetId) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
    const resp = await fetch(url, { redirect: 'follow' });
    const html = await resp.text();

    // docs-sheet-tab-caption からタブ名を抽出（HTMLエンティティをデコード）
    const captions = [...html.matchAll(/docs-sheet-tab-caption">([^<]+)/g)]
        .map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
    return captions.map(name => ({ name }));
}

// ─── CSV取得（シート名で取得） ───
export async function fetchSheetCSV(sheetId, sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) throw new Error(`Failed to fetch CSV for "${sheetName}": ${resp.status}`);
    return await resp.text();
}

// ─── CSV パース ───
export function parseCSV(csv) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (ch === '"') {
            if (inQuotes && csv[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            rows.push(current);
            current = '';
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && csv[i + 1] === '\n') i++;
            rows.push(current);
            current = '';
            // 行の区切り → 配列の配列にする
            if (!rows._rows) rows._rows = [];
            rows._rows.push([...rows.splice(0)]);
        } else {
            current += ch;
        }
    }
    if (current) {
        if (!rows._rows) rows._rows = [];
        rows.push(current);
        rows._rows.push([...rows.splice(0)]);
    }

    return rows._rows || [];
}
