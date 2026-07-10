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

// 区-番地パターン (3 系統)。 抽出本体と「短い ASCII alias を許すかの文脈ゲート」 の両方で共有する。
//   1. "6-6" "23-6" 等 (N-M / 各種ダッシュ)
//   2. "6番地6番" "6区 23番" 等 (日本語表記)
//   3. "w21 p58" "W21 P58" 等 (NA/EU 英語表記、 w=ward / p=plot)
// いずれも非グローバル (lastIndex 状態を持たない) ので .test() / .match() を使い回せる。
const WARD_PLOT_DASH_RE = /(\d{1,2})\s*[-－‐ー~〜]\s*(\d{1,2})/;
const WARD_PLOT_JP_RE = /(\d{1,2})\s*(?:番地|区)\s*(\d{1,2})\s*番?/;
const WARD_PLOT_EN_RE = /\bw\s*(\d{1,2})\s*p\s*(\d{1,2})\b/i;

// 「構造化された住所行」 の指標となる区切り記号。 実データの定番フォーマットは
// `Mana┆Hades┆⚐Gob 2-23 S` / `crystal | goblin | shirogane | w21 p58` のように
// フィールドを区切り記号で並べる。 2 個以上あれば「文章」 ではなく「住所行」 とみなす。
const STRUCTURED_SEPARATOR_RE = /[|｜┆/／]/g;
const MIN_STRUCTURED_SEPARATORS = 2;

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
 * "ManaのHades" が入力された。
 *
 * v2 (2026-07-10): これを「一律禁止」 ではなく**文脈ゲート**に変更した。
 * ただしゲートの条件は「ward/plot がある」 **だけでは足りない** (敵対的レビューで実証):
 *   "Finally had my dream home! Mist w5 p3 M"
 * は ward/plot を含む普通の英文だが、 "had" が Hades と一致して DC/サーバーを丸ごと捏造する。
 * 住所を書いた文には ほぼ必ず ward/plot が付くので、 これでは**一番危ない場面で正確にゲートが開く**。
 *
 * そこで条件を 2 つの AND にした:
 *   (a) ward/plot パターンが出現する
 *   (b) 区切り記号 (`|` `┆` `/`) が 2 個以上ある = 「文章」 ではなく「構造化された住所行」
 * 実データの定番フォーマット (`Mana┆Hades┆⚐Gob 2-23 S`) は (b) を満たし、
 * 英語の自由文は満たさない。 呼び出し側が `opts.allowShortAscii` で明示上書きもできる。
 *
 * さらにゲートが開いた場合でも、 短縮 alias で当たった候補はフル名で当たった候補より
 * 質を低く扱い、 フル名の候補が 1 つでもあれば短縮由来は捨てる (keepBestQuality)。
 */
function isTooShortAsciiAlias(alias: string): boolean {
    return alias.length < 4 && /^[\x00-\x7f]+$/.test(alias);
}

