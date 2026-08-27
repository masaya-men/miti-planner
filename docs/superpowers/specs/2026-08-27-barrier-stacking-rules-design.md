# バリアの重なり方ルール 設計書（2026-08-27）

軽減表のダメージ計算は現在、**すべてのバリアを別々のバケツで持って全部足し算**している。
FF14 では一部のバリアは重ならず「片方だけ残る」ため、その挙動を再現する。
あわせて、正しく重なるバリアどうしの「二重削り」バグも直す。

masaya さんの決定（2026-08-27）:
- 再現範囲: **全部やる**（8.0 でも同じ問題が続くため）
- エウクラシア・プログノシスとの上書き: **後勝ち**（後から使った方が残る）
- エウクラシア・プログノシス ↔ エウクラシア・ディアグノシス: **後勝ち**（暫定・実機認識と概ね一致）
- 上書きで負けたバリアのエフェクト棒: **(c) グレーで最後まで残す** が軽ければ。重ければ **(a) 上書き時点で終了**
- 展開戦術のコピー分 vs 本人の鼓舞系バリア: **鼓舞系どうし＝大きい方が残る** で処理
- 重ならない組み合わせを置いたときの警告: **出さない（黙って整理）**
- 「大きい方が残る」の比較: 後から置いたバリアの詠唱時刻で「新バリア満タン値」vs「既存バリアのその時点の残量」→ 大きい方
- 会心の追加バリア（カタライズ / ディファレンシャル・ダイアグノシス）: **今回は鼓舞/エウクラシアの値に混ぜ込んだまま**（別枠に分けない）
- バリア消費順: **効果時間順ではなく、FF14 実測の固定優先順位表**（§3-5）に従う

---

## 1. FF14 のバリア重なりルール（調査結果）

出典:
- Galvanize（バリア効果の解説） - FFXIV Wiki: https://ffxiv.consolegameswiki.com/wiki/Galvanize
- The Balance — 学者スキル解説: https://www.thebalanceffxiv.com/jobs/healers/scholar/skills-overview/
- スクエニ公式フォーラム: https://forum.square-enix.com/ffxiv/threads/452647 / https://forum.square-enix.com/ffxiv/threads/455993

### 重ならないグループと勝敗ルール

| グループ | 含まれるスキル | グループ内の勝敗 |
|---|---|---|
| **鼓舞系** | 鼓舞激励の策 / 士気高揚の策 / 意気軒高の策 / 展開戦術のコピー分 | **吸収量が大きい方が残る** |
| **エウクラシア・プログノシス系** | エウクラシア・プログノシス / エウクラシア・プログノシスII | （同グループ内は後勝ち） |
| **エウクラシア・ディアグノシス** | エウクラシア・ディアグノシス | （単体・後勝ち） |

### グループをまたぐ勝敗ルール

| 組み合わせ | 勝つ方 |
|---|---|
| 鼓舞系 ↔ エウクラシア・プログノシス系 | **後に使った方**（後勝ち・相互上書き） |
| 鼓舞系 ↔ エウクラシア・ディアグノシス | **エウクラシア・ディアグノシスが必ず勝つ**（一方通行。鼓舞系はディアグノシスを上書きできない） |
| エウクラシア・プログノシス系 ↔ エウクラシア・ディアグノシス | **後に使った方**（要確認。当面は後勝ちで実装） |

公式ゲーム内の効果説明にも「鼓舞系バリアは賢者のエウクラシア・ディアグノシス／エウクラシア・プログノシスとは重複しない」と明記あり。

### 常に加算スタックするもの（今まで通り・変更なし）

- ディヴァインヴェール / 野戦治療の陣 / ケーラコレ / 最大HP◯%系（ブラックナイト等）/ ハイマ・パンハイマ / コンソレイション など
- 鼓舞・エウクラシアが**会心したときに追加でつくバリア**（カタライズ / ディファレンシャル・ダイアグノシス）は上書きされない別枠

