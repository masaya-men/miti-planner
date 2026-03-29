/**
 * チームロゴのアップロード・削除ユーティリティ
 * Firebase Storage に JPEG 変換済みロゴを保存し、Firestore に URL を記録する
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, storage, db } from '../lib/firebase';
import { COLLECTIONS } from '../types/firebase';

/** ロゴファイルの最大サイズ（2MB） */
const MAX_SIZE = 2 * 1024 * 1024;
/** リサイズ後のロゴサイズ（正方形、px） */
const LOGO_SIZE = 400;
/** 受け付ける画像MIME Type */
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Canvas API で画像を 400x400px にリサイズして JPEG に変換する
 * アスペクト比を維持した cover 方式で中央クロップする
 */
async function resizeToJpeg(file: File): Promise<Blob> {
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
                'image/jpeg',
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
 * Firestore の users/{uid} ドキュメントに teamLogoUrl を保存する
 * ドキュメントが存在しない場合は、セキュリティルールが要求する必須フィールド付きで作成する
 */
async function saveLogoUrlToFirestore(userId: string, url: string | null): Promise<void> {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
        // ドキュメントが存在する場合は teamLogoUrl のみ更新
        await updateDoc(userRef, { teamLogoUrl: url });
    } else {
        // ドキュメントが存在しない場合は必須フィールド付きで作成
        const user = auth.currentUser;
        const provider = user?.providerData[0]?.providerId === 'google.com' ? 'google'
            : user?.providerData[0]?.providerId === 'discord' ? 'discord'
            : 'twitter';
        await setDoc(userRef, {
            displayName: user?.displayName || 'User',
            provider,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            settings: {},
            teamLogoUrl: url,
        });
    }
}

/**
 * チームロゴをアップロードする
 * リサイズ → Firebase Storage → Firestore の順に処理し、ダウンロード URL を返す
 */
export async function uploadTeamLogo(userId: string, file: File): Promise<string> {
    console.log('[LogoUpload] 開始:', { userId, fileName: file.name, fileSize: file.size, fileType: file.type });

    let blob: Blob;
    try {
        blob = await resizeToJpeg(file);
        console.log('[LogoUpload] JPEGリサイズ成功:', { blobSize: blob.size });
    } catch (err) {
        console.error('[LogoUpload] JPEGリサイズ失敗:', err);
        throw err;
    }

    const storageRef = ref(storage, `users/${userId}/team-logo.jpg`);
    try {
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        console.log('[LogoUpload] Storage アップロード成功');
    } catch (err) {
        console.error('[LogoUpload] Storage アップロード失敗:', err);
        throw err;
    }

    const url = await getDownloadURL(storageRef);
    console.log('[LogoUpload] ダウンロードURL取得成功');

    try {
        await saveLogoUrlToFirestore(userId, url);
        console.log('[LogoUpload] Firestore 保存成功');
    } catch (err) {
        console.error('[LogoUpload] Firestore 保存失敗:', err);
        throw err;
    }

    return url;
}

/**
 * チームロゴを削除する
 * Storage からファイルを削除し、Firestore の URL を null にする
 * Storage にファイルが存在しない場合はエラーを無視する
 */
export async function deleteTeamLogo(userId: string): Promise<void> {
    // 現行（JPEG）と旧形式（WebP）の両方を削除試行
    for (const ext of ['team-logo.jpg', 'team-logo.webp']) {
        try {
            await deleteObject(ref(storage, `users/${userId}/${ext}`));
        } catch {
            // ファイルが存在しない場合は無視
        }
    }
    try {
        await saveLogoUrlToFirestore(userId, null);
    } catch (err) {
        console.error('[LogoUpload] Firestore ロゴURL削除失敗:', err);
        throw err;
    }
}
