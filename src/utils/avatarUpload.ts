/**
 * アバター画像のクロップ・リサイズ・WebP変換・Storageアップロード
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';

/** アップロード前の元ファイル最大サイズ（50MB — ブラウザ内処理なのでサーバーに影響なし） */
const MAX_ORIGINAL_SIZE = 50 * 1024 * 1024;
/** リサイズ後のアバターサイズ（正方形、px） */
const AVATAR_SIZE = 128;
/** 受け付ける画像MIME Type */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * 元ファイルのバリデーション
 * エラー時はi18nキーを返す
 */
export function validateAvatarFile(file: File): string | null {
    if (!ALLOWED_TYPES.includes(file.type)) return 'avatar.error_invalid_type';
    if (file.size > MAX_ORIGINAL_SIZE) return 'avatar.error_too_large';
    return null;
}

/**
 * クロップ済み画像データを128x128 WebPに変換
 * @param imageSrc 元画像のURL（blob URL等）
 * @param cropArea { x, y, width, height } クロップ領域（ピクセル座標）
 */
export async function cropAndResize(
    imageSrc: string,
    cropArea: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = AVATAR_SIZE;
            canvas.height = AVATAR_SIZE;
            const ctx = canvas.getContext('2d')!;

            ctx.drawImage(
                img,
                cropArea.x, cropArea.y, cropArea.width, cropArea.height,
                0, 0, AVATAR_SIZE, AVATAR_SIZE,
            );

            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(img.src);
                    blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'));
                },
                'image/webp',
                0.85,
            );
        };
        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Image load failed'));
        };
        img.src = imageSrc;
    });
}

/**
 * WebP Blobから128x128 PNGを派生させる(satori等WebP非対応環境向け)。
 * createImageBitmapはWebPをデコードできるブラウザでのみ動く前提(WebP生成自体が
 * 同じブラウザで既に成功している = デコードも同一エンジンでサポートされている)。
 * 失敗しても致命的にしない(戻り値nullでOGPカードのアイコンがプレースホルダに留まるだけ)。
 */
async function deriveAvatarPng(webpBlob: Blob): Promise<Blob | null> {
    try {
        const bitmap = await createImageBitmap(webpBlob);
        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
        return await new Promise<Blob | null>((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/png');
        });
    } catch {
        return null;
    }
}

/**
 * アバターをFirebase Storageにアップロードし、FirestoreにURLを保存
 * (WebP本体 + satori等WebP非対応環境向けPNG派生版の両方をアップロードする)
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
    const storageRef = ref(storage, `users/${userId}/avatar.webp`);
    await uploadBytes(storageRef, blob, { contentType: 'image/webp' });
    const url = await getDownloadURL(storageRef);

    let pngUrl: string | null = null;
    const pngBlob = await deriveAvatarPng(blob);
    if (pngBlob) {
        const pngRef = ref(storage, `users/${userId}/avatar.png`);
        await uploadBytes(pngRef, pngBlob, { contentType: 'image/png' });
        pngUrl = await getDownloadURL(pngRef);
    }

    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: url, avatarPngUrl: pngUrl, updatedAt: new Date().toISOString() });
    }

    return url;
}

/**
 * アバターを削除
 */
export async function deleteAvatar(userId: string): Promise<void> {
    try {
        await deleteObject(ref(storage, `users/${userId}/avatar.webp`));
    } catch {
        // ファイルが存在しない場合は無視
    }
    try {
        await deleteObject(ref(storage, `users/${userId}/avatar.png`));
    } catch {
        // 派生PNGが無い(旧アップロード等)場合は無視
    }
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);
    if (snapshot.exists()) {
        await updateDoc(userRef, { avatarUrl: null, avatarPngUrl: null, updatedAt: new Date().toISOString() });
    }
}
