import type { User } from 'firebase/auth';
import { useAuthStore } from '../../store/useAuthStore';

/**
 * 偽管理者を useAuthStore に注入する。
 * サンドボックスでは onAuthStateChanged を登録しない（useAuthStore 側でガード）ため、
 * この状態が null で上書きされることはない。
 */
export function initAdminSandbox(): void {
  const fakeUser = {
    uid: 'sandbox-admin',
    displayName: 'Sandbox Admin',
    email: null,
    photoURL: null,
  } as unknown as User;

  useAuthStore.setState({
    user: fakeUser,
    isAdmin: true,
    loading: false,
    profileDisplayName: 'Sandbox Admin',
    isNewUser: false,
  });

  // eslint-disable-next-line no-console
  console.info('[admin-sandbox] 偽管理者を注入しました。/admin が利用可能です。');
}
