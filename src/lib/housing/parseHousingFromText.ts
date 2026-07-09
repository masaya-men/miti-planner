import { serverMasterData, housingAreaMasterData, housingSizeMasterData } from '../../data/masterData';

// 抽出されたサイズ種別 (S/M/L ハウス、 アパルトメント、 FC 個室)
export type HousingExtractSize = 'S' | 'M' | 'L' | 'Apartment' | 'PrivateRoom';

// 抽出結果の型
//   - 各フィールドはマッチしなかった場合 undefined
//   - ambiguity[] には曖昧性検出フラグ ('dcServerMismatch' / 'multipleDc' 等) を積む
export type HousingExtractResult = {
    dc?: string;
    server?: string;
    area?: string;
    ward?: number;
    plot?: number;
    size?: HousingExtractSize;
    roomNumber?: number;
    parentHouseSize?: 'S' | 'M' | 'L';
    ambiguity: string[];
};

// FC 個室を示すキーワード (前処理前の生テキストに対して使う)
const PRIVATE_ROOM_KEYWORDS = /FC個室|個室|Private\s*Room|FC\s*Chamber|FC部屋/i;

// トークン分割用セパレータ
//   - 区切り記号類 + 「鯖/サバ/さば/サーバー/Server」 等のラベル文字列
//   - 縦棒・カギ括弧・全角句読点・スペース類を含む
const SEPARATORS = /[\|┆\-/\s\n、。（）「」『』"',，]|鯖|サバ|さば|サーバー|サーバ|Server|server|Serv|Srv/g;

// 前処理: URL / メンション / ハッシュタグ / 装飾記号を空白へ置換し、
// 後続のトークン分割でゴミが残らないようにする
function preprocess(text: string): string {
    return text
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/@\w+/g, ' ')
        .replace(/#\S+/g, ' ')
        .replace(/[⚐-⚑⌀-⏿]/gu, ' ');
}

/**
 * 短い ASCII alias (例: "Had"=Hades / "Man"=Mana / "Gob"=Goblin / "Cry"=Crystal / "Bal"=Balmung) は
 * 英語の自由文に含まれる一般語 ("had" / "man" 等) と exact 一致して DC/サーバーを誤検出する。
 * 実バグ (2026-07-10): housingsnap の og:description "i've finally **had** the energy…" が
 * token "had" → サーバー "Had"(=Hades / Mana DC) と一致し、まったく別の海外物件に
 * "ManaのHades" が入力された。substring search 側は既に同じ基準 (ASCII かつ 4 文字未満) で
 * 除外済みだが、token exact 一致側にガードが無く素通ししていた。ここで揃える。
 * フル名 ("Hades"/"Mana") と日本語 alias ("ハデス"/"マナ") は残るので実データ取りこぼしは無い。
 */
function isTooShortAsciiAlias(alias: string): boolean {
    return alias.length < 4 && /^[\x00-\x7f]+$/.test(alias);
}

// 単一トークンが housingSizeMasterData のエイリアスに含まれるか判定し、
// 一致すればその id (S/M/L/Apartment/PrivateRoom) を返す
function normalizeSizeAlias(token: string): HousingExtractSize | null {
    const lower = token.toLowerCase();
    for (const sizeData of housingSizeMasterData) {
        if (sizeData.aliases.some((a) => a.toLowerCase() === lower)) {
            return sizeData.id as HousingExtractSize;
        }
    }
    return null;
}

/**
 * ツイート本文等のテキストから住所情報 (DC / サーバー / エリア / 区 / 番地 / サイズ) を抽出する純関数。
 *
 * Phase 2A Task 2 時点では「定番フォーマット」 (区切り文字で並んだ DC/サーバー/エリア + 区-番地 + サイズ)
 * のみ確実に抽出できる骨格を提供する。 Tasks 3-17 で対応パターンを拡充する。
 */
export function parseHousingFromText(text: string): HousingExtractResult {
    const cleaned = preprocess(text);
    const ambiguity: string[] = [];

    const candidates = {
        dc: [] as string[],
        server: [] as Array<{ serverId: string; dcId: string }>,
        area: [] as string[],
        size: [] as HousingExtractSize[],
    };

    const tokens = cleaned.split(SEPARATORS).map((t) => t.trim()).filter(Boolean);

    for (const token of tokens) {
        const lower = token.toLowerCase();

        // DC 候補 (兼サーバー候補)。短い ASCII alias は英語自由文と誤爆するため exact 一致から除外。
        for (const [dcId, dcData] of Object.entries(serverMasterData)) {
            if (dcData.aliases.some((a) => !isTooShortAsciiAlias(a) && a.toLowerCase() === lower)) {
                if (!candidates.dc.includes(dcId)) candidates.dc.push(dcId);
            }
            // サーバー候補 (DC 推論も兼ねる)
            for (const [serverId, aliases] of Object.entries(dcData.servers)) {
                if (aliases.some((a) => !isTooShortAsciiAlias(a) && a.toLowerCase() === lower)) {
                    if (!candidates.server.some((s) => s.serverId === serverId)) {
                        candidates.server.push({ serverId, dcId });
                    }
                }
            }
        }

        // エリア候補
        for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
            if (areaData.aliases.some((a) => a.toLowerCase() === lower)) {
                if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
            }
            // アパート名検出 → エリア + サイズ=Apartment
            // 全言語の apartment_name と照合 (ja/en/ko/zh いずれかに一致すれば採用)
            if (Object.values(areaData.apartment_name).some((name) => token === name)) {
                if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
                if (!candidates.size.includes('Apartment')) candidates.size.push('Apartment');
            }
        }

        // サイズ候補 (S/M/L/Apartment/PrivateRoom)
        const size = normalizeSizeAlias(token);
        if (size && !candidates.size.includes(size)) {
            candidates.size.push(size);
        }
    }

    // substring search (区切り文字なしの自由文対応)
    //   - token split で拾えない 「シロガネ6番地6番に来てねManaのAnimaサーバーです」 型
    //     や 「Mana-Ixionエンピ-4-2M」 (連結トークン) を補完するための部分一致 pass
    //   - 短すぎる alias (1-2 文字) は誤一致リスクが高いのでスキップ
    const lowerCleaned = cleaned.toLowerCase();
    for (const [dcId, dcData] of Object.entries(serverMasterData)) {
        for (const alias of dcData.aliases) {
            // 短すぎる alias は誤一致リスク高 (token loop で exact match を既にやっているので不要)
            if (alias.length < 3) continue;
            // ASCII の 3 文字 alias (例: "Man"=Mana, "Mat"=Materia) は英文中の単語に誤一致するため除外
            if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) {
                if (!candidates.dc.includes(dcId)) candidates.dc.push(dcId);
            }
        }
        for (const [serverId, aliases] of Object.entries(dcData.servers)) {
            for (const alias of aliases) {
                // 短すぎる alias は誤一致リスク高 (token loop で exact match を既にやっているので不要)
                if (alias.length < 3) continue;
                // ASCII の 3 文字 alias (例: "Man"=Mana, "Mat"=Materia) は英文中の単語に誤一致するため除外
                if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
                if (lowerCleaned.includes(alias.toLowerCase())) {
                    if (!candidates.server.some((s) => s.serverId === serverId)) {
                        candidates.server.push({ serverId, dcId });
                    }
                }
            }
        }
    }
    for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
        for (const alias of areaData.aliases) {
            if (alias.length < 2) continue;
            if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) {
                if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
            }
        }
    }

    // 区-番地パターン: "6-6" "23-6" など
    const wardPlotMatch = cleaned.match(/(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/);
    let ward: number | undefined;
    let plot: number | undefined;
    if (wardPlotMatch) {
        const w = +wardPlotMatch[1];
        const p = +wardPlotMatch[2];
        if (w >= 1 && w <= 30 && p >= 1 && p <= 60) {
            ward = w;
            plot = p;
        }
    }

    // 日本語表記: "N番地 M番" / "N区 M番地" 等のフォールバック
    //   - "シロガネ6番地6番" / "6区 23番" / "6番地6" など、 区切り記号がない自然文で使われる
    if (ward === undefined || plot === undefined) {
        const wardPlotJpMatch = cleaned.match(/(\d{1,2})\s*(?:番地|区)\s*(\d{1,2})\s*番?/);
        if (wardPlotJpMatch) {
            const w = +wardPlotJpMatch[1];
            const p = +wardPlotJpMatch[2];
            if (w >= 1 && w <= 30 && p >= 1 && p <= 60) {
                ward = w;
                plot = p;
            }
        }
    }

    // NA/EU 英語表記: "w21 p58" / "W21 P58" (housingsnap 等・w=ward / p=plot 接頭)。
    //   - ダッシュ無しでスペース区切りのため上の "N-M" 系にはかからない。w/p 接頭で誤爆を抑える。
    if (ward === undefined || plot === undefined) {
        const wardPlotEnMatch = cleaned.match(/\bw\s*(\d{1,2})\s*p\s*(\d{1,2})\b/i);
        if (wardPlotEnMatch) {
            const w = +wardPlotEnMatch[1];
            const p = +wardPlotEnMatch[2];
            if (w >= 1 && w <= 30 && p >= 1 && p <= 60) {
                ward = w;
                plot = p;
            }
        }
    }

    // 番地末尾サイズ連結 (例: "4-2M" → S/M/L/A)
    const wardPlotSizeMatch = cleaned.match(/(\d{1,2})\s*[-－‐ー]\s*(\d{1,2})\s*([SMLA])\b/i);
    if (wardPlotSizeMatch && candidates.size.length === 0) {
        const sizeChar = wardPlotSizeMatch[3].toUpperCase();
        if (sizeChar === 'A') candidates.size.push('Apartment');
        else if (sizeChar === 'S') candidates.size.push('S');
        else if (sizeChar === 'M') candidates.size.push('M');
        else if (sizeChar === 'L') candidates.size.push('L');
    }

    // FC 個室キーワードが原文に含まれていれば最優先扱い
    if (PRIVATE_ROOM_KEYWORDS.test(text)) {
        candidates.size.unshift('PrivateRoom');
    }

    // DC 推論: 明示 DC が無くサーバーから DC が引ければそれを採用
    let dc: string | undefined = candidates.dc[0];
    let server: { serverId: string; dcId: string } | undefined = candidates.server[0];
    if (!dc && server) {
        dc = server.dcId;
    }
    // DC とサーバーの矛盾チェック (例: Mana を明示しているのにサーバーが Bismarck)
    if (dc && server && server.dcId !== dc) {
        ambiguity.push('dcServerMismatch');
        dc = undefined;
        server = undefined;
    }
    // 複数 DC が検出された場合は曖昧として棄却
    if (candidates.dc.length > 1) {
        ambiguity.push('multipleDc');
        dc = undefined;
        server = undefined;
    }

    return {
        dc,
        server: server?.serverId,
        area: candidates.area[0],
        ward,
        plot,
        size: candidates.size[0],
        ambiguity,
    };
}
