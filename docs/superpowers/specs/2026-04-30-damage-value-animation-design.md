# ダメージ値変化アニメーション 設計書

**日付**: 2026-04-30
**ステータス**: 実装済み（Revision 3 適用）
**対象**: 軽減表（Timeline）の軽減後ダメージ値表示

---

## ⚠️ Revision 3（2026-04-30 翌日）— 「ゆったり化」スプリング採用

Revision 2 で発動条件を「致死クロス時のみ」に絞った結果、同時アニメ件数が約 95% 削減され、たまにしか出ない演出になった。「たまに出るアニメをもっとドラマチックに見せたい」というユーザー要望を受けて、easing をスプリング（out-back）に変更し、duration / 距離 / stagger をすべて拡大。

### 変更後の数値（プレビュー tuning で確定）

#### Enter（新値の登場）
```
y_px:        26px（下から）→ 0
opacity:     0 → 1
duration:    380ms
stagger:     32ms（桁ごと）
easing:      cubic-bezier(0.34, 1.56, 0.64, 1)  # out-back（軽くオーバーシュート）
```

#### Exit（旧値の退場）
```
y_px:        0 → -6px（上へ）
opacity:     1 → 0
duration:    150ms
stagger:     12ms（桁ごと）
easing:      cubic-bezier(0.7, 0, 0.84, 0)   # in-expo（変更なし）
```

#### 7 桁時の合計（overlap 方式）
exit 150 + 12×6 = 222ms と enter 380 + 32×6 = 572ms が並行。退場・登場が重なり、画面表現としては約 572ms（enter 完了まで）。

### 設計判断メモ

- **out-back の overshoot 量**: cubic-bezier(0.34, 1.56, 0.64, 1) は終点で +10% 弱の overshoot。translateY(26px) → -2.6px 程度の上方向はみ出しがあるが、`.dmg-slot { overflow: hidden; height: 22px }` の slot 内に収まる範囲（文字 line-height:1 で配置）。実機で違和感なし。
- **致死シグナルとして派手寄り OK**: 「軽減が足りなくなった／足りた」セマンティックな瞬間だけ出るため、ゲーム的なキビキビ感を強めても煩くならない。
- **Exit はあえて控えめのまま**: enter 主役、exit は古い値が静かに上へ退く役割分担。distance/stagger を Enter ほど大きくしない。

### 実装更新箇所

- `src/components/AnimatedDamage.css`: keyframes / .ch.enter / .ch.exit の数値、Revision 3 コメント
- `src/components/AnimatedDamage.tsx`: `EXIT_DURATION_MS = 150`, `EXIT_STAGGER_MS = 12`
- `src/components/__tests__/AnimatedDamage.test.tsx`: `advanceTimersByTime(200 → 240)`、コメント数値同期

---

## ⚠️ Revision 2（2026-04-30 後半）— 実機検証後の重要変更

実装直後の実機検証で 2 つの課題が判明し、以下のように変更：

### 変更 1: アニメ発動条件を「致死クロス時のみ」に限定

**Before**: 値が変わるたびにアニメ発動
**After**: `isLethal` 状態が反転（緑→赤 or 赤→緑）した瞬間だけアニメ発動

**理由**:
- ユーザー視点で「軽減が足りた／足りなくなった」が直感的に伝わる**セマンティックなシグナル**になる
- 値だけ変わって致死状態が同じ場合（例: 25,000→18,000、両方非致死）はアニメ不要
- 同時アニメ件数が約 95% 削減 → パフォーマンス大幅向上、視覚的にも控えめで上品

**実装方針**:
- `prevIsLethalRef` で前回の致死状態を保持
- 値変化のみ（致死状態維持）の場合: 文字列だけサイレント更新（アニメなし）
- 致死状態反転の場合: フル swap アニメ起動

### 変更 2: Sequential → Overlap（並行）方式

**Before**: 旧文字列 exit 完了 → micro_delay 待機 → 新文字列 enter（直列）
**After**: 旧文字列 exit と新文字列 enter を**同時並行**実行

**理由**:
- Sequential 方式では「旧が消えてから新が出てくる」間の数十〜数百 ms に画面が空白になり、ユーザーから「一瞬全体が消える」と指摘
- Overlap 方式は古い文字が上に消えていく途中で新しい文字が下から登場するため、空白期間が一切なし

