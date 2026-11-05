// Shown to a shopkeeper who opens an owner page by typing its address.
import { Link } from 'react-router';

import PageHeader from '../components/PageHeader';

export default function OwnerOnly() {
  return (
    <>
      <PageHeader eyebrow="OWNER ONLY" title="This page is for the owner" tabTitle="Owner only" />
      <p className="coming-soon">
        Ask the owner if you need something from here, or <Link to="/">go back Home</Link>.
      </p>
    </>
  );
}