// 一致した alias の「質」。 フル名/長い alias = 1、 短縮 ASCII alias = 0。
// 同一候補が複数 alias で当たった場合は最大値を採る。
type MatchQuality = 0 | 1;
function aliasQuality(alias: string): MatchQuality {
    return isTooShortAsciiAlias(alias) ? 0 : 1;
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
 * @param text 解析対象テキスト
 * @param opts.allowShortAscii 短い ASCII alias を DC/サーバーの exact 一致に参加させるか。
 *   未指定なら「テキスト自身に ward/plot パターンが出現するか」で自動決定する
 *   (範囲チェックの成否ではなく、 パターンの出現有無で判定)。
 *   既存の 1 引数呼び出しの挙動を壊さないため optional。
 */
export function parseHousingFromText(
    text: string,
    opts?: { allowShortAscii?: boolean },
): HousingExtractResult {
    const cleaned = preprocess(text);
    const ambiguity: string[] = [];

    // 文脈ゲート (token ループより先に確定させる)。 (a) AND (b) の両方が必要。
    //   (a) ward/plot パターンが出現する。 範囲チェック (1-30 / 1-60) の成否ではなく
    //       「パターンが出現したか」 で判定する (例: "シロガネ 99-99 L" は範囲外だが出現している)。
    //   (b) 区切り記号が 2 個以上 = 構造化された住所行。 これが無いと
    //       "Finally had my dream home! Mist w5 p3 M" のような英文で "had"→Hades を捏造する。
    const hasWardPlotPattern =
        WARD_PLOT_DASH_RE.test(cleaned) ||
        WARD_PLOT_JP_RE.test(cleaned) ||
        WARD_PLOT_EN_RE.test(cleaned);
    const isStructured =
        (cleaned.match(STRUCTURED_SEPARATOR_RE)?.length ?? 0) >= MIN_STRUCTURED_SEPARATORS;
    const allowShortAscii = opts?.allowShortAscii ?? (hasWardPlotPattern && isStructured);

    const candidates = {
        dc: [] as Array<{ dcId: string; quality: MatchQuality }>,
        server: [] as Array<{ serverId: string; dcId: string; quality: MatchQuality }>,
        area: [] as Array<{ areaId: string; quality: MatchQuality }>,
        size: [] as HousingExtractSize[],
    };

    // 候補追加ヘルパ (重複は質の高い方へアップグレード、 出現順は維持)
    const pushDc = (dcId: string, quality: MatchQuality) => {
        const existing = candidates.dc.find((c) => c.dcId === dcId);
        if (existing) {
            if (quality > existing.quality) existing.quality = quality;
        } else {
            candidates.dc.push({ dcId, quality });
        }
    };
    const pushServer = (serverId: string, dcId: string, quality: MatchQuality) => {
        const existing = candidates.server.find((c) => c.serverId === serverId);
        if (existing) {
            if (quality > existing.quality) existing.quality = quality;
        } else {
            candidates.server.push({ serverId, dcId, quality });
        }
    };
    const pushArea = (areaId: string, quality: MatchQuality) => {
        const existing = candidates.area.find((c) => c.areaId === areaId);
        if (existing) {
            if (quality > existing.quality) existing.quality = quality;
        } else {
            candidates.area.push({ areaId, quality });
        }
    };

    const tokens = cleaned.split(SEPARATORS).map((t) => t.trim()).filter(Boolean);

    for (const token of tokens) {
        const lower = token.toLowerCase();

        // DC 候補 (兼サーバー候補)。 短い ASCII alias は文脈ゲートが開いているときだけ exact 一致に参加。
        for (const [dcId, dcData] of Object.entries(serverMasterData)) {
            for (const a of dcData.aliases) {
                if (a.toLowerCase() !== lower) continue;
                if (isTooShortAsciiAlias(a) && !allowShortAscii) continue;
                pushDc(dcId, aliasQuality(a));
            }
            // サーバー候補 (DC 推論も兼ねる)
            for (const [serverId, aliases] of Object.entries(dcData.servers)) {
                for (const a of aliases) {
                    if (a.toLowerCase() !== lower) continue;
                    if (isTooShortAsciiAlias(a) && !allowShortAscii) continue;
                    pushServer(serverId, dcId, aliasQuality(a));
                }
            }
        }

        // エリア候補 (挙動は従来どおり: 短縮 alias もガードせず exact 一致で採用。 質だけ付与)
        for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
            for (const a of areaData.aliases) {
                if (a.toLowerCase() === lower) {
                    pushArea(areaId, aliasQuality(a));
                }
            }
            // アパート名検出 → エリア + サイズ=Apartment
            // 全言語の apartment_name と照合 (ja/en/ko/zh いずれかに一致すれば採用)
            if (Object.values(areaData.apartment_name).some((name) => token === name)) {
                pushArea(areaId, 1);
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
    //   - 短い ASCII alias (< 4 文字) は allowShortAscii に関わらずスキップ (部分一致は誤爆が激しいため据え置き)
    //   - ここで当たるのは常にフル名/長い alias なので質は 1 固定
    const lowerCleaned = cleaned.toLowerCase();
    for (const [dcId, dcData] of Object.entries(serverMasterData)) {
        for (const alias of dcData.aliases) {
            // 短すぎる alias は誤一致リスク高 (token loop で exact match を既にやっているので不要)
            if (alias.length < 3) continue;
            // ASCII の 3 文字 alias (例: "Man"=Mana, "Mat"=Materia) は英文中の単語に誤一致するため除外
            if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) {
                pushDc(dcId, 1);
            }
        }
        for (const [serverId, aliases] of Object.entries(dcData.servers)) {
            for (const alias of aliases) {
                // 短すぎる alias は誤一致リスク高 (token loop で exact match を既にやっているので不要)
                if (alias.length < 3) continue;
                // ASCII の 3 文字 alias (例: "Man"=Mana, "Mat"=Materia) は英文中の単語に誤一致するため除外
                if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
                if (lowerCleaned.includes(alias.toLowerCase())) {
                    pushServer(serverId, dcId, 1);
                }
            }
        }
    }
    for (const [areaId, areaData] of Object.entries(housingAreaMasterData)) {
        for (const alias of areaData.aliases) {
            if (alias.length < 2) continue;
            if (alias.length < 4 && /^[\x00-\x7f]+$/.test(alias)) continue;
            if (lowerCleaned.includes(alias.toLowerCase())) {
                pushArea(areaId, 1);
            }
        }
    }

    // 候補ランキング: フル名/長い alias (quality 1) が 1 つでもあれば、
    // 短縮 alias 由来 (quality 0) の候補は**捨てる**。 後ろへ回すだけでは足りない。
    //
    // 後ろへ回すだけだと候補が「残る」ので、 下の `candidates.dc.length > 1` (multipleDc) に引っかかり
    // 正しい DC まで巻き添えで棄却される。 実例 (文脈ゲートを開いた副作用):
    //   "man this took ages. Crystal Goblin Shirogane 21-58"
    //   → "man" が Mana(DC・質0)、 "Crystal" が Crystal(DC・質1) に当たり multipleDc で両方消える。
    // 質が全部同じ (= フル名の一致が無い) 場合は出現順のまま全部残す
    // (sample3 の "Gob"→Goblet(area) が該当。 唯一の候補なので残さないと area が取れない)。
    const keepBestQuality = <T extends { quality: MatchQuality }>(list: T[]): T[] =>
        list.some((c) => c.quality === 1) ? list.filter((c) => c.quality === 1) : list;
    candidates.dc = keepBestQuality(candidates.dc);
    candidates.server = keepBestQuality(candidates.server);
    // ⚠ area には**適用しない**。 エリアのフル名 (`Mist` / `Goblet`) はそのまま英単語なので、
    // 質でフィルタすると "Emp 5-3 M what a goblet of wine" が Empyreum ではなく Goblet になる
    // ("goblet" が質 1、 正解の "Emp" が質 0)。 area は従来どおり出現順の先頭を採る。

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
    let dc: string | undefined = candidates.dc[0]?.dcId;
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
    // "Had | Uni | Mist | 5-3" (Hades=Mana / Unicorn=Meteor) のように
    // サーバー名だけが競合するケースを取りこぼし、 出現順の先頭が黙って勝っていた。
    if (new Set(candidates.server.map((s) => s.dcId)).size > 1) {
        ambiguity.push('multipleServer');
        dc = undefined;
        server = undefined;
    }

    return {
        dc,
        server: server?.serverId,
        area: candidates.area[0]?.areaId,
        ward,
        plot,
        size: candidates.size[0],
        ambiguity,
    };
}