---

## 2. 現状のコードと問題点

- 場所: `src/components/Timeline.tsx` の `damageMapResult`（`useMemo`）内、被弾ごとのバリア吸収ループ
- 各バリアを `getShieldState(context, appMit.id, maxVal)` で独立バケツ管理し、全バケツが吸収する
- `context` = Party / MT / ST の3バケツ（対象単体攻撃は該当バケツのみ、全体攻撃は3つ全部）

### 問題A: 重ならないバリアが重なっている

鼓舞激励の策 + 意気軒高の策 を両方置くと 80,000 のバリア扱い。ゲームでは片方（大きい方 ≒ 40,000）だけ。

### 問題B: 二重削り（正しく重なるバリアどうしでも起きる）

`damageForShields`（その被弾で吸収対象になるダメージ）が定数で、各バリアが「1枚目が吸った残り」ではなく「元のダメージ全部」を見て `Math.min(残バリア, ダメージ)` している。
例: 60,000 ダメージ、40,000 バリア2枚 → 片方に 20,000 残るはずが両方 0 になる。
- その被弾の表示ダメージ（0）はたまたま合う（`currentDamage` は減算されるため）
- **後続の被弾**で、本来残っているバリアが「空」扱いになり、多くダメージを受ける
- エフェクト棒も早期終了する

---

## 3. 設計

### 3-1. データモデル: バリアの種類タグ

`src/types/index.ts` の `Mitigation` に追加:

```ts
/** バリアの重なりグループ。同じ値または重ならない相手が既にあるとき、勝敗ルールで1枚に絞る。
 *  未指定 = 自由に加算スタック（ディヴァインヴェール・陣・ハイマ・会心追加バリア等）。 */
barrierStackGroup?: 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis';
```

付与先（`src/data/mockData.ts`）:
- `barrierStackGroup: 'galvanize'` → `adloquium` / `succor` / `concitation` / `deployment_tactics`（copiesShield）
- `barrierStackGroup: 'eukrasian_prognosis'` → `eukrasian_prognosis` / `eukrasian_prognosis_ii`
- `barrierStackGroup: 'eukrasian_diagnosis'` → `eukrasian_diagnosis`
- それ以外のバリアは未指定のまま（挙動変更なし）

### 3-2. 勝敗判定の純関数（テスト可能）

新規 `src/utils/barrierStacking.ts`:

```ts
/** 2つのバリアが同時に効こうとしたとき、生き残るのはどちらか。
 *  戻り値: 'a' = a が残る / 'b' = b が残る / 'both' = 両方スタック（重なる） */
export function resolveBarrierConflict(
  a: { group?: string; value: number; castTime: number },
  b: { group?: string; value: number; castTime: number },
): 'a' | 'b' | 'both'
```

ルール:
1. どちらか一方でも `group` 未指定 → `'both'`（自由スタック）
2. `group` が同じ:
   - `galvanize` → `value` が大きい方（同値なら後勝ち）
   - `eukrasian_prognosis` → 後勝ち（`castTime` が新しい方）
   - `eukrasian_diagnosis` → 後勝ち
3. `group` が違う:
   - `eukrasian_diagnosis` が絡む → `eukrasian_diagnosis` が勝つ
   - `galvanize` ↔ `eukrasian_prognosis` → 後勝ち

### 3-3. 適用フロー

`damageMapResult` のバリア吸収ループを次のように変える（context ごとに独立処理）:

**ステップ1: 有効なバリアの整理（新規）**

その被弾時刻でアクティブなバリアを列挙し、`resolveBarrierConflict` を総当たりで適用して
「この context で実際に吸収に参加できるバリア」を確定する。負けたバリアは:
- 記録: `barrierOverwrittenAt: Map<appMit.id, { context, time }>` に「負けた時刻（＝勝った相手の詠唱時刻、または最初から負けているなら自分の詠唱時刻）」を残す
- そのバリアは以降その context の吸収に参加しない

