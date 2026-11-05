// Users: empty until unit F10.
import PageHeader, { ComingSoon } from '../components/PageHeader';

export default function Users() {
  return (
    <>
      <PageHeader eyebrow="USERS" title="Who can log in" tabTitle="Users" />
      <ComingSoon unit="F10" />
    </>
  );
}