**実装方針**:
- DOM 構造を 2 layer に分割（exit-layer / enter-layer）
- enter-layer は通常 flow（slot サイズの根拠）
- exit-layer は `position: absolute; inset: 0;` で重ねる
- 両 layer の chars が同時に animation 開始
- exit 完了タイミング（exitTotalMs）で exit-layer を DOM から除去

### 変更 3: SWAP_DELAY_MS を撤廃

Overlap 方式では「旧 exit → delay → 新 enter」の順序付けが不要になり、`SWAP_DELAY_MS = 10` 定数は削除。

---

## オリジナル設計（Revision 1）

以下、初期実装時の設計内容（参考）：

---

## 1. 目的・背景

軽減表で軽減を配置・削除すると、ダメージ値が瞬時に切り替わる。「変わった」ことが視覚的に伝わりにくく、ユーザーは数値の差分を意識しないと変化に気付けない。

ダメージ値変化に「下から立ち上がってフェードイン」の per-character アニメーションを加え、**軽減操作のフィードバックを直感的に**する。FF14 ゲーム内のダメージポップ表示に近い「ゲームっぽいキビキビ感」を狙う。

### 制約
- **絶対に重くしない**（60/120/244 FPS 死守）
- **既存の挙動・他コンポーネントに影響を出さない**
- **モーション低減希望ユーザー（A11y）に配慮**

---

## 2. 対象範囲

### アニメ対象
- **軽減後ダメージ値**（緑/赤の数字、`damages[i].mitigated` 表示部分）
- 表示箇所: `src/components/TimelineRow.tsx` の damage cell
- スマホ版 `MobileTimelineRow.tsx` も同等に対応（実装は別だが同じ仕様）

### アニメ対象外（今回は触らない）
- 元ダメージ値（unmitigated 表示、ほぼ変動しない）
- 軽減率「▼ 19%」表示
- シールド吸収量「🛡 72,738」表示
- 「無敵」表示

---

## 3. 動きの仕様（プレビューで確定済み）

参考: GitHub `pixel-point/animate-text` リポジトリの `bottom-up-letters` 仕様（数値レシピのみ参考、コード非コピー）。

### Enter（新値の登場）
```
y_px:        15px（下から）→ 0
opacity:     0 → 1
duration:    150ms
stagger:     22ms（桁ごと）
easing:      cubic-bezier(0.18, 1, 0.32, 1)  # out-expo
```

### Exit（旧値の退場）
```
y_px:        0 → -3px（上へ）
opacity:     1 → 0
duration:    120ms
stagger:     10ms（桁ごと）
easing:      cubic-bezier(0.7, 0, 0.84, 0)   # in-expo
```

### Swap（旧→新の遷移）
```
mode:           sequential（旧 exit 完了 → 新 enter）
micro_delay_ms: 10
```

### 7 桁時の合計
旧 exit (120 + 10×6=60ms) + delay (10ms) + 新 enter (150 + 22×6=132ms) = **約 472ms**

---

## 4. 実装方針

### 4.1 ファイル構成

| ファイル | 役割 |
|----------|------|
| `src/components/AnimatedDamage.tsx` | 新規。ダメージ値専用アニメーション コンポーネント |
| `src/components/AnimatedDamage.module.css`（または styles 直書き） | アニメ keyframes / クラス定義 |
| `src/components/TimelineRow.tsx` | `formatDmg(damages[i].mitigated)` の表示部分を `<AnimatedDamage value={...} />` に置換 |
| `src/components/MobileTimelineRow.tsx` | 同上 |

**新規コンポーネントに分離する理由**：
- TimelineRow.tsx は既に大きい（既存責務肥大の懸念あり）
- アニメロジックを 1 箇所に集約 → PC/スマホで使い回し
- テスト容易、将来「他の数値にも展開したい」となったとき再利用可

### 4.2 AnimatedDamage コンポーネント仕様

#### Props
```ts
interface AnimatedDamageProps {
  value: number;          // 表示する数値（変わるとアニメ起動）
  isLethal?: boolean;     // 致死判定（赤色、文字 weight 変更）
  className?: string;     // 追加クラス（既存配置との互換）
}
```

