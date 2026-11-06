// Users (owner only): who can log in. Unlock, add, deactivate or bring back. Nothing is deleted.
// Spec: docs/specs/f10-users.md. Plain rules live in src/users.ts.
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { ApiError, apiPatch, apiPost } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import type { User } from '../types';
import { useApi, errorMessage } from '../useApi';
import { ROLE_LABEL, type Role } from '../user';
import { checkNewUser, firstName, initials, userBadges, type NewUserForm, type NewUserProblems } from '../users';

const EMPTY_FORM: NewUserForm = { fullName: '', username: '', password: '', role: null };

export default function Users() {
  const me = useAuth().user; // inside RequireOwner, so always set
  const users = useApi<User[]>('/users');

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null); // which button is saving (rule 10)
  const [confirming, setConfirming] = useState<User | null>(null); // question 2: deactivate asks first
  const cancelRef = useRef<HTMLButtonElement>(null);

  // On a phone the confirm panel sits below the list: bring it into view, and put the
  // keyboard on Cancel (the safe choice). `?.()` because test browsers have no scrolling.
  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.scrollIntoView?.({ block: 'center' });
    cancelRef.current?.focus();
  }, [confirming]);

  /** Unlock, deactivate and bring back share this: one request, then reload and a note (rule 9). */
  async function act(key: string, request: () => Promise<unknown>, note: string) {
    if (busyKey) return; // one click = one save
    setBusyKey(key);
    setError(null);
    setNotice(null);
    try {
      await request();
      setNotice(note);
      setConfirming(null);
      users.reload(); // show what the SERVER has now
    } catch (err) {
      setError(errorMessage(err));
      // Someone changed the list meanwhile (404) or the server refused (409): show the real list.
      if (err instanceof ApiError && (err.status === 404 || err.status === 409)) users.reload();
    } finally {
      setBusyKey(null);
    }
  }

  const header = <PageHeader eyebrow="USERS" title="Who can log in" tabTitle="Users" />;

  // Only the FIRST load blanks the page; a reload after a change keeps the list on screen.
  if (!users.data && (users.loading || users.error)) {
    return (
      <>
        {header}
        {users.loading ? (
          <p className="panel-state" role="status">
            Loading…
          </p>
        ) : (
          <div className="panel-state">
            <p role="alert">{users.error}</p>
            <button type="button" className="pill-button" onClick={users.reload}>
              Try again
            </button>
          </div>
        )}
      </>
    );
  }

  const list = users.data ?? [];
  const locked = list.filter((u) => u.is_locked);

  return (
    <>
      {header}
      {notice && (
        <p className="notice-ok" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}

      {/* Rule 5: the banner itself is the check, so Unlock needs no confirm. */}
      {locked.map((u) => (
        <section key={u.id} className="locked-banner" aria-label={`${u.full_name} is locked out`}>
          <p>
            <strong>{u.full_name} is locked out.</strong> Check it was really {firstName(u.full_name)}, then unlock.
          </p>
          <button
            type="button"
            className="dark-button"
            disabled={busyKey !== null}
            onClick={() =>
              act(`unlock-${u.id}`, () => apiPost(`/users/${u.id}/unlock`, {}), `${u.full_name} unlocked`)
            }
          >
            {busyKey === `unlock-${u.id}` ? 'Saving…' : `Unlock ${firstName(u.full_name)}`}
          </button>
        </section>
      ))}

      <div className="users-layout">
        <section className="panel users-main" aria-labelledby="accounts-title">
          <div className="panel-head">
            <h2 id="accounts-title">All accounts</h2>
          </div>
          <ul className="account-list">
            {list.map((u) => {
              const isMe = u.id === me?.id;
              return (
                <li key={u.id} className={u.is_active ? 'account-row' : 'account-row off'} aria-label={u.full_name}>
                  <span className="avatar" aria-hidden="true">
                    {initials(u.full_name)}
                  </span>
                  <span className="account-what">
                    <strong>
                      {u.full_name}
                      {isMe && ' (you)'}
                    </strong>
                    <span>
                      @{u.username} · {ROLE_LABEL[u.role]}
                    </span>
                  </span>
                  <span className="account-badges">
                    {userBadges(u).map((badge) => (
                      <span key={badge} className={`user-badge user-badge-${badge.toLowerCase()}`}>
                        {badge}
                      </span>
                    ))}
                  </span>
                  {/* Rule 3: never on your own row. Question 4: other owners can be deactivated. */}
                  {!isMe &&
                    (u.is_active ? (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busyKey !== null}
                        onClick={() => {
                          setConfirming(u);
                          setNotice(null);
                          setError(null);
                        }}
                      >
                        Deactivate {firstName(u.full_name)}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost-button"
                        disabled={busyKey !== null}
                        onClick={() =>
                          act(
                            `back-${u.id}`,
                            () => apiPatch(`/users/${u.id}`, { is_active: true }),
                            `${u.full_name} can log in again`,
                          )
                        }
                      >
                        {busyKey === `back-${u.id}` ? 'Saving…' : `Bring back ${firstName(u.full_name)}`}
                      </button>
                    ))}
                </li>
              );
            })}
          </ul>
          <p className="empty-text small-note">
            Accounts are never deleted. A deactivated account cannot log in, but its sales stay in the records.
          </p>
        </section>

        <aside className="users-side">
          {confirming && (
            <section className="strong-card" aria-labelledby="confirm-title">
              <h2 id="confirm-title">Deactivate {confirming.full_name}?</h2>
              <p className="strong-muted">
                {firstName(confirming.full_name)} will not be able to log in. Their sales stay in the records.
              </p>
              <div className="confirm-buttons">
                <button
                  ref={cancelRef}
                  type="button"
                  className="ghost-button on-strong"
                  onClick={() => setConfirming(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-button"
                  disabled={busyKey !== null}
                  onClick={() =>
                    act(
                      `off-${confirming.id}`,
                      () => apiPatch(`/users/${confirming.id}`, { is_active: false }),
                      `${confirming.full_name} deactivated`,
                    )
                  }
                >
                  {busyKey === `off-${confirming.id}` ? 'Saving…' : 'Yes, deactivate'}
                </button>
              </div>
            </section>
          )}
          <AddUserForm
            onCreated={(created) => {
              setNotice(`Account created for ${created.full_name}`);
              setError(null);
              users.reload();
            }}
          />
        </aside>
      </div>
    </>
  );
}

function AddUserForm({ onCreated }: { onCreated: (user: User) => void }) {
  const [form, setForm] = useState<NewUserForm>(EMPTY_FORM);
  const [problems, setProblems] = useState<NewUserProblems>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function change(field: keyof NewUserForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setProblems((current) => ({ ...current, [field]: undefined })); // the fixed field stops being red
    setError(null);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    // Rule 6: friendly messages before sending; the server checks again.
    const found = checkNewUser(form);
    setProblems(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    setError(null);
    try {
      const created = await apiPost<User>('/users', {
        full_name: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password, // rule 8: sent once, kept nowhere
        role: form.role,
      });
      setForm(EMPTY_FORM); // the password leaves memory with the form
      onCreated(created);
    } catch (err) {
      setError(errorMessage(err)); // e.g. "That username is already used"; the form is kept
    } finally {
      setBusy(false);
    }
  }

  const field = (key: 'fullName' | 'username' | 'password', label: string, type = 'text', auto = 'off') => (
    <div className="field">
      <label htmlFor={`new-${key}`}>{label}</label>
      <input
        id={`new-${key}`}
        type={type}
        autoComplete={auto}
        value={form[key]}
        aria-invalid={problems[key] ? true : undefined}
        aria-describedby={problems[key] ? `new-${key}-problem` : undefined}
        onChange={(e) => change(key, e.target.value)}
      />
      {problems[key] && (
        <p id={`new-${key}-problem`} className="field-problem">
          {problems[key]}
        </p>
      )}
    </div>
  );

  return (
    <form className="form-card add-user" aria-labelledby="add-user-title" onSubmit={create} noValidate>
      <h2 id="add-user-title">Add a user</h2>
      {field('fullName', 'Full name')}
      {field('username', 'Username')}
      {field('password', 'First password', 'password', 'new-password')}
      <fieldset className="adjust-step">
        <legend>Role</legend>
        <div className="choice-grid two">
          {(['shopkeeper', 'owner'] as Role[]).map((role) => (
            <label key={role} className={form.role === role ? 'choice-tile chosen' : 'choice-tile'}>
              <input
                type="radio"
                name="new-role"
                value={role}
                checked={form.role === role}
                onChange={() => change('role', role)}
              />
              {ROLE_LABEL[role]}
            </label>
          ))}
        </div>
        {problems.role && <p className="field-problem">{problems.role}</p>}
      </fieldset>
      {error && (
        <p className="form-message" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? 'Saving…' : 'Create account'}
      </button>
    </form>
  );
}
