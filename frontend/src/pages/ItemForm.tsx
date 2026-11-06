// New item (/items/new) or edit item (/items/:groupId/edit). Owner only.
// The price of an existing item is changed from the list, with the confirm step.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { apiPatch, apiPost } from '../api';
import PageHeader from '../components/PageHeader';
import { formatTsh } from '../format';
import { parseTsh } from '../money';
import type { Group } from '../types';
import { errorMessage, useApi } from '../useApi';
import Skeleton from '../components/Skeleton';

export default function ItemForm() {
  const { groupId } = useParams();
  const isNew = groupId === undefined;
  const navigate = useNavigate();

  // Editing: there is no GET /groups/{id}, so read the list (stopped ones included).
  const all = useApi<Group[]>(isNew ? null : '/groups?include_stopped=true');
  const group = isNew ? null : (all.data ?? []).find((g) => g.id === Number(groupId)) ?? null;

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (group) setName(group.name); // fill the form once the item has loaded
  }, [group]);

  function done(notice: string) {
    navigate('/items', { state: { notice } });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (trimmed === '') return setError('Enter a name.');
    setError(null);

    if (isNew) {
      const parsed = parseTsh(price);
      if (!parsed.ok) return setError(parsed.error);
      setBusy(true);
      try {
        await apiPost<Group>('/groups', { name: trimmed, price: parsed.value });
        done(`${trimmed} added`);
      } catch (err) {
        setError(errorMessage(err)); // e.g. "That name is already used"
        setBusy(false);
      }
      return;
    }

    if (!group) return;
    if (trimmed === group.name) return done('Nothing changed');
    setBusy(true);
    try {
      await apiPatch<Group>(`/groups/${group.id}`, { name: trimmed }); // only what changed
      done(`${group.name} renamed to ${trimmed}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  async function setSelling(isActive: boolean) {
    if (!group || busy) return;
    setBusy(true);
    try {
      await apiPatch<Group>(`/groups/${group.id}`, { is_active: isActive });
      done(isActive ? `${group.name} is selling again` : `${group.name} stopped`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!isNew && all.loading) {
    return (
      <Skeleton />
    );
  }
  if (!isNew && !group) {
    return (
      <>
        <PageHeader title="Item not found" tabTitle="Item not found" />
        <p className="coming-soon">
          {all.error ?? 'This item does not exist.'} <Link to="/items">Back to items and prices</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <Link to="/items" className="back-link">
        ← Back to items and prices
      </Link>
      <PageHeader
       
        title={isNew ? 'New item' : `Edit ${group?.name}`}
        tabTitle={isNew ? 'New item' : 'Edit item'}
      />

      <form className="form-card narrow" onSubmit={save} noValidate>
        {isNew && (
          <p className="form-lead">A group like Soda or Juice. You add its sub-items after.</p>
        )}
        <div className="field">
          <label htmlFor="item-name">Item name</label>
          <input id="item-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
        </div>

        {isNew ? (
          <div className="field">
            <label htmlFor="item-price">Item price (TSh)</label>
            <input id="item-price" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
            <span className="field-hint">Every sub-item sells at this price unless it has its own.</span>
          </div>
        ) : (
          <p className="field-hint">
            Item price: TSh {formatTsh(group?.current_price ?? 0)}. Change it from the list: it asks you to confirm.
          </p>
        )}

        {error && (
          <p className="form-message" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? 'Saving…' : isNew ? 'Add item' : 'Save name'}
        </button>
      </form>

      {group && (
        <section className="form-card narrow" aria-labelledby="selling-title">
          <h2 id="selling-title">{group.is_active ? 'Stop selling' : 'Bring back'}</h2>
          <p className="field-hint">
            {group.is_active
              ? 'Stops selling all its sub-items. Their stock and all history are kept. Nothing is deleted.'
              : 'Its sub-items can be sold again, exactly as before.'}
          </p>
          <button type="button" className="ghost-button" onClick={() => setSelling(!group.is_active)} disabled={busy}>
            {group.is_active ? `Stop selling ${group.name}` : `Bring back ${group.name}`}
          </button>
        </section>
      )}
    </>
  );
}