**ステップ2: 優先順位表の順に吸収（問題B の修正）**

生き残ったバリアを **FF14 の「バリア消費優先順位表」の順**（下記 §3-5）で処理し、
`remaining`（まだ吸収対象のダメージ）を持ち回る:

```
let remaining = damageForShields;
for (const shield of survivingShieldsByConsumptionPriority) {
  const absorbed = Math.min(shieldRemaining, remaining);
  remaining -= absorbed;
  // ... 残バリア更新 / スタック処理 / shieldExhaustedAt 記録
  if (remaining <= 0) break;
}
```

（当初「詠唱時刻の古い順」としていたが、実測でこれは誤りと判明。FF14 は詠唱順・効果時間順では
なく、スキルごとに固定された優先順位表で消費する。§3-5 参照。）

### 3-5. バリア消費優先順位表（FF14 実測・パッチ 7.31）

出典: Lodestone ブログ「075.バリア消費の優先度」
https://na.finalfantasyxiv.com/lodestone/character/34801907/blog/5607030/
（パンデモニウム煉獄編2層 討伐制限解除・毒沼DoTで二分探索して検証）

数字が小さいほど**先に消費される**。application 順・効果時間は無関係。
「壊れると追加効果があるバリア」ほど先、「重ね掛け前提のバリア」ほど後。

| 順位 | バリア（スキル） | 軽減表での実装 |
|---|---|---|
| 1 | テンペラコート(ピクトマンサー) / アルケインクレスト(リーパー Lv84+) | 該当あれば |
| 2 | テンペラグラッサ(ピクトマンサー) | 〃 |
| 3 | ブラックナイト(ダークナイト) | あり |
| 4 | エウクラシア・ディアグノシス(賢者) | あり |
| 5 | ハイマ(賢者) | あり |
| 6 | パンハイマ(賢者) | あり |
| 7 | ブルータルシェル(ガンブレイカー) | あり |
| 8 | 原初の血気(ウォーリア) | 該当あれば |
| 9 | ガーディアン(ナイト) | 該当あれば |
| 10 | ディヴァインカレス(白魔道士) | あり |
| 11 | マバリア(黒魔道士) / 残影(忍者) / アルケインクレスト(Lv1-83) | あり |
| 12 | ディヴァインベニゾン(白魔道士) | あり |
| 13 | 星天交差(占星術師) | あり |
| 14 | The Spire(占星術師) | 該当あれば |
| 15 | エウクラシア・プログノシス(賢者) | あり |
| 16 | セラフィックヴェール(学者) | あり |
| 17 | ホーリズム(賢者) | あり |
| 18 | 守りのエギ(召喚士) | 該当あれば |
| 19 | シェイクオフ(ウォーリア) | あり |
| 20 | ディヴァインヴェール(ナイト) | あり |
| 21 | ニュートラルセクト(占星術師) | あり |
| 22 | 即興(踊り子) | 該当あれば |
| 23 | カタライズ(学者・鼓舞会心の追加バリア) | 現状は鼓舞値に混ぜ込み（§5・分けない） |
| 24 | ディファレンシャル・ダイアグノシス(賢者・エウクラシア会心の追加バリア) | 〃 |
| 25 | 鼓舞(学者: 鼓舞激励の策 / 士気高揚の策 / 意気軒高の策 / 展開戦術) | あり |

**実装**: `src/data/mockData.ts` の各バリア def に `barrierConsumptionPriority: number` を付ける。
未設定のバリアは最低優先度（末尾）扱いで、既存の相対順を壊さない安全側に倒す。
表に無い（自己バリア等で未検証の）ものは、性質から近い位置に暫定配置し、コメントで明記。

### 3-5b. 実際に付与したマッピング（Task 2 実装結果・2026-08-27）