#### 内部動作
1. `value` を `value.toLocaleString()` で 3 桁カンマ区切り文字列化
2. 文字列を 1 文字ずつ `<span class="ch" style="--i: {idx}">` に分割
3. 前回 render 時の値と比較（`useRef` で前回値保持）
   - 初回マウント: アニメなし、即表示（チラつき防止）
   - 値が同じ: アニメなし、何もしない
   - 値が異なる: swap シーケンス起動
4. swap 起動時:
   - 既存 span に `.exit` クラス付与 → exit アニメ走行
   - `setTimeout(exit_total + micro_delay)` 後に DOM を新文字列で再構築 → 全 span に `.enter` クラス付与
5. アニメ完了後（`onAnimationEnd`）に `will-change` を外す

#### キャンセル制御（連続変更対応）
- `useEffect` の cleanup で `clearTimeout` する
- value が swap 中に再変更されたら、最新値で**即座に再起動**（旧アニメは中断）

### 4.3 CSS（重要部分）

```css
.dmg-slot {
  height: <スロット高>;
  overflow: hidden;             /* 必須: セル外へ漏らさない */
  display: flex;
  line-height: 1;
  font-variant-numeric: tabular-nums;  /* 桁幅固定 */
}
.dmg-slot .ch {
  display: inline-block;
  /* will-change はアニメ中のみ JS で付与・終了後に外す */
}
.dmg-slot .ch.enter {
  animation: dmgEnter 150ms cubic-bezier(0.18, 1, 0.32, 1) both;
  animation-delay: calc(22ms * var(--i));
}
.dmg-slot .ch.exit {
  animation: dmgExit 120ms cubic-bezier(0.7, 0, 0.84, 0) both;
  animation-delay: calc(10ms * var(--i));
}
@keyframes dmgEnter {
  from { transform: translateY(15px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes dmgExit {
  from { transform: translateY(0);   opacity: 1; }
  to   { transform: translateY(-3px); opacity: 0; }
}

/* A11y: モーション低減対応 */
@media (prefers-reduced-motion: reduce) {
  .dmg-slot .ch.enter,
  .dmg-slot .ch.exit {
    animation: none;
  }
}
```

### 4.4 スロット高の決定

`text-app-2xl` (14px) + `font-black` (900 weight) で実測必要。プレビューでは 22px。実機実装時に：
- 文字下端が overflow:hidden で確実に隠れる高さを確保
- 既存の `gap-0.5 leading-none` レイアウトと共存
- 上下の sub-info（「▼ 19%」など）の位置がズレない

実装中に Chrome DevTools で確認しながら微調整（22〜26px の想定）。

---

## 5. エッジケース対応

### 5.1 致死判定の色変更（緑 → 赤）
旧値が緑、新値が赤になるケース（または逆）。

**方針**: 色は新値の enter 開始時点で適用。Exit 中は旧値の色のまま。
- 実装: `<AnimatedDamage>` 内部で「現在表示中の color 状態」を持ち、新文字列構築時に `isLethal` を反映してクラス切替

### 5.2 ゼロから非ゼロ / 非ゼロからゼロ
`mitigated === 0` のセルは現在「無敵」テキスト or 空表示。
- ゼロ → 数値: 通常の swap シーケンス
- 数値 → ゼロ: exit のみ実施（enter で「0」を出すか、無敵テキスト切替かは別ロジック）
- 「無敵」表示部分はアニメ対象外（sub-info 領域）

### 5.3 連続変更（軽減ポチポチ操作）
- 中断: 既存アニメを `clearTimeout` で停止 + 既存 span を即座に DOM 削除
- 再起動: 最新値で enter シーケンス開始（exit はスキップ＝既に DOM から消えているので不要）
- 「連続中の中間値が見えない」のは仕様（最新値を見せる方が UX 良い）

### 5.4 初回マウント
プラン読み込み時に全セルに値がセットされる瞬間 → アニメ走らせると一斉アニメで激しい
- 初回（前回値が undefined）はアニメ無しで即表示
- `useRef<number | undefined>(undefined)` で初回判定

---

## 6. パフォーマンス保証

### 6.1 数値見積もり
- セル数: DOM 内 30〜100、画面内 5〜20
- 1 セル: 最大 7 spans (`999,999`)
- 同時アニメ要素: 最大 700 spans

