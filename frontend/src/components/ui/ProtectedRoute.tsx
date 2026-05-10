import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface Props {
  roles: string[];
  children: React.ReactNode;
}

export function ProtectedRoute({ roles, children }: Props) {
  const role = useAuthStore((s) => s.user?.role ?? '');

  if (!roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
