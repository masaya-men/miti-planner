import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * ハウジングツアーの featureSession (opt-in 状態) を読み取る。
 * Firestore `users/{uid}/featureSessions/housing` の `activated` フィールドが true なら true を返す。
 */
export async function isHousingActivated(uid: string): Promise<boolean> {
  const ref = doc(db, 'users', uid, 'featureSessions', 'housing');
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  return snap.data()?.activated === true;
}

/**
 * ハウジングツアーへの opt-in を Firestore に書き込む。
 * `users/{uid}/featureSessions/housing` に `{ activated: true, activatedAt: serverTimestamp() }` を上書きする。
 * 失敗時は throw する（呼び出し側で処理すること）。
 */
export async function markHousingActivated(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid, 'featureSessions', 'housing');
  await setDoc(ref, {
    activated: true,
    activatedAt: serverTimestamp(),
  });
}