### 6.2 GPU 負荷
- transform / opacity のみ → GPU 合成レイヤー専属、メインスレッドに影響なし
- 700 layers は現代 GPU の余裕圏内（数千〜数万まで耐える）

### 6.3 メインスレッド負荷
- swap トリガー時: React 再 render（既存の damageMap 再計算と同じタイミング、新規コストはほぼゼロ）
- className 付け替え 700 個: ~5ms 程度、フレーム予算（16.67ms / 60FPS）以内

### 6.4 守る実装ルール
1. `will-change: transform, opacity` は **アニメ中のみ JS で付与・終了後に外す**
2. swap トリガーは `requestAnimationFrame` でフレーム境界に揃える
3. CSS animation 完結、JS 補間ゼロ
4. filter / box-shadow / blur など重い CSS プロパティは併用しない
5. inline-block + tabular-nums で layout shift 完全防止

### 6.5 検証手順
実装後、以下を Chrome DevTools Performance パネルで実測：
- 軽減 5 連続配置 → ドロップフレーム数 0 を目標
- 大型プラン（100 セル）で連続 swap → 60FPS 維持確認
- ローエンド端末（iPhone SE 系）でも動作確認
- もしドロップしたら**即セーフティタグで巻き戻し → 数値再調整**

---

## 7. A11y（アクセシビリティ）

`prefers-reduced-motion: reduce` 設定オンのユーザーには **アニメーション完全 OFF**。
- CSS `@media (prefers-reduced-motion: reduce)` 内で `animation: none`
- 値はパッと切り替わるだけ
- 実装コスト: CSS 1 ブロックのみ

---

## 8. ロールバック計画

### 8.1 セーフティタグ
実装開始前に：
```bash
git tag pre-damage-anim
```
で現在の状態にラベル。何かあれば：
```bash
git reset --hard pre-damage-anim
```
で完全に戻せる。

### 8.2 段階的検証
1. AnimatedDamage コンポーネント単体実装 → ローカルで動作確認
2. TimelineRow.tsx に組み込み → ローカルで実機確認
3. パフォーマンス計測（FPS / メモリ）→ 規定値を満たさなければ巻き戻し
4. MobileTimelineRow.tsx に組み込み → モバイル実機確認
5. ユーザー（masaya-men）が実機で OK 出したらコミット → push → デプロイ

各段階で問題があれば前段階に戻る。

### 8.3 機能フラグなし
シンプルに保つため機能フラグは導入しない。問題があればセーフティタグで全削除する方針。

---

## 9. テスト

### 9.1 単体テスト（vitest）
- `AnimatedDamage` の値変更で DOM が再構築されること
- `value` 同値時にアニメが起動しないこと
- 初回マウントでアニメが起動しないこと
- `prefers-reduced-motion` 環境で animation:none が効くこと（Jest だけだと検証困難なので CSS は手動確認）

### 9.2 結合テスト
- 既存の TimelineRow 単体テスト（あれば）が壊れないこと
- ダメージ値の表示内容（数字フォーマット、致死色）が変わらないこと

### 9.3 実機テスト
- 軽減配置・削除でアニメが走る
- 連続操作で乱れない
- スクロールしたとき DOM 外セルでバグらない
- `prefers-reduced-motion` をシステムで ON → アニメ消失確認

---

## 10. スコープ外（今回はやらない）

- 元ダメージ値・軽減率・シールド量のアニメーション
- ジョブアイコンや他の UI 要素のアニメーション
- アニメ ON/OFF のユーザー設定 UI（OS 設定で十分、二重管理を避ける）
- アニメパラメータの管理画面化（数値はコード固定で良い）

---

## 11. 完了条件

- [ ] AnimatedDamage コンポーネント実装
- [ ] TimelineRow.tsx 統合
- [ ] MobileTimelineRow.tsx 統合
- [ ] CSS アニメーション + reduced-motion 対応
- [ ] 単体テスト追加
- [ ] `npm run build` 成功
- [ ] `vitest run` 全 PASS
- [ ] Chrome DevTools で 60FPS 維持確認
- [ ] ユーザー実機 OK
- [ ] セーフティタグ残置で push & デプロイ
