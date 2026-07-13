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
    // アパート専用 (2026-07-13 round2 A-1): 号棟 (1=本街/2=拡張街)。確信が持てるときのみ設定。
    apartmentBuilding?: number;
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

// アパート文脈専用 (2026-07-13 round2 A-1): 号棟-部屋番号 (例 "1-13")。
// 号棟は 1(本街) / 2(拡張街) のみが有効 (validateAddress の apartmentBuilding 制約と同一) なので、
// 家用の WARD_PLOT_DASH_RE (区は 1-30 のどれでも許す) より誤爆しにくい確信度の高いパターンとして使う。
const APARTMENT_BUILDING_ROOM_RE = /([12])\s*[-－‐ー~〜]\s*(\d{1,2})/;

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

    // アパート文脈判定 (2026-07-13 round2 A-1・最重要): この時点で candidates.size に
    // 'Apartment' が入っていれば、アパート名一致 (上のループ内) かサイズ別名一致 (同上) の
    // どちらかで既に確定している。立っている間は家用「区-番地」正規表現 (WARD_PLOT_DASH_RE 等)
    // による ward/plot 割当を一切適用しない。plot は buildingType='apartment' で常に無効な値であり
    // (validateAddress: addr.plot !== undefined はエラー)、家用の "N-M" を ward=N/plot=M と
    // 誤読すると住所全体が invalid になる (実例: "Mist | 17 | Topmast 1-13 | Apartment" を
    // 誤って ward=1/plot=13 と読んでいた。本来は 区=17・号棟=1・部屋=13)。
    const isApartmentContext = candidates.size.includes('Apartment');

    let ward: number | undefined;
    let plot: number | undefined;
    let apartmentBuilding: number | undefined;
    let roomNumber: number | undefined;

    if (!isApartmentContext) {
        // 区-番地パターン: "6-6" "23-6" など
        const wardPlotMatch = cleaned.match(WARD_PLOT_DASH_RE);
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
    } else {
        // アパート文脈: 号棟(1 or 2 のみ有効・validateAddress と同じ制約)-部屋番号を
        // "N-M" から保守的に抽出する。号棟が 1/2 以外、または部屋番号が範囲外 (1-90) なら
        // 確信が持てないため両方 undefined のまま返す (誤値を作らない)。
        const buildingRoomMatch = cleaned.match(APARTMENT_BUILDING_ROOM_RE);
        if (buildingRoomMatch) {
            const b = +buildingRoomMatch[1];
            const r = +buildingRoomMatch[2];
            if ((b === 1 || b === 2) && r >= 1 && r <= 90) {
                apartmentBuilding = b;
                roomNumber = r;
            }
        }

        // 区 (ward) の保守的抽出: token 分割済みの「独立した 1-2 桁の数値トークン」のうち、
        // 号棟-部屋の抽出に使った 2 つの値 (存在すれば) を取り除いた残りが**ちょうど 1 つ**だけ
        // ならそれを区とみなす。複数残る/ゼロ個は曖昧なので undefined のまま (誤値より空欄優先)。
        // 例 "Mist | 17 | Topmast 1-13 | Apartment" → tokens の数値は "17"/"1"/"13"、
        // "1"/"13" は号棟/部屋で消費済みなので残りは "17" の 1 つ → ward=17。
        const numericTokens = tokens.filter((tk) => /^\d{1,2}$/.test(tk));
        const remainingNumericTokens = [...numericTokens];
        const consumeFirst = (value: string) => {
            const idx = remainingNumericTokens.indexOf(value);
            if (idx !== -1) remainingNumericTokens.splice(idx, 1);
        };
        if (apartmentBuilding !== undefined) consumeFirst(String(apartmentBuilding));
        if (roomNumber !== undefined) consumeFirst(String(roomNumber));
        if (remainingNumericTokens.length === 1) {
            const w = +remainingNumericTokens[0];
            if (w >= 1 && w <= 30) ward = w;
        }
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
        apartmentBuilding,
        roomNumber,
        ambiguity,
    };
}
