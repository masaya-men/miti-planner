import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';
import type { User } from 'firebase/auth';

/**
 * ユーザーのFirestoreドキュメントが存在するか確認し、
 * なければ新規作成（必須フィールド網羅）、あれば古いドキュメントの欠損フィールドを補完する。
 * プロフィール更新操作（名前変更、アイコン変更）の直前に呼び出すことで、
 * WelcomeSetupを通っていないユーザーや古いユーザーのデータを安全に修復する。
 */
export async function ensureUserDocument(currentUser: User): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
    const userDoc = await getDoc(userRef);
    const now = new Date().toISOString();

    if (!userDoc.exists()) {
        // 全くドキュメントが存在しない（Housing側からの新規登録など）
        const providerData = currentUser.providerData[0];
        const provider = providerData?.providerId === 'twitter.com' ? 'twitter' : 'discord';
        
        await setDoc(userRef, {
            displayName: currentUser.displayName || 'User',
            avatarUrl: currentUser.photoURL || null,
            provider,
            createdAt: now,
            updatedAt: now,
            settings: {},
        });
    } else {
        // ドキュメントは存在するが、古い形式（settings がない等）の場合に補完する
        const data = userDoc.data();
        let needsUpdate = false;
        const updates: any = {};

        if (!data.settings) {
            updates.settings = {};
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            updates.updatedAt = now;
            await setDoc(userRef, updates, { merge: true });
        }
    }
}
