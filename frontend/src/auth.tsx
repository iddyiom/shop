// Who is logged in, for the whole app. Read it anywhere with useAuth().
// The user and role are never stored in the browser: with a saved token we ask GET /auth/me.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { apiGet, apiPost, clearToken, readToken, saveToken, setSessionEndHandler } from './api';
import { clearBill } from './bill';
import type { LoginResponse, User } from './types';

type AuthValue = {
  user: User | null; // null = nobody logged in
  checking: boolean; // true while asking /auth/me about a saved token
  notice: string | null; // why the last session ended, shown on the Log in page
  logIn: (username: string, password: string) => Promise<void>;
  logOut: () => void;
};

const SESSION_ENDED = 'Your session ended. Please log in again.';

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(() => readToken() !== null);
  const [notice, setNotice] = useState<string | null>(null);

  // Any 401 or 423 from any call ends the visit (api.ts has already cleared the token).
  useEffect(() => {
    setSessionEndHandler((error) => {
      setUser(null);
      setNotice(error.status === 423 ? error.message : SESSION_ENDED);
    });
    return () => setSessionEndHandler(null);
  }, []);

  // A token from earlier in this tab: ask the server who it belongs to.
  useEffect(() => {
    if (readToken() === null) return;
    let active = true;
    apiGet<User>('/auth/me')
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        // 401 / 423: the session-end handler above already reacted.
        // API not reachable: stay logged out; the Log in page says why when they try.
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function logIn(username: string, password: string) {
    setNotice(null); // a new try: the old "session ended" note no longer applies
    // endsSession false: a 401 here only means a wrong password.
    const answer = await apiPost<LoginResponse>('/auth/login', { username, password }, { endsSession: false });
    saveToken(answer.access_token);
    setNotice(null);
    setUser(answer.user);
  }

  function logOut() {
    clearToken();
    clearBill(); // an unfinished bill belongs to this person's visit only
    setNotice(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, checking, notice, logIn, logOut }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth() must be used inside <AuthProvider>');
  return value;
}
