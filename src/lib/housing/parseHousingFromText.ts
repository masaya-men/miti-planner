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

// 区-番地パターン (3 系統)。
//   1. "6-6" "23-6" 等 (N-M / 各種ダッシュ)
//   2. "6番地6番" "6区 23番" 等 (日本語表記)
//   3. "w21 p58" "W21 P58" 等 (NA/EU 英語表記、 w=ward / p=plot)
// いずれも非グローバル (lastIndex 状態を持たない) ので .test() / .match() を使い回せる。
const WARD_PLOT_DASH_RE = /(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/;
const WARD_PLOT_JP_RE = /(\d{1,2})\s*(?:番地|区)\s*(\d{1,2})\s*番?/;
const WARD_PLOT_EN_RE = /\bw\s*(\d{1,2})\s*p\s*(\d{1,2})\b/i;

// 前処理: URL / メンション / ハッシュタグ / 装飾記号を空白へ置換し、
// 後続のトークン分割でゴミが残らないようにする
function preprocess(text: string): string {
    return text
        .replace(/https?:\/\/\S+/g, ' ')
        .replace(/@\w+/g, ' ')
        .replace(/#\S+/g, ' ')
        .replace(/[⚐-⚑⌀-⏿]/gu, ' ');
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
 * 誤爆の防止は**辞書側の不変条件**で行う: DC/サーバーの alias に 4 文字未満の ASCII 略称
 * (`Man` / `Had` / `Ex` 等、 英語の一般語と衝突する) を入れない。
 * `src/__tests__/housing/masterDataAliases.test.ts` が機械的に禁止しており、
 * ここで文脈ゲートや質フィルタを重ねる必要は無い (2026-07-10 に対症療法から根治へ切替)。
 * エリアの短縮 alias (`Gob`→Goblet) は実在するので、 従来どおり exact 一致で採用する。
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

    // 候補追加ヘルパ (重複は無視、 出現順を維持)
    const pushDc = (dcId: string) => {
        if (!candidates.dc.includes(dcId)) candidates.dc.push(dcId);
    };
    const pushServer = (serverId: string, dcId: string) => {
        if (!candidates.server.some((c) => c.serverId === serverId)) {
            candidates.server.push({ serverId, dcId });
        }
    };
    const pushArea = (areaId: string) => {
        if (!candidates.area.includes(areaId)) candidates.area.push(areaId);
    };

    const tokens = cleaned.split(SEPARATORS).map((t) => t.trim()).filter(Boolean);

    for (const token of tokens) {
        const lower = token.toLowerCase();

        // DC 候補 (兼サーバー候補)
        for (const [dcId, dcData] of Object.entries(serverMasterData)) {
            if (dcData.aliases.some((a) => a.toLowerCase() === lower)) pushDc(dcId);
            // サーバー候補 (DC 推論も兼ねる)
            for (const [serverId, aliases] of Object.entries(dcData.servers)) {
                if (aliases.some((a) => a.toLowerCase() === lower)) pushServer(serverId, dcId);
            }
        }

        // エリア候補 (短縮 alias `Gob`→Goblet も含めて exact 一致で採用)
        for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
            if (areaData.aliases.some((a) => a.toLowerCase() === lower)) pushArea(areaId);
            // アパート名検出 → エリア + サイズ=Apartment
            // 全言語の apartment_name と照合 (ja/en/ko/zh いずれかに一致すれば採用)
            if (Object.values(areaData.apartment_name).some((name) => token === name)) {
                pushArea(areaId);
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
    //   - 部分一致は exact 一致より誤爆しやすいので、 短い alias はここではスキップする
    //     (日本語の 2 文字 alias 「マナ」 等も含む。 exact 一致側で既に拾えている)
    const lowerCleaned = cleaned.toLowerCase();
    const tooShortForSubstring = (alias: string): boolean =>
        alias.length < 3 || (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias));

    for (const [dcId, dcData] of Object.entries(serverMasterData)) {
        for (const alias of dcData.aliases) {
            if (tooShortForSubstring(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) pushDc(dcId);
        }
        for (const [serverId, aliases] of Object.entries(dcData.servers)) {
            for (const alias of aliases) {
                if (tooShortForSubstring(alias)) continue;
                if (lowerCleaned.includes(alias.toLowerCase())) pushServer(serverId, dcId);
            }
        }
    }
    for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
        for (const alias of areaData.aliases) {
            // エリアは短縮 alias (`Gob` / `Mis` / `Emp`) を持つが、 部分一致で使うと
            // "goblet of wine" のような英文に当たるのでここでは除外する (exact 一致では採用)。
            if (alias.length < 2) continue;
            if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) pushArea(areaId);
        }
    }

    // 区-番地パターン: "6-6" "23-6" など
    const wardPlotMatch = cleaned.match(WARD_PLOT_DASH_RE);
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
        const wardPlotJpMatch = cleaned.match(WARD_PLOT_JP_RE);
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
        const wardPlotEnMatch = cleaned.match(WARD_PLOT_EN_RE);
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
    // 別々の DC に属するサーバー候補が複数残った場合も曖昧として棄却する。
    // 上の multipleDc は「DC 名そのもの」 の複数一致しか見ないので、
    // "Hades | Unicorn | Mist | 5-3" (Hades=Mana / Unicorn=Meteor) のように
    // サーバー名だけが競合するケースを取りこぼし、 出現順の先頭が黙って勝っていた。
    if (new Set(candidates.server.map((s) => s.dcId)).size > 1) {
        ambiguity.push('multipleServer');
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
