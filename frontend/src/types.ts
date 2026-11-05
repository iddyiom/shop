// The shapes of the API's JSON. Each one mirrors a Pydantic schema in app/schemas.py.
import type { Role } from './user';

/** UserOut */
export type User = {
  id: number;
  full_name: string;
  username: string;
  role: Role;
  is_locked: boolean;
  is_active: boolean;
};

/** LoginResponse */
export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};