`src/types/index.ts` の `Mitigation` に 2 フィールドを追加（`reapplyOnAbsorption` の直後）:
- `barrierStackGroup?: 'galvanize' | 'eukrasian_prognosis' | 'eukrasian_diagnosis'`
- `barrierConsumptionPriority?: number`

`src/data/mockData.ts` の `isShield: true` な def は 28 件（`grep -n 'isShield: true'`）。全 28 件に priority を付与、うち 10 件に group も付与。未設定で残した def は **なし**。

| def id | job | 日本語名 | barrierStackGroup | barrierConsumptionPriority |
|---|---|---|---|---|
| `tempera_grassa` | pct | テンペラグラッサ | — | 2 |
| `the_blackest_night` | drk | ブラックナイト | — | 3 |
| `eukrasian_diagnosis` | sge | エウクラシア・ディアグノシス | `eukrasian_diagnosis` | 4 |
| `haima` | sge | ハイマ | — | 5 |
| `panhaima` | sge | パンハイマ | — | 6 |
| `bloodwhetting` | war | 原初の血気 | — | 8 |
| `nascent_flash` | war | 原初の猛り | — | 8 |
| `divine_caress` | whm | ディヴァインカレス | — | 10 |
| `arcane_crest` | rpr | アルケインクレスト | — | 11 ※暫定（下記） |
| `divine_benison` | whm | ディヴァインベニゾン | — | 12 |
| `celestial_intersection` | ast | 星天交差 | — | 13 |
| `the_spire` | ast | ビエルゴの塔 | — | 14 |
| `eukrasian_prognosis` | sge | エウクラシア・プログノシス（maxLv95旧版） | `eukrasian_prognosis` | 15 |
| `eukrasian_prognosis_ii` | sge | エウクラシア・プログノシスII | `eukrasian_prognosis` | 15 |
| `consolation` | sch | コンソレイション（セラフ・慰藉／セラフィックヴェール源） | — | 16 |
| `holos` | sge | ホーリズム | — | 17 |
| `shake_it_off` | war | シェイクオフ | — | 19 |
| `divine_veil` | pld | ディヴァインヴェール | — | 20 |
| `helios_conjunction` | ast | コンジャンクション・ヘリオス（Nセクト中のみバリア） | — | 21 |
| `aspected_helios` | ast | アスペクト・ヘリオス（Nセクト中のみバリア・旧版） | — | 21 |
| `improvisation` | dnc | インプロビゼーション（即興） | — | 22 |
| `adloquium` | sch | 鼓舞激励の策 | `galvanize` | 25 |
| `succor` | sch | 士気高揚の策 | `galvanize` | 25 |
| `concitation` | sch | 意気軒高の策 | `galvanize` | 25 |
| `deployment_tactics` | sch | 展開戦術 | `galvanize` | 25 |
| `deployment_tactics_base` | sch | 展開戦術（低レベル版） | `galvanize` | 25 |
| `manifestation` | sch | マニフェステーション（セラフィズム中の鼓舞激励・hidden） | `galvanize` | 25 |
| `accession` | sch | アクセッション（セラフィズム中の士気高揚・hidden） | `galvanize` | 25 |

**補足:**
- `arcane_crest` の 11 は暫定。コード上に「命脈を借り受け(Lv84+)は本来 priority 1 だが軽減表はレベル分岐を持たないため 11 固定」とコメント。
- `manifestation` / `accession` はセラフィズム中の鼓舞激励／士気高揚。Galvanize バリアを付与するため `galvanize` グループ・25。**セラフィックヴェールではない**。
- `neutral_sect` def は `isShield: false`（ヒール強化バフ）なので触っていない。Nセクト由来バリアは `helios_conjunction` / `aspected_helios` が担当（21）。
- 優先順位表の 1（テンペラコート）/ 7（ブルータルシェル＝ハート・オブ・コランダムは `isShield: false`）/ 9（ガーディアン）/ 11 のうちマバリア・残影（`arcane_crest` は priority 11 で対応あり）/ 18（守りのエギ）/ 23-24（会心追加バリア）に対応する `isShield: true` の def は存在しない。
- `helios_conjunction_base` は `MITIGATION_DISPLAY_ORDER` 配列に id 参照はあるが、対応する def は存在しない（実体は `aspected_helios`）。既存の不整合であり本タスクでは触れていない。
- ロジック変更ゼロ。後続 Task 3-5 がこのデータを純関数で消費する。

