// Guard for every page except Log in: no user → go to /login, remembering where they wanted to go.
import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../auth';

export default function RequireAuth() {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return (
      <p className="loading-page" role="status">
        Loading…
      </p>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}
