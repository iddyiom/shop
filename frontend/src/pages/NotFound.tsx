// Any address that is not in routes.tsx.
import { Link } from 'react-router';

import PageHeader from '../components/PageHeader';

export default function NotFound() {
  return (
    <>
      <PageHeader title="This page does not exist" tabTitle="Page not found" />
      <p className="coming-soon">
        Check the address, or <Link to="/">go back Home</Link>.
      </p>
    </>
  );
}