### 3-4. エフェクト棒

- **上書きで負けたバリア**: masaya さん判断 = (c) 優先。
  - `barrierOverwrittenAt` を PC/スマホ両方の棒描画に渡す
  - (c) を採用する場合: 棒を「負けた時刻」で 2 分割。前半は通常色、後半は**グレー（不透明度を下げる or `--app-text-muted` 系）**で自然な効果時間終端まで描画
  - (a) に倒す場合: 既存の `shieldExhaustedAt` と同じく `Math.min` で負けた時刻にクリップして終了
  - **実装コストの見積もりを実装前に出し、(c) が重ければ (a) に確定する**（masaya さん了承済み）
- **吸収し切りで尽きたバリア**: 既存の `shieldExhaustedAt` のまま（今回の変更と両立）
- **展開戦術のコピー分**: 点2（別項）でエフェクト棒を解禁したうえで、上記ルールに乗る

---

## 4. 検証

- `resolveBarrierConflict` の単体テスト（全ペア網羅: galvanize 内部の大小、eukrasian 後勝ち、cross のディアグノシス優先、片方 group 無し=both）
- `damageMapResult` 側は純関数を切り出してテスト:
  - 鼓舞激励の策(大) + 意気軒高の策(小) を同時配置 → 合計バリアが大きい方のみ（80,000 でなく 40,000 相当）
  - 二重削り: 60,000 被弾 + 40,000 バリア2枚（別グループ or group 無し）→ 2枚目に 20,000 残る
  - エウクラシア・プログノシス後出し → 鼓舞系バリアが詠唱時刻で終了、以降プログノシスが吸収
  - 消費順: 星天交差(30,000) + 鼓舞(100,000) + ディヴァインヴェール(30,000) に 150,000 被弾
    → 星天交差・ディヴァインヴェール先に消費、鼓舞に 10,000 残る（鼓舞は優先度 25 で必ず最後）
- tsc / build / 関連 vitest 通過
- 実機: SCH+SGE 構成で鼓舞→プログノシスの順に置き、棒とダメージ値を目視確認

## 5. 触ってはいけない / スコープ外

- % 軽減（リプライザル等）の `exclusiveWith` ロジックは別物。触らない
- 会心の追加バリア（カタライズ）を「Galvanize 本体と別枠」に分割する件は **本設計では対象外**
  （現状は鼓舞のバリア値に会心倍率を丸め込み済み。厳密には別枠で常時スタック・上書きされないが、
  実害が小さいため保留。※ masaya さん確認事項）
- 同一ジョブ2枚（学者2人等）の特殊ルールは対象外

---

## 6. 未確定 / 実装時に詰める

- §3-5 の優先順位表を軽減表の全バリア def にマッピングする作業（表に無い自己バリア等の暫定配置）
- (c) グレー棒の実装コスト見積もり → 重ければ (a) に確定
- The Spire / 守りのエギ / 原初の血気 等、軽減表に該当スキルがあるか（無ければ表項目はスキップ）

## 7. 実装順（案）

1. 点2: 展開戦術のエフェクト棒を解禁（独立・小・低リスク）
2. `resolveBarrierConflict`（重ならないグループの勝敗）+ 単体テスト
3. `barrierConsumptionPriority` の付与 + 消費順ループへの書き換え + 二重削り修正 + テスト
4. エフェクト棒（負けたバリアの (c) or (a)）
5. 実機確認（SCH+SGE 構成）
