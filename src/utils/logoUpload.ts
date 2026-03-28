/**
 * チームロゴのアップロード・削除ユーティリティ
 * Firebase Storage に WebP 変換済みロゴを保存し、Firestore に URL を記録する
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';

/** ロゴファイルの最大サイズ（2MB） */
const MAX_SIZE = 2 * 1024 * 1024;
/** リサイズ後のロゴサイズ（正方形、px） */
const LOGO_SIZE = 400;
/** 受け付ける画像MIME Type */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Canvas API で画像を 400x400px にリサイズして WebP に変換する
 * アスペクト比を維持した cover 方式で中央クロップする
 */
async function resizeToWebP(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = LOGO_SIZE;
            canvas.height = LOGO_SIZE;
            const ctx = canvas.getContext('2d')!;

            // アスペクト比を維持して中央にフィット（cover方式）
            const scale = Math.max(LOGO_SIZE / img.width, LOGO_SIZE / img.height);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = (LOGO_SIZE - w) / 2;
            const y = (LOGO_SIZE - h) / 2;

            ctx.drawImage(img, x, y, w, h);
            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(img.src);
                    blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
                },
                'image/webp',
                0.85
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Image load failed'));
        };
        img.src = URL.createObjectURL(file);
    });
}

/**
 * ロゴファイルのバリデーション
 * エラーがある場合は i18n キー名を返し、問題なければ null を返す
 */
export function validateLogoFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'error_invalid_type';
    if (file.size > MAX_SIZE) return 'error_too_large';
    return null;
}

/**
 * チームロゴをアップロードする
 * リサイズ → Firebase Storage → Firestore の順に処理し、ダウンロード URL を返す
 * Firestore ドキュメントが存在しない場合は自動作成（merge: true）
 */
export async function uploadTeamLogo(userId: string, file: File): Promise<string> {
    const blob = await resizeToWebP(file);
    const storageRef = ref(storage, `users/${userId}/team-logo.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    const url = await getDownloadURL(storageRef);

    // Firestore に URL を保存（ドキュメントがなければ作成）
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, { teamLogoUrl: url }, { merge: true });

    return url;
}

/**
 * チームロゴを削除する
 * Storage からファイルを削除し、Firestore の URL を null にする
 * Storage にファイルが存在しない場合はエラーを無視する
 */
export async function deleteTeamLogo(userId: string): Promise<void> {
    const storageRef = ref(storage, `users/${userId}/team-logo.webp`);
    try {
        await deleteObject(storageRef);
    } catch {
        // ファイルが存在しない場合は無視
    }
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    await setDoc(userRef, { teamLogoUrl: null }, { merge: true });
}
