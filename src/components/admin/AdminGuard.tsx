/**
 * 管理画面ルートガード
 * admin権限がないユーザーはトップページにリダイレクト
 */
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuthStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-app-bg text-app-text">
        <div className="text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
