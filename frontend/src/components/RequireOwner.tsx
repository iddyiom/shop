// Guard for owner pages. Only for a clean screen: the server's 403 is the real lock.
import { Outlet } from 'react-router';

import OwnerOnly from '../pages/OwnerOnly';
import { useCurrentUser } from '../user';

export default function RequireOwner() {
  const user = useCurrentUser();
  return user.role === 'owner' ? <Outlet /> : <OwnerOnly />;
}
