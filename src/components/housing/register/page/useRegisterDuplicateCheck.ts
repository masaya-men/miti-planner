import { useEffect, useRef, useState } from 'react';
import type { RegisterDuplicateState } from '../RegisterDuplicatePanel';
import { checkDuplicate, type DuplicateEntry } from '../../../../lib/housingApiClient';
import type { AddressInput } from '../../../../utils/housingRegistrationTypes';

export function useRegisterDuplicateCheck(mode: 'create' | 'edit', addressOk: boolean, addressCandidate: AddressInput) {
  // ===== 右カラム: 重複照会 (debounce 500ms, Task13) =====
  // 住所が妥当になったら 500ms デバウンスで checkDuplicate を呼ぶ。競合対策として
  // 世代トークン (requestSeqRef) を持たせ、古いタイマー/古い応答が新しい結果を
  // 上書きしないようにする。失敗時は握りつぶし idle (中立) に留める (登録フローをブロックしないが、
  // 重複の有無が不明な状態を「重複なし」と偽って安心させない)。
  const [duplicateState, setDuplicateState] = useState<RegisterDuplicateState>('idle');
  const [duplicates, setDuplicates] = useState<DuplicateEntry[]>([]);
  const [privateMatchCount, setPrivateMatchCount] = useState(0);
  const debounceTimerRef = useRef<number | null>(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (debounceTimerRef.current != null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 編集モード (mode='edit') では自分自身の doc が必ず住所一致でヒットし「重複」誤検知になる。
    // 送信ゲート (handleSubmit) は既に mode==='edit' で checkDuplicate をスキップしているのに、
    // ライブ照会側だけ mode ガードが漏れていて右カラムパネルが常に⚠重複を出していた (I 根治)。
    // 編集中はライブ照会を一切走らせず、in-flight 応答も無効化して idle (中立) に留める。
    if (mode === 'edit') {
      requestSeqRef.current += 1;
      setDuplicateState('idle');
      setDuplicates([]);
      setPrivateMatchCount(0);
      return;
    }

    if (!addressOk) {
      // 世代を進めて in-flight 応答を無効化してから idle に戻す。
      requestSeqRef.current += 1;
      setDuplicateState('idle');
      setDuplicates([]);
      setPrivateMatchCount(0);
      return;
    }

    const mySeq = ++requestSeqRef.current;
    setDuplicateState('checking');
    debounceTimerRef.current = window.setTimeout(() => {
      checkDuplicate(addressCandidate)
        .then((res) => {
          if (requestSeqRef.current !== mySeq) return; // 古い世代の応答は破棄
          const nextDuplicates = res.duplicates ?? [];
          const nextPrivateCount = res.privateMatchCount ?? 0;
          setDuplicates(nextDuplicates);
          setPrivateMatchCount(nextPrivateCount);
          setDuplicateState(nextDuplicates.length === 0 && nextPrivateCount === 0 ? 'clear' : 'found');
        })
        .catch(() => {
          if (requestSeqRef.current !== mySeq) return;
          // 失敗時は止めない (安全側)。ただし重複の有無は実際には不明なので、
          // 「重複なし・安心」を断定表示する clear ではなく中立の idle に留める
          // (偽の安心表示を出さない)。住所を再編集すれば次のキー入力で再発火する。
          setDuplicates([]);
          setPrivateMatchCount(0);
          setDuplicateState('idle');
        });
    }, 500);

    return () => {
      if (debounceTimerRef.current != null) {
        window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
    // addressCandidate は address から導出される新規オブジェクトなので、実質的な変化検知は
    // addressOk と中身の JSON 化で行う (JSON.stringify で値の同一性を見る簡便策)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addressOk, JSON.stringify(addressCandidate)]);

  // unmount 時に debounce タイマーを確実に破棄する。
  useEffect(
    () => () => {
      if (debounceTimerRef.current != null) window.clearTimeout(debounceTimerRef.current);
    },
    [],
  );

  return { duplicateState, duplicates, privateMatchCount };
}
